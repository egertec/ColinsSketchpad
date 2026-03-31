import type { StructuredExercise, ExerciseEntry } from './storage';
import { getExerciseLogs, setExerciseLogs } from './storage';

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

  // Split by comma, semicolon, or " / " or " + "
  const segments = raw.split(/[,;]|\s+\/\s+|\s+\+\s+/).map(s => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const exercise = parseSingleExercise(seg);
    if (exercise) results.push(exercise);
  }

  return results;
}

function parseSingleExercise(seg: string): StructuredExercise | null {
  // Pattern: "Name Weight×Reps×Sets" or "Name WeightxRepsxSets"
  // Also: "Name SetsxReps" (no weight)
  // Also: "Name Weight×R1/R2/R3" (variable reps)

  const sep = /[×x]/gi;

  // Try: "Name Weight×Reps×Sets"
  // Match: word chars + spaces, then digits with optional unit, then × patterns
  const match1 = seg.match(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:lbs?|lb)?\s*[×x]\s*(\d+)\s*[×x]\s*(\d+)$/i
  );
  if (match1) {
    const [, name, weightStr, repsStr, setsStr] = match1;
    const weight = parseFloat(weightStr);
    const reps = parseInt(repsStr);
    const numSets = parseInt(setsStr);
    return {
      name: cleanName(name),
      weight,
      sets: Array(numSets).fill(reps),
    };
  }

  // Try: "Name SetsxReps" (no weight, e.g., "Pull-ups 3x10")
  const match2 = seg.match(
    /^(.+?)\s+(\d+)\s*[×x]\s*(\d+)$/i
  );
  if (match2) {
    const [, name, firstNum, secondNum] = match2;
    const n1 = parseInt(firstNum);
    const n2 = parseInt(secondNum);
    // Heuristic: if first number is small (1-6), it's sets×reps
    // If first number is large, it's weight×reps (ambiguous)
    if (n1 <= 6) {
      return { name: cleanName(name), sets: Array(n1).fill(n2) };
    } else {
      // Likely Weight×Reps with no set count — assume 1 set
      return { name: cleanName(name), weight: n1, sets: [n2] };
    }
  }

  // Try: "Name Weight×R1/R2/R3" (variable reps per set)
  const match3 = seg.match(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:lbs?|lb)?\s*[×x]\s*([\d/]+)$/i
  );
  if (match3) {
    const [, name, weightStr, repsStr] = match3;
    const weight = parseFloat(weightStr);
    const sets = repsStr.split('/').map(r => parseInt(r)).filter(n => !isNaN(n));
    if (sets.length > 0) {
      return { name: cleanName(name), weight, sets };
    }
  }

  // Fallback: just capture the name
  const nameOnly = seg.replace(/\s*\(.*?\)\s*/g, '').trim();
  if (nameOnly.length > 1 && nameOnly.length < 60) {
    return { name: cleanName(nameOnly), sets: [] };
  }

  return null;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^\d+\.\s*/, '') // Remove leading "1. "
    .trim();
}

/**
 * Normalize exercise names for consistent matching.
 * Maps common abbreviations and variations to canonical names.
 */
const NAME_MAP: Record<string, string> = {
  'bench': 'Bench Press',
  'bench press': 'Bench Press',
  'flat bench': 'Bench Press',
  'incline bench': 'Incline Bench Press',
  'incline db press': 'Incline DB Press',
  'incline dumbbell press': 'Incline DB Press',
  'ohp': 'Overhead Press',
  'overhead press': 'Overhead Press',
  'military press': 'Overhead Press',
  'squat': 'Barbell Squat',
  'squats': 'Barbell Squat',
  'barbell squat': 'Barbell Squat',
  'barbell squats': 'Barbell Squat',
  'deadlift': 'Deadlift',
  'deadlifts': 'Deadlift',
  'rows': 'Barbell Row',
  'barbell rows': 'Barbell Row',
  'barbell row': 'Barbell Row',
  'lat pulldown': 'Lat Pulldown',
  'lat pulldowns': 'Lat Pulldown',
  'pull-ups': 'Pull-ups',
  'pullups': 'Pull-ups',
  'pull ups': 'Pull-ups',
  'cable fly': 'Cable Fly',
  'cable flys': 'Cable Fly',
  'cable flies': 'Cable Fly',
  'leg press': 'Leg Press',
  'leg extension': 'Leg Extension',
  'leg extensions': 'Leg Extension',
  'leg curl': 'Leg Curl',
  'leg curls': 'Leg Curl',
  'chest press': 'Chest Press',
  'dumbbell curl': 'Dumbbell Curl',
  'curls': 'Dumbbell Curl',
  'bicep curls': 'Dumbbell Curl',
  'tricep pushdown': 'Tricep Pushdown',
  'tricep pushdowns': 'Tricep Pushdown',
};

export function normalizeExerciseName(name: string): string {
  const lower = name.toLowerCase().trim();
  return NAME_MAP[lower] || name;
}

/**
 * Retroactively parse structured exercises from existing freeform data.
 * Only processes entries that don't already have structuredExercises.
 */
export async function retroParseExercises(): Promise<number> {
  const logs = await getExerciseLogs();
  let updated = 0;

  for (const log of logs) {
    if (log.structuredExercises && log.structuredExercises.length > 0) continue;
    if (!log.exercises) continue;

    const parsed = parseExerciseString(log.exercises);
    if (parsed.length > 0) {
      // Normalize names
      log.structuredExercises = parsed.map(p => ({
        ...p,
        name: normalizeExerciseName(p.name),
      }));
      updated++;
    }
  }

  if (updated > 0) {
    await setExerciseLogs(logs);
    console.log(`[ExerciseParser] Retroactively parsed ${updated} entries`);
  }

  return updated;
}
