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

// ── Structured Exercise Data ───────────────────────────
export interface StructuredExercise {
  name: string;       // e.g., "Bench Press"
  weight?: number;    // in lbs
  sets: number[];     // reps per set, e.g., [8, 8, 5]
  notes?: string;
}

// ── Types ──────────────────────────────────────────────
export interface ExerciseEntry {
  id: string;
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

// ── RAG Types ──────────────────────────────────────────
export type RAGStatus = 'green' | 'yellow' | 'red' | 'gray';
export const RAG_COLORS: Record<RAGStatus, string> = {
  green:  'hsl(158,80%,42%)',
  yellow: 'hsl(42,92%,56%)',
  red:    'hsl(0,75%,55%)',
  gray:   'hsl(220,10%,45%)',
};

// ── Draft Queue (localStorage) ─────────────────────────
export interface DraftLogEntry {
  id: string;
  date: string;
  type: 'exercise' | 'nutrition';
  raw: string;
  parsedExercises?: ExerciseEntry[];
  parsedMeals?: NutritionEntry[];
  feedback?: string;
  createdAt: string;
}

const DRAFT_KEY = 'forge_draft_logs';

function loadDrafts(): DraftLogEntry[] {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]'); } catch { return []; }
}
function saveDrafts(drafts: DraftLogEntry[]) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

export function getDraftLogs(): DraftLogEntry[] { return loadDrafts(); }

export function addDraftLog(entry: DraftLogEntry) {
  const drafts = loadDrafts();
  drafts.push(entry);
  saveDrafts(drafts);
}

export function removeDraftLogs(ids: string[]) {
  const set = new Set(ids);
  saveDrafts(loadDrafts().filter(d => !set.has(d.id)));
}

// ── Sync Settings (localStorage) ──────────────────────
export interface SyncSettings {
  autoSyncHour: number;
}

const SYNC_SETTINGS_KEY = 'forge_sync_settings';
const DEFAULT_SYNC_SETTINGS: SyncSettings = { autoSyncHour: 21 };

export function getSyncSettings(): SyncSettings {
  try { return { ...DEFAULT_SYNC_SETTINGS, ...JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY) || '{}') }; }
  catch { return DEFAULT_SYNC_SETTINGS; }
}

export function saveSyncSettings(s: SyncSettings) {
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(s));
}

// ── Sync Lock (in-memory) ──────────────────────────────
let _syncLock = false;
export function acquireSyncLock(): boolean { if (_syncLock) return false; _syncLock = true; return true; }
export function releaseSyncLock() { _syncLock = false; }
export function isSyncLocked(): boolean { return _syncLock; }

// ── Structured Exercises Cache (localStorage) ──────────
// Stored separately to avoid Supabase schema changes
const SE_CACHE_KEY = 'forge_structured_exercises';

