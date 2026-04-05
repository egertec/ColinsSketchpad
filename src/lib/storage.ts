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
  name: string;
  weight?: number;
  sets: number[];
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
  rawText: string;
  tags: string[];
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

export function addDraftLog(rawText: string, tags: string[], date: string): DraftLogEntry {
  const entry: DraftLogEntry = {
    id: crypto.randomUUID(),
    date,
    type: tags.some(t => ['Lifting','Running','Soccer','Golf','Hiking','Biking','Skiing','Other'].includes(t)) ? 'exercise' : 'nutrition',
    rawText,
    tags,
    createdAt: new Date().toISOString(),
  };
  const drafts = loadDrafts();
  drafts.push(entry);
  saveDrafts(drafts);
  return entry;
}

export function removeDraftLogs(ids: string[]) {
  const set = new Set(ids);
  saveDrafts(loadDrafts().filter(d => !set.has(d.id)));
}

// ── Sync Settings (localStorage) ──────────────────────
export interface SyncSettings {
  cutoffHour: number;
  lastSyncDate?: string;
}

const SYNC_SETTINGS_KEY = 'forge_sync_settings';
const DEFAULT_SYNC_SETTINGS: SyncSettings = { cutoffHour: 21 };

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
const SE_CACHE_KEY = 'forge_structured_exercises';

function loadSECache(): Record<string, StructuredExercise[]> {
  try { return JSON.parse(localStorage.getItem(SE_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveSECache(cache: Record<string, StructuredExercise[]>) {
  localStorage.setItem(SE_CACHE_KEY, JSON.stringify(cache));
}

export function setStructuredExercisesForLog(id: string, se: StructuredExercise[]) {
  const cache = loadSECache();
  cache[id] = se;
  saveSECache(cache);
}

// ── Helpers ────────────────────────────────────────────
// Cached user ID to avoid repeated async calls within a single session
let _cachedUserId: string = '';

async function getUserIdAsync(): Promise<string> {
  if (_cachedUserId) return _cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  _cachedUserId = user?.id || '';
  return _cachedUserId;
}

// Listen for auth state changes to update cache
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUserId = session?.user?.id || '';
});

// Synchronous fallback for backward compat — reads from cache populated by async version
function getUserId(): string {
  return _cachedUserId;
}

function mapExerciseRow(r: any): ExerciseEntry {
  const entry: ExerciseEntry = {
    id: r.id, date: r.date, activityType: r.activity_type, workoutType: r.workout_type,
    duration: r.duration, exercises: r.exercises || undefined, sets: r.sets || undefined,
    reps: r.reps || undefined, weight: r.weight || undefined,
    miles: r.miles ? Number(r.miles) : undefined, averagePace: r.average_pace || undefined,
    runningType: r.running_type || undefined, notes: r.notes || undefined, createdAt: r.created_at,
  };
  const cache = loadSECache();
  if (cache[r.id]) entry.structuredExercises = cache[r.id];
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
  const userId = await getUserIdAsync();
  if (!userId) return DEFAULT_PROFILE;
  const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error || !data) return DEFAULT_PROFILE;
  return mapProfileRow(data);
}

export async function saveUserProfile(p: UserProfile): Promise<boolean> {
  const userId = await getUserIdAsync();
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
  const userId = await getUserIdAsync();
  if (!userId) return [];
  const { data, error } = await supabase.from('exercise_logs').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error || !data) return [];
  return data.map(mapExerciseRow);
}

export async function addExerciseLog(e: Omit<ExerciseEntry, 'id' | 'createdAt'>): Promise<ExerciseEntry> {
  const userId = await getUserIdAsync();
  const { data, error } = await supabase.from('exercise_logs').insert({
    user_id: userId, date: e.date, activity_type: e.activityType, workout_type: e.workoutType,
    duration: e.duration, exercises: e.exercises || null, sets: e.sets || null,
    reps: e.reps || null, weight: e.weight || null, miles: e.miles || null,
    average_pace: e.averagePace || null, running_type: e.runningType || null, notes: e.notes || null,
  }).select().single();
  if (error || !data) throw new Error(error?.message || 'Failed to add exercise log');
  const entry = mapExerciseRow(data);
  if (e.structuredExercises?.length) {
    setStructuredExercisesForLog(entry.id, e.structuredExercises);
    entry.structuredExercises = e.structuredExercises;
  }
  return entry;
}

