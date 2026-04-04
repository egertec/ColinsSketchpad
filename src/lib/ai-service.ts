import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import type { ExerciseEntry, NutritionEntry, CoachInstruction, UserProfile, ActivityType, StructuredExercise } from './storage';

async function callClaude(system: string, userMsg: string, maxTokens = 2000): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ system, userMsg, maxTokens }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI proxy error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.content;
}

function cleanJSON(raw: string): string {
  return raw.replace(/```json|```/g, '').trim();
}

function profileToPrompt(p: UserProfile): string {
  return `COLIN'S PROFILE:
- Current weight: ${p.currentWeight}
- Goal: ${p.fitnessGoals}
- Goal weight: ${p.goalWeight}
- Current physique: ${p.physique}
- Supplements: ${p.supplements}
- Equipment: ${p.equipment}
- Weekly commitments: ${p.weeklyCommitments}
- Protein target: ${p.proteinTarget}
- Dietary preferences: ${p.dietaryPreferences}
- Injuries/limitations: ${p.injuries}${p.additionalNotes ? `\n- Additional notes: ${p.additionalNotes}` : ''}`;
}

// ── Parse natural language log ─────────────────────────
export interface ParseResult {
  exercises: {
    date: string;
    activityType: ActivityType;
    workoutType: string;
    duration: number;
    exercises?: string;
    structuredExercises?: StructuredExercise[];
    sets?: string;
    reps?: string;
    weight?: string;
    miles?: number;
    averagePace?: string;
    runningType?: string;
    notes?: string;
  }[];
  meals: {
    date: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    mealName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }[];
  feedback: string;
}

export async function parseNaturalLanguageLog(input: string, profile: UserProfile): Promise<ParseResult> {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0];

  const sys = `You are a fitness data parser. Parse the user's natural language about workouts and/or meals into structured JSON.

RULES:
- No date mentioned → assume today (${today}).
- Relative dates: "yesterday" → ${yesterday}, "today" → ${today}, "last Monday" / "two days ago" / "Wednesday" etc. → resolve to the correct date relative to today (${today}, which is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}).
- Nutrition: estimate calories, protein, carbs, fat, fiber accurately using common food databases, restaurant menus, standard portions.
- Exercise activityType must be one of: "Lifting", "Running", "Soccer", "Golf", "Hiking", "Biking", "Skiing", "Other"
- Running: include miles, pace, classify runningType (Steady State, Interval Running, Tempo, Recovery Run, Other)
- Lifting: extract exercises, sets, reps, weight. ALSO provide structuredExercises array with individual lift data.
- For non-Lifting/Running activities (Soccer, Golf, Hiking, Biking, Skiing, Other): set workoutType to a descriptive name, estimate duration, include miles if applicable (hiking, biking), and add any relevant notes
- Provide 2-3 sentence feedback on alignment with goals: ${profile.proteinTarget} daily protein, ${profile.fitnessGoals}

IMPORTANT: For Lifting exercises, you MUST include the "structuredExercises" array with each individual exercise broken down:
- "name": Canonical exercise name (e.g., "Bench Press", "Overhead Press", "Barbell Squat", "Lat Pulldown", "Cable Fly", "Pull-ups")
- "weight": Weight in lbs (number, omit if bodyweight)
- "sets": Array of reps per set (e.g., [8, 8, 8] for 3 sets of 8, or [8, 8, 5] if last set was lower)
- "notes": Optional notes about the exercise

Respond ONLY with valid JSON:
{"exercises":[{"date":"YYYY-MM-DD","activityType":"Lifting|Running|Soccer|Golf|Hiking|Biking|Skiing|Other","workoutType":"name","duration":60,"exercises":"comma-separated or null","structuredExercises":[{"name":"Bench Press","weight":185,"sets":[8,8,8]},{"name":"Pull-ups","sets":[10,10,10]}],"sets":"comma-separated or null","reps":"comma-separated or null","weight":"comma-separated lbs or null","miles":null,"averagePace":null,"runningType":null,"notes":""}],"meals":[{"date":"YYYY-MM-DD","mealType":"breakfast|lunch|dinner|snack","mealName":"description","calories":500,"protein":40,"carbs":50,"fat":15,"fiber":5}],"feedback":"assessment"}

Empty arrays are fine if only exercise or only nutrition provided. Parse EACH activity as a separate exercise entry.`;

  const raw = await callClaude(sys, input);
  return JSON.parse(cleanJSON(raw));
}