function loadSECache(): Record<string, StructuredExercise[]> {
  try { return JSON.parse(localStorage.getItem(SE_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveSECache(cache: Record<string, StructuredExercise[]>) {
  localStorage.setItem(SE_CACHE_KEY, JSON.stringify(cache));
}

function getStructuredExercisesForId(id: string): StructuredExercise[] | undefined {
  return loadSECache()[id];
}

function setStructuredExercisesForId(id: string, se: StructuredExercise[]) {
  const cache = loadSECache();
  cache[id] = se;
  saveSECache(cache);
}

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
  const entry: ExerciseEntry = {
    id: r.id, date: r.date, activityType: r.activity_type, workoutType: r.workout_type,
    duration: r.duration, exercises: r.exercises || undefined, sets: r.sets || undefined,
    reps: r.reps || undefined, weight: r.weight || undefined,
    miles: r.miles ? Number(r.miles) : undefined, averagePace: r.average_pace || undefined,
    runningType: r.running_type || undefined, notes: r.notes || undefined, createdAt: r.created_at,
  };
  const cached = getStructuredExercisesForId(r.id);
  if (cached) entry.structuredExercises = cached;
  return entry;
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
  const entry = mapExerciseRow(data);
  // Cache structured exercises if provided
  if (e.structuredExercises?.length) {
    setStructuredExercisesForId(entry.id, e.structuredExercises);
    entry.structuredExercises = e.structuredExercises;
  }
  return entry;
}

export async function deleteExerciseLog(id: string) {
  await supabase.from('exercise_logs').delete().eq('id', id);
  // Clean up local cache
  const cache = loadSECache();
  delete cache[id];
  saveSECache(cache);
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

// ── Deduplication ──────────────────────────────────────
export async function deduplicateLogs(): Promise<void> {
  const [exercises, nutrition] = await Promise.all([getExerciseLogs(), getNutritionLogs()]);

  // Deduplicate nutrition by content hash
  const nuSeen = new Map<string, string>(); // hash → id (earliest)
  const nuToDelete: string[] = [];
  for (const n of [...nutrition].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const hash = `${n.date}|${n.mealType}|${n.mealName}|${n.calories}|${n.protein}`;
    if (nuSeen.has(hash)) { nuToDelete.push(n.id); }
    else { nuSeen.set(hash, n.id); }
  }

  // Deduplicate exercise by content hash
  const exSeen = new Map<string, string>();
  const exToDelete: string[] = [];
  for (const e of [...exercises].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const hash = `${e.date}|${e.activityType}|${e.workoutType}|${e.duration}|${e.exercises || ''}`;
    if (exSeen.has(hash)) { exToDelete.push(e.id); }
    else { exSeen.set(hash, e.id); }
  }

  await Promise.all([
    ...nuToDelete.map(id => deleteNutritionLog(id)),
    ...exToDelete.map(id => deleteExerciseLog(id)),
  ]);
}

// ── Trailing 7-Day Stats ───────────────────────────────
export interface TrailingStats {
  // Workouts
  workoutDays: number;       // days with at least one workout
  totalWorkouts: number;
  workoutMinutes: number;
  workoutTypes: Partial<Record<ActivityType, number>>;
  // Nutrition
  avgDailyCalories: number;
  avgDailyProtein: number;
  nutritionDays: number;     // days with at least one meal
  // Streak
  currentStreak: number;
}

export async function getTrailing7DayStats(): Promise<TrailingStats> {
  const [exercises, nutrition] = await Promise.all([getExerciseLogs(), getNutritionLogs()]);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const recentEx = exercises.filter(e => e.date >= cutoffStr);
  const recentNu = nutrition.filter(n => n.date >= cutoffStr);

  const workoutDaySet = new Set(recentEx.map(e => e.date));
  const workoutTypes: Partial<Record<ActivityType, number>> = {};
  for (const e of recentEx) {
    workoutTypes[e.activityType] = (workoutTypes[e.activityType] || 0) + 1;
  }

  const nuDays = [...new Set(recentNu.map(n => n.date))];
  const totalCal = recentNu.reduce((s, n) => s + n.calories, 0);
  const totalPro = recentNu.reduce((s, n) => s + n.protein, 0);

  return {
    workoutDays: workoutDaySet.size,
    totalWorkouts: recentEx.length,
    workoutMinutes: recentEx.reduce((s, e) => s + (e.duration || 0), 0),
    workoutTypes,
    avgDailyCalories: nuDays.length > 0 ? Math.round(totalCal / nuDays.length) : 0,
    avgDailyProtein: nuDays.length > 0 ? Math.round(totalPro / nuDays.length) : 0,
    nutritionDays: nuDays.length,
    currentStreak: getCurrentStreak(exercises),
  };
}

// ── Monthly Stats (for bar chart) ─────────────────────
export interface MonthlyWeekStat {
  label: string;   // e.g. "Mar 24"
  workouts: number;
  avgProtein: number;
}

export async function getMonthlyStats(): Promise<MonthlyWeekStat[]> {
  const [exercises, nutrition] = await Promise.all([getExerciseLogs(), getNutritionLogs()]);

  const weeks: MonthlyWeekStat[] = [];
  for (let w = 3; w >= 0; w--) {
    const start = new Date();
    start.setDate(start.getDate() - (w + 1) * 7 + 1);
    const end = new Date();
    end.setDate(end.getDate() - w * 7);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const weekEx = exercises.filter(e => e.date >= startStr && e.date <= endStr);
    const weekNu = nutrition.filter(n => n.date >= startStr && n.date <= endStr);
    const nuDays = [...new Set(weekNu.map(n => n.date))];
    const totalPro = weekNu.reduce((s, n) => s + n.protein, 0);

    weeks.push({
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      workouts: weekEx.length,
      avgProtein: nuDays.length > 0 ? Math.round(totalPro / nuDays.length) : 0,
    });
  }
  return weeks;
}

// ── Calendar ───────────────────────────────────────────
export type DayLogStatus = 'both' | 'exercise' | 'nutrition' | 'none';

export interface CalendarDay {
  date: string;
  status: DayLogStatus;
  isToday: boolean;
  isCurrentMonth: boolean;
}

export async function getCalendarDays(year: number, month: number): Promise<CalendarDay[]> {
  const [exercises, nutrition] = await Promise.all([getExerciseLogs(), getNutritionLogs()]);
  const exDates = new Set(exercises.map(e => e.date));
  const nuDates = new Set(nutrition.map(n => n.date));
  const today = new Date().toISOString().split('T')[0];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days: CalendarDay[] = [];

  // Pad start
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() - i - 1);
    const ds = d.toISOString().split('T')[0];
    const hasEx = exDates.has(ds), hasNu = nuDates.has(ds);
    days.push({ date: ds, status: hasEx && hasNu ? 'both' : hasEx ? 'exercise' : hasNu ? 'nutrition' : 'none', isToday: ds === today, isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasEx = exDates.has(ds), hasNu = nuDates.has(ds);
    days.push({ date: ds, status: hasEx && hasNu ? 'both' : hasEx ? 'exercise' : hasNu ? 'nutrition' : 'none', isToday: ds === today, isCurrentMonth: true });
  }

  // Pad end to 42
  while (days.length < 42) {
    const last = new Date(days[days.length - 1].date + 'T12:00:00');
    last.setDate(last.getDate() + 1);
    const ds = last.toISOString().split('T')[0];
    const hasEx = exDates.has(ds), hasNu = nuDates.has(ds);
    days.push({ date: ds, status: hasEx && hasNu ? 'both' : hasEx ? 'exercise' : hasNu ? 'nutrition' : 'none', isToday: ds === today, isCurrentMonth: false });
  }

  return days;
}

export async function getDayLogStatus(date: string): Promise<{ exercises: ExerciseEntry[]; meals: NutritionEntry[]; coach: CoachInstruction[] }> {
  const [exercises, nutrition, coach] = await Promise.all([getExerciseLogs(), getNutritionLogs(), getCoachInstructions()]);
  return {
    exercises: exercises.filter(e => e.date === date),
    meals: nutrition.filter(n => n.date === date),
    coach: coach.filter(c => c.date === date || (c.weekStart && date >= c.weekStart && date <= addDays(c.weekStart, 6))),
  };
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ── RAG Indicators ─────────────────────────────────────
export function getProteinRAG(avgProtein: number): RAGStatus {
  if (avgProtein === 0) return 'gray';
  if (avgProtein >= 165) return 'green';
  if (avgProtein >= 130) return 'yellow';
  return 'red';
}

export function getWorkoutRAG(workoutDays: number): RAGStatus {
  if (workoutDays === 0) return 'gray';
  if (workoutDays >= 4) return 'green';
  if (workoutDays >= 2) return 'yellow';
  return 'red';
}

export function getCalorieRAG(avgCalories: number): RAGStatus {
  if (avgCalories === 0) return 'gray';
  if (avgCalories >= 2000 && avgCalories <= 2800) return 'green';
  if (avgCalories >= 1700 && avgCalories <= 3100) return 'yellow';
  return 'red';
}

export function getStreakRAG(streak: number): RAGStatus {
  if (streak === 0) return 'gray';
  if (streak >= 5) return 'green';
  if (streak >= 2) return 'yellow';
  return 'red';
}

// ── Exercise Progress (for drill-down) ─────────────────
export interface ExerciseProgressEntry {
  date: string;
  weight: number;
  sets: number[];
  totalVolume: number;
}

export async function getAllUniqueExerciseNames(): Promise<string[]> {
  const cache = loadSECache();
  const all = Object.values(cache).flat().map(se => se.name);
  return [...new Set(all)].sort();
}

export async function getExerciseProgress(exerciseName: string): Promise<ExerciseProgressEntry[]> {
  const cache = loadSECache();
  const results: ExerciseProgressEntry[] = [];

  for (const [, structuredExercises] of Object.entries(cache)) {
    const match = structuredExercises.find(se => se.name.toLowerCase() === exerciseName.toLowerCase());
    if (match && match.weight !== undefined && match.sets.length > 0) {
      // Need the date — look up from exercise logs (we'll get it from the exercise logs)
      results.push({
        date: '', // filled below
        weight: match.weight,
        sets: match.sets,
        totalVolume: match.weight * match.sets.reduce((s, r) => s + r, 0),
      });
    }
  }

  // Enrich with dates from exercise logs
  const exercises = await getExerciseLogs();
  const exerciseMap = new Map(exercises.map(e => [e.id, e.date]));
  const enriched: ExerciseProgressEntry[] = [];

  for (const [id, structuredExercises] of Object.entries(cache)) {
    const date = exerciseMap.get(id);
    if (!date) continue;
    const match = structuredExercises.find(se => se.name.toLowerCase() === exerciseName.toLowerCase());
    if (match && match.weight !== undefined && match.sets.length > 0) {
      enriched.push({
        date,
        weight: match.weight,
        sets: match.sets,
        totalVolume: match.weight * match.sets.reduce((s, r) => s + r, 0),
      });
    }
  }

  return enriched.sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
}

// ── Analytics Helpers ──────────────────────────────────
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
