import type { StructuredExercise } from './storage';
import { getExerciseLogs } from './storage';

/**
 * Parse freeform exercise strings into structured data.
 * Handles formats like:
 *   "Bench 185×5×4" → { name: "Bench", weight: 185, sets: [5,5,5,5] }
 *   "Bench Press 185x8x3" → { name: "Bench Press", weight: 185, sets: [8,8,8] }
 *   "Pull-ups 3x10" → { name: "Pull-ups", weight: undefined, sets: [10,10,10] }
 *   "OHP 135×8×3" → { name: "OHP", weight: 135, sets: [8,8,8] }
 */
export function parseExerciseString(raw: string): StructuredExercise[] {
  if (!raw) return [];

  const results: StructuredExercise[] = [];
  const segments = raw.split(/[,;]|\s+\/\s+|\s+\+\s+/).map(s => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const exercise = parseSingleExercise(seg);
    if (exercise) results.push(exercise);
  }

  return results;
}

function parseSingleExercise(seg: string): StructuredExercise | null {
  // Pattern: "Name Weight×Reps×Sets" or "Name WeightxRepsxSets"
  const match1 = seg.match(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:lbs?|lb)?\s*[×x]\s*(\d+)\s*[×x]\s*(\d+)$/i
  );
  if (match1) {
    const [, name, weightStr, repsStr, setsStr] = match1;
    return {
      name: cleanName(name),
      weight: parseFloat(weightStr),
      sets: Array(parseInt(setsStr)).fill(parseInt(repsStr)),
    };
  }

  // Pattern: "Name SetsxReps" (no weight, e.g., "Pull-ups 3x10")
  const match2 = seg.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)$/i);
  if (match2) {
    const [, name, firstNum, secondNum] = match2;
    const n1 = parseInt(firstNum), n2 = parseInt(secondNum);
    if (n1 <= 6) {
      return { name: cleanName(name), sets: Array(n1).fill(n2) };
    } else {
      return { name: cleanName(name), weight: n1, sets: [n2] };
    }
  }

  // Pattern: "Name Weight×R1/R2/R3" (variable reps per set)
  const match3 = seg.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:lbs?|lb)?\s*[×x]\s*([\d/]+)$/i);
  if (match3) {
    const [, name, weightStr, repsStr] = match3;
    const sets = repsStr.split('/').map(r => parseInt(r)).filter(n => !isNaN(n));
    if (sets.length > 0) return { name: cleanName(name), weight: parseFloat(weightStr), sets };
  }

  // Fallback: just name
  const nameOnly = seg.replace(/\s*\(.*?\)\s*/g, '').trim();
  if (nameOnly.length > 1 && nameOnly.length < 60) {
    return { name: cleanName(nameOnly), sets: [] };
  }

  return null;
}

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/^\d+\.\s*/, '').trim();
}

const NAME_MAP: Record<string, string> = {
  'bench': 'Bench Press', 'bench press': 'Bench Press', 'flat bench': 'Bench Press',
  'incline bench': 'Incline Bench Press', 'incline db press': 'Incline DB Press',
  'incline dumbbell press': 'Incline DB Press',
  'ohp': 'Overhead Press', 'overhead press': 'Overhead Press', 'military press': 'Overhead Press',
  'squat': 'Barbell Squat', 'squats': 'Barbell Squat', 'barbell squat': 'Barbell Squat',
  'barbell squats': 'Barbell Squat',
  'deadlift': 'Deadlift', 'deadlifts': 'Deadlift',
  'rows': 'Barbell Row', 'barbell rows': 'Barbell Row', 'barbell row': 'Barbell Row',
  'lat pulldown': 'Lat Pulldown', 'lat pulldowns': 'Lat Pulldown',
  'pull-ups': 'Pull-ups', 'pullups': 'Pull-ups', 'pull ups': 'Pull-ups',
  'cable fly': 'Cable Fly', 'cable flys': 'Cable Fly', 'cable flies': 'Cable Fly',
  'leg press': 'Leg Press', 'leg extension': 'Leg Extension', 'leg extensions': 'Leg Extension',
  'leg curl': 'Leg Curl', 'leg curls': 'Leg Curl', 'chest press': 'Chest Press',
  'dumbbell curl': 'Dumbbell Curl', 'curls': 'Dumbbell Curl', 'bicep curls': 'Dumbbell Curl',
  'tricep pushdown': 'Tricep Pushdown', 'tricep pushdowns': 'Tricep Pushdown',
};

export function normalizeExerciseName(name: string): string {
  return NAME_MAP[name.toLowerCase().trim()] || name;
}

const SE_CACHE_KEY = 'forge_structured_exercises';

function loadSECache(): Record<string, StructuredExercise[]> {
  try { return JSON.parse(localStorage.getItem(SE_CACHE_KEY) || '{}'); } catch { return {}; }
}

function saveSECache(cache: Record<string, StructuredExercise[]>) {
  localStorage.setItem(SE_CACHE_KEY, JSON.stringify(cache));
}

/**
 * Retroactively parse structured exercises from existing freeform data.
 * Saves results to localStorage cache — no Supabase schema change needed.
 */
export async function retroParseExercises(): Promise<number> {
  const logs = await getExerciseLogs();
  const cache = loadSECache();
  let updated = 0;

  for (const log of logs) {
    // Skip if already cached
    if (cache[log.id]) continue;
    if (!log.exercises) continue;

    const parsed = parseExerciseString(log.exercises);
    if (parsed.length > 0) {
      cache[log.id] = parsed.map(p => ({ ...p, name: normalizeExerciseName(p.name) }));
      updated++;
    }
  }

  if (updated > 0) {
    saveSECache(cache);
    console.log(`[ExerciseParser] Retroactively parsed ${updated} entries`);
  }

  return updated;
}