export async function deleteExerciseLog(id: string) {
  const userId = await getUserIdAsync();
  await supabase.from('exercise_logs').delete().eq('id', id).eq('user_id', userId);
  const cache = loadSECache();
  delete cache[id];
  saveSECache(cache);
}

// ── Nutrition CRUD ─────────────────────────────────────
export async function getNutritionLogs(): Promise<NutritionEntry[]> {
  const userId = await getUserIdAsync();
  if (!userId) return [];
  const { data, error } = await supabase.from('nutrition_logs').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error || !data) return [];
  return data.map(mapNutritionRow);
}

export async function addNutritionLog(e: Omit<NutritionEntry, 'id' | 'createdAt'>): Promise<NutritionEntry> {
  const userId = await getUserIdAsync();
  const { data, error } = await supabase.from('nutrition_logs').insert({
    user_id: userId, date: e.date, meal_type: e.mealType, meal_name: e.mealName,
    calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber,
  }).select().single();
  if (error || !data) throw new Error(error?.message || 'Failed to add nutrition log');
  return mapNutritionRow(data);
}

export async function deleteNutritionLog(id: string) {
  const userId = await getUserIdAsync();
  await supabase.from('nutrition_logs').delete().eq('id', id).eq('user_id', userId);
}

// ── Coach Instructions CRUD ────────────────────────────
export async function getCoachInstructions(): Promise<CoachInstruction[]> {
  const userId = await getUserIdAsync();
  if (!userId) return [];
  const { data, error } = await supabase.from('coach_instructions').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error || !data) return [];
  return data.map(mapCoachRow);
}

export async function addCoachInstruction(e: Omit<CoachInstruction, 'id' | 'createdAt'>): Promise<CoachInstruction> {
  const userId = await getUserIdAsync();
  const { data, error } = await supabase.from('coach_instructions').insert({
    user_id: userId, date: e.date, type: e.type, title: e.title,
    body: e.body, week_start: e.weekStart || null,
  }).select().single();
  if (error || !data) throw new Error(error?.message || 'Failed to add coach instruction');
  return mapCoachRow(data);
}

export async function deleteCoachInstruction(id: string) {
  const userId = await getUserIdAsync();
  await supabase.from('coach_instructions').delete().eq('id', id).eq('user_id', userId);
}