// ── Generate weekly plan ───────────────────────────────
export async function generateWeeklyPlan(
  exerciseLogs: ExerciseEntry[],
  nutritionLogs: NutritionEntry[],
  priorInstructions: CoachInstruction[],
  profile: UserProfile,
): Promise<string> {
  const recentEx = exerciseLogs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 21);
  const recentNu = nutritionLogs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  const priorWeekly = priorInstructions.filter(i => i.type === 'weekly').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const exSummary = recentEx.length > 0
    ? recentEx.map(e => `${e.date}: ${e.activityType} - ${e.workoutType} (${e.duration}min)${e.exercises ? ` [${e.exercises}]` : ''}${e.miles ? ` ${e.miles}mi` : ''}`).join('\n')
    : 'No exercise logs yet.';

  const nuDates = [...new Set(recentNu.map(n => n.date))].slice(0, 7);
  const nuSummary = nuDates.length > 0
    ? nuDates.map(d => {
      const meals = recentNu.filter(n => n.date === d);
      return `${d}: ${meals.reduce((s, m) => s + m.calories, 0)}cal, ${meals.reduce((s, m) => s + m.protein, 0)}g protein (${meals.length} meals)`;
    }).join('\n')
    : 'No nutrition logs yet.';

  const priorSummary = priorWeekly.length > 0 ? priorWeekly.map(p => `[${p.date}] ${p.title}`).join('\n') : 'No prior weekly plans.';

  const today = new Date();
  const dow = today.getDay();
  const mondayOff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + mondayOff);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(nextMonday); d.setDate(nextMonday.getDate() + i);
    return { date: d.toISOString().split('T')[0], day: d.toLocaleDateString('en-US', { weekday: 'long' }) };
  });

  const sys = `You are Colin's elite personal fitness coach. Generate a complete 7-day training and nutrition plan.

${profileToPrompt(profile)}

PROGRESSION RULES:
- Strength: Double progression — increase reps within range before increasing load. Only increase weight when all sets hit top of rep range with 1-2 RIR.
- Running: Adjust one variable per week (duration, pace, or intensity)
- Every 4-6 weeks, program a deload week (reduce volume 30-40%)

RESPONSE FORMAT:
Write a complete, motivating coaching plan in plain text with clear headers:
1. CONTINUITY OPENING — reference prior week's focus and logged performance
2. 7-DAY TRAINING PLAN — Day 1 through Day 7 with exercises, sets, reps, rest, intent
3. NUTRITION PLAN — Breakfast, lunch, dinner, snacks for the week
4. GROCERY LIST — categorized
5. WEEKLY FOCUS — one habit/recovery/performance cue

Conversational, confident, actionable. No questions.`;

  const userMsg = `Generate this week's plan.

RECENT EXERCISE LOGS:\n${exSummary}

RECENT NUTRITION (daily totals):\n${nuSummary}

PRIOR WEEKLY PLANS:\n${priorSummary}

This week covers: ${weekDates.map(d => `${d.day} ${d.date}`).join(', ')}`;

  return await callClaude(sys, userMsg, 4000);
}

// ── Generate daily briefing ────────────────────────────
export async function generateDailyBriefing(
  exerciseLogs: ExerciseEntry[],
  nutritionLogs: NutritionEntry[],
  currentWeeklyPlan: CoachInstruction | null,
  profile: UserProfile,
): Promise<string> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 864e5).toISOString().split('T')[0];
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

  const yesterdayEx = exerciseLogs.filter(e => e.date === yesterdayStr);
  const yesterdayNu = nutritionLogs.filter(n => n.date === yesterdayStr);

  const yExSummary = yesterdayEx.length > 0
    ? yesterdayEx.map(e => `${e.activityType}: ${e.workoutType} (${e.duration}min)${e.exercises ? ` — ${e.exercises}` : ''}${e.miles ? ` ${e.miles}mi` : ''}`).join('\n')
    : 'No exercise logged yesterday.';

  const yNuSummary = yesterdayNu.length > 0
    ? `${yesterdayNu.reduce((s, m) => s + m.calories, 0)} total cal, ${yesterdayNu.reduce((s, m) => s + m.protein, 0)}g protein\n${yesterdayNu.map(m => `${m.mealType}: ${m.mealName} (${m.calories}cal, ${m.protein}gP)`).join('\n')}`
    : 'No nutrition logged yesterday.';

  const weeklyContext = currentWeeklyPlan ? `CURRENT WEEKLY PLAN:\n${currentWeeklyPlan.body.slice(0, 2000)}` : 'No weekly plan generated yet.';
  const recent3 = exerciseLogs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(e => `${e.date}: ${e.activityType} - ${e.workoutType}`).join('\n');

  const sys = `You are Colin's daily fitness accountability coach. Generate today's briefing.

${profileToPrompt(profile)}

RESPONSE FORMAT (plain text, scannable with emoji headers):

🔥 YESTERDAY'S RECAP — Brief summary of yesterday's workout and nutrition with feedback.
💪 TODAY'S WORKOUT — ${dayName} — The specific workout for today from the weekly plan. Include exercises, sets, reps, rest.
🎯 NUTRITION FOCUS — Protein target reminder and one meal suggestion.
⚡ COACH'S NOTE — One motivating insight based on the data.

Keep it SHORT, punchy, mobile-friendly.`;

  const userMsg = `Generate today's briefing for ${dayName}, ${todayStr}.

YESTERDAY'S EXERCISE:\n${yExSummary}
YESTERDAY'S NUTRITION:\n${yNuSummary}
RECENT ACTIVITY:\n${recent3 || 'None logged yet.'}
${weeklyContext}`;

  return await callClaude(sys, userMsg, 1500);
}
