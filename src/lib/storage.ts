import { supabase } from './supabase';

// ── Activity Types ─────────────────────────────────────
export const ACTIVITY_TYPES = ['Lifting', 'Running', 'Soccer', 'Golf', 'Hiking', 'Biking', 'Skiing', 'Other'] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

export const ACTIVITY_META: Record<ActivityType, { icon: string; color: string }> = {
  Lifting: { icon: '🏋️', color: 'hsl(158,80%,42%)' },
  Running: { icon: '🏃', color: 'hsl(195,85%,48%)' },
  Soccer:  { icon: '⚽', color: 'hsl(42,92%,56%)' },
  Golf:    { icon: '⛳', color: 'hsl(140,60%,50%)' },
  Hiking:  { icon: '🥾', color: 'hsl(28,80%,55%)' },
  Biking:  { icon: '🚴', color: 'hsl(340,70%,55%)' },
  Skiing:  { icon: '⛷️', color: 'hsl(210,80%,65%)' },
  Other:   { icon: '💪', color: 'hsl(275,65%,58%)' },
};

// ── Types ──────────────────────────────────────────────
export interface ExerciseEntry {
  id: string;
  date: string;
  activityType: ActivityType;
  workoutType: string;
  duration: number;
  exercises?: string;
  sets?: string;
  reps?: string;
  weight?: string;
  miles?: number;
  averagePace?: string;
  runningType?: string;
  notes?: string;
  createdAt: string;
}

export interface NutritionEntry {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  createdAt: string;
}

export interface CoachInstruction {
  id: string;
  date: string;
  type: 'weekly' | 'daily';
  title: string;
  body: string;
  weekStart?: string;
  createdAt: string;
}

export interface UserProfile {
  currentWeight: string;
  goalWeight: string;
  fitnessGoals: string;
  physique: string;
  supplements: string;
  equipment: string;
  weeklyCommitments: string;
  proteinTarget: string;
  dietaryPreferences: string;
  injuries: string;
  additionalNotes: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  currentWeight: '~165 lbs',
  goalWeight: '170 lbs lean',
  fitnessGoals: 'Body recomposition to 170 lbs with visible 6-pack and improved muscle definition',
  physique: 'Muscular with a 4-pack, strong lifting and running base',
  supplements: 'Creatine daily',
  equipment: 'Dumbbells & bench, Smith machine, leg press, chest press machine, lat pulldown, leg extension, treadmills, StairMasters, stationary bikes, yoga room',
  weeklyCommitments: 'Tuesday reserved for ~1 hour of soccer',
  proteinTarget: '165-180g/day',
  dietaryPreferences: 'High-protein, whole foods. Shops at Whole Foods.',
  injuries: 'None currently',
  additionalNotes: '',
};

// ── Helpers ────────────────────────────────────────────
function getUserId(): string {
  const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  if (storageKey) {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return data?.user?.id || '';
    } catch { /* fall through */ }
  }
  return '';
}

function mapExerciseRow(r: any): ExerciseEntry {
  return {
    id: r.id, date: r.date, activityType: r.activity_type, workoutType: r.workout_type,
    duration: r.duration, exercises: r.exercises || undefined, sets: r.sets || undefined,
    reps: r.reps || undefined, weight: r.weight || undefined,
    miles: r.miles ? Number(r.miles) : undefined, averagePace: r.average_pace || undefined,
    runningType: r.running_type || undefined, notes: r.notes || undefined, createdAt: r.created_at,
  };
}

function mapNutritionRow(r: any): NutritionEntry {
  return {
    id: r.id, date: r.date, mealType: r.meal_type, mealName: r.meal_name,
    calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat,
    fiber: r.fiber, createdAt: r.created_at,
  };
}

function mapCoachRow(r: any): CoachInstruction {
  return {
    id: r.id, date: r.date, type: r.type, title: r.title,
    body: r.body, weekStart: r.week_start || undefined, createdAt: r.created_at,
  };
}

function mapProfileRow(r: any): UserProfile {
  return {
    currentWeight: r.current_weight || '', goalWeight: r.goal_weight || '',
    fitnessGoals: r.fitness_goals || '', physique: r.physique || '',
    supplements: r.supplements || '', equipment: r.equipment || '',
    weeklyCommitments: r.weekly_commitments || '', proteinTarget: r.protein_target || '',
    dietaryPreferences: r.dietary_preferences || '', injuries: r.injuries || '',
    additionalNotes: r.additional_notes || '',
  };
}

// ── User Profile ───────────────────────────────────────
export async function getUserProfile(): Promise<UserProfile> {
  const userId = getUserId();
  if (!userId) return DEFAULT_PROFILE;
  const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error || !data) return DEFAULT_PROFILE;
  return mapProfileRow(data);
}