// ── Deduplication ──────────────────────────────────────
export async function deduplicateLogs(): Promise<void> {
  const [exercises, nutrition] = await Promise.all([getExerciseLogs(), getNutritionLogs()]);

  const nuSeen = new Map<string, string>();
  const nuToDelete: string[] = [];
  for (const n of [...nutrition].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const hash = `${n.date}|${n.mealType}|${n.mealName}|${n.calories}|${n.protein}`;
    if (nuSeen.has(hash)) { nuToDelete.push(n.id); }
    else { nuSeen.set(hash, n.id); }
  }

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

// ── Trailing 7-Day Stats (synchronous, takes pre-fetched data) ─
export interface TrailingStats {
  totalWorkouts: number;
  workoutMinutes: number;
  totalMinutes: number;
  workoutTypes: Partial<Record<ActivityType, number>>;
  avgDailyCalories: number;
  avgDailyProtein: number;
  nutritionDays: number;
  streak: number;
  proteinByDay: { date: string; value: number }[];
  workoutsByDay: { date: string; types: ActivityType[] }[];
}

export function getTrailing7DayStats(exercises: ExerciseEntry[], nutrition: NutritionEntry[]): TrailingStats {
  const dates = getLast7Dates();
  const cutoffStr = dates[0];

  const recentEx = exercises.filter(e => e.date >= cutoffStr);
  const recentNu = nutrition.filter(n => n.date >= cutoffStr);

  const workoutTypes: Partial<Record<ActivityType, number>> = {};
  for (const e of recentEx) {
    workoutTypes[e.activityType] = (workoutTypes[e.activityType] || 0) + 1;
  }

  const nuDays = [...new Set(recentNu.map(n => n.date))];
  const totalCal = recentNu.reduce((s, n) => s + n.calories, 0);
  const totalPro = recentNu.reduce((s, n) => s + n.protein, 0);
  const totalMinutes = recentEx.reduce((s, e) => s + (e.duration || 0), 0);

  // Per-day protein breakdown
  const proteinByDay = dates.map(date => {
    const dayMeals = recentNu.filter(n => n.date === date);
    return { date, value: dayMeals.reduce((s, m) => s + m.protein, 0) };
  });

  // Per-day workout types
  const workoutsByDay = dates.map(date => {
    const dayEx = recentEx.filter(e => e.date === date);
    return { date, types: dayEx.map(e => e.activityType) };
  });

  return {
    totalWorkouts: recentEx.length,
    workoutMinutes: totalMinutes,
    totalMinutes,
    workoutTypes,
    avgDailyCalories: nuDays.length > 0 ? Math.round(totalCal / nuDays.length) : 0,
    avgDailyProtein: nuDays.length > 0 ? Math.round(totalPro / nuDays.length) : 0,
    nutritionDays: nuDays.length,
    streak: getCurrentStreak(exercises),
    proteinByDay,
    workoutsByDay,
  };
}

// ── Monthly Stats (synchronous, takes pre-fetched data) ─
export interface MonthlyWeekStat {
  weekLabel: string;
  workouts: number;
  avgProtein: number;
  totalMinutes: number;
}

export function getMonthlyStats(exercises: ExerciseEntry[], nutrition: NutritionEntry[]): MonthlyWeekStat[] {
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
    const totalMin = weekEx.reduce((s, e) => s + (e.duration || 0), 0);

    weeks.push({
      weekLabel: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      workouts: weekEx.length,
      avgProtein: nuDays.length > 0 ? Math.round(totalPro / nuDays.length) : 0,
      totalMinutes: totalMin,
    });
  }
  return weeks;
}

// ── Calendar (synchronous, takes pre-built maps) ───────
export type DayLogStatus = 'both' | 'exercise' | 'nutrition' | 'none';

export function getCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days: (string | null)[] = [];

  for (let i = 0; i < startPad; i++) days.push(null);

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  while (days.length % 7 !== 0) days.push(null);

  return days;
}

export function getDayLogStatus(
  date: string,
  exByDate: Record<string, ExerciseEntry[]>,
  nuByDate: Record<string, NutritionEntry[]>,
): DayLogStatus {
  const hasEx = !!(exByDate[date]?.length);
  const hasNu = !!(nuByDate[date]?.length);
  if (hasEx && hasNu) return 'both';
  if (hasEx) return 'exercise';
  if (hasNu) return 'nutrition';
  return 'none';
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

// ── Exercise Progress (synchronous, takes pre-fetched logs) ─
export interface ExerciseProgressEntry {
  date: string;
  weight: number;
  sets: number[];
  totalVolume: number;
}

export function getExerciseProgress(allLogs: ExerciseEntry[], exerciseName: string): ExerciseProgressEntry[] {
  const cache = loadSECache();
  const results: ExerciseProgressEntry[] = [];

  for (const log of allLogs) {
    const structuredExercises = log.structuredExercises || cache[log.id];
    if (!structuredExercises) continue;

    const match = structuredExercises.find(se => se.name.toLowerCase() === exerciseName.toLowerCase());
    if (match && match.weight !== undefined && match.sets.length > 0) {
      results.push({
        date: log.date,
        weight: match.weight,
        sets: match.sets,
        totalVolume: match.weight * match.sets.reduce((s, r) => s + r, 0),
      });
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
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