export async function saveUserProfile(p: UserProfile): Promise<boolean> {
  const userId = getUserId();
  if (!userId) return false;
  const { error } = await supabase.from('user_profiles').upsert({
    user_id: userId, current_weight: p.currentWeight, goal_weight: p.goalWeight,
    fitness_goals: p.fitnessGoals, physique: p.physique, supplements: p.supplements,
    equipment: p.equipment, weekly_commitments: p.weeklyCommitments,
    protein_target: p.proteinTarget, dietary_preferences: p.dietaryPreferences,
    injuries: p.injuries, additional_notes: p.additionalNotes,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  return !error;
}

// ── Exercise CRUD ──────────────────────────────────────
export async function getExerciseLogs(): Promise<ExerciseEntry[]> {
  const userId = getUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('exercise_logs').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error || !data) return [];
  return data.map(mapExerciseRow);
}

export async function addExerciseLog(e: Omit<ExerciseEntry, 'id' | 'createdAt'>): Promise<ExerciseEntry> {
  const userId = getUserId();
  const { data, error } = await supabase.from('exercise_logs').insert({
    user_id: userId, date: e.date, activity_type: e.activityType, workout_type: e.workoutType,
    duration: e.duration, exercises: e.exercises || null, sets: e.sets || null,
    reps: e.reps || null, weight: e.weight || null, miles: e.miles || null,
    average_pace: e.averagePace || null, running_type: e.runningType || null, notes: e.notes || null,
  }).select().single();
  if (error || !data) throw new Error(error?.message || 'Failed to add exercise log');
  return mapExerciseRow(data);
}

export async function deleteExerciseLog(id: string) {
  await supabase.from('exercise_logs').delete().eq('id', id);
}

// ── Nutrition CRUD ─────────────────────────────────────
export async function getNutritionLogs(): Promise<NutritionEntry[]> {
  const userId = getUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('nutrition_logs').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error || !data) return [];
  return data.map(mapNutritionRow);
}

export async function addNutritionLog(e: Omit<NutritionEntry, 'id' | 'createdAt'>): Promise<NutritionEntry> {
  const userId = getUserId();
  const { data, error } = await supabase.from('nutrition_logs').insert({
    user_id: userId, date: e.date, meal_type: e.mealType, meal_name: e.mealName,
    calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber,
  }).select().single();
  if (error || !data) throw new Error(error?.message || 'Failed to add nutrition log');
  return mapNutritionRow(data);
}

export async function deleteNutritionLog(id: string) {
  await supabase.from('nutrition_logs').delete().eq('id', id);
}

// ── Coach Instructions CRUD ────────────────────────────
export async function getCoachInstructions(): Promise<CoachInstruction[]> {
  const userId = getUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from('coach_instructions').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error || !data) return [];
  return data.map(mapCoachRow);
}

export async function addCoachInstruction(e: Omit<CoachInstruction, 'id' | 'createdAt'>): Promise<CoachInstruction> {
  const userId = getUserId();
  const { data, error } = await supabase.from('coach_instructions').insert({
    user_id: userId, date: e.date, type: e.type, title: e.title,
    body: e.body, week_start: e.weekStart || null,
  }).select().single();
  if (error || !data) throw new Error(error?.message || 'Failed to add coach instruction');
  return mapCoachRow(data);
}

export async function deleteCoachInstruction(id: string) {
  await supabase.from('coach_instructions').delete().eq('id', id);
}

// ── Analytics helpers ──────────────────────────────────
export function getRecentExerciseStats(logs: ExerciseEntry[], days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cs = cutoff.toISOString().split('T')[0];
  const recent = logs.filter(l => l.date >= cs);
  const byType: Partial<Record<ActivityType, number>> = {};
  for (const r of recent) {
    if (!byType[r.activityType]) byType[r.activityType] = 0;
    byType[r.activityType]!++;
  }
  return {
    totalWorkouts: recent.length,
    totalMinutes: recent.reduce((s, l) => s + (l.duration || 0), 0),
    totalMiles: recent.filter(l => l.miles).reduce((s, l) => s + (l.miles || 0), 0),
    byType,
    uniqueDays: new Set(recent.map(l => l.date)).size,
  };
}

export function getCurrentStreak(logs: ExerciseEntry[]): number {
  if (!logs.length) return 0;
  const dates = [...new Set(logs.map(l => l.date))].sort((a, b) => b.localeCompare(a));
  let streak = 0;
  const check = new Date();
  for (let i = 0; i < 90; i++) {
    const ds = check.toISOString().split('T')[0];
    if (dates.includes(ds)) { streak++; }
    else if (i > 0) break;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

export function getLast7Dates(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

export function getDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export function formatDateHeader(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yest = new Date(Date.now() - 864e5).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yest) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
