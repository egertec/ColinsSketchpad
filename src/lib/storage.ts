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

// ── Structured Exercise Data ──────────────────────────
export interface StructuredExercise {
  name: string;           // e.g., "Bench Press"
  weight?: number;        // in lbs
  sets: number[];         // reps per set, e.g., [8, 8, 5]
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
  structuredExercises?: StructuredExercise[];  // NEW: parsed lift data
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
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

async function sGet(key: string): Promise<any | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).storage?.get) {
      const r = await (window as any).storage.get(key);
      return r ? JSON.parse(r.value) : null;
    }
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

async function sSet(key: string, val: any): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && (window as any).storage?.set) {
      await (window as any).storage.set(key, JSON.stringify(val));
      return true;
    }
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  }
  catch (e) { console.error('storage set:', e); return false; }
}

// ── Sync Lock ─────────────────────────────────────────
let _syncLock = false;

export function acquireSyncLock(): boolean {
  if (_syncLock) return false;
  _syncLock = true;
  return true;
}

export function releaseSyncLock(): void {
  _syncLock = false;
}

export function isSyncLocked(): boolean {
  return _syncLock;
}

// ── User Profile ───────────────────────────────────────
export async function getUserProfile(): Promise<UserProfile> {
  return (await sGet('user-profile')) || DEFAULT_PROFILE;
}
export async function saveUserProfile(p: UserProfile): Promise<boolean> {
  return sSet('user-profile', p);
}

// ── Exercise CRUD ──────────────────────────────────────
export async function getExerciseLogs(): Promise<ExerciseEntry[]> {
  return (await sGet('ex-logs')) || [];
}
export async function addExerciseLog(e: Omit<ExerciseEntry, 'id' | 'createdAt'>): Promise<ExerciseEntry> {
  const logs = await getExerciseLogs();
  const entry: ExerciseEntry = { ...e, id: uid(), createdAt: new Date().toISOString() };
  logs.push(entry);
  await sSet('ex-logs', logs);
  return entry;
}
export async function deleteExerciseLog(id: string) {
  const logs = await getExerciseLogs();
  await sSet('ex-logs', logs.filter(l => l.id !== id));
}
export async function setExerciseLogs(logs: ExerciseEntry[]): Promise<boolean> {
  return sSet('ex-logs', logs);
}

// ── Nutrition CRUD ─────────────────────────────────────
export async function getNutritionLogs(): Promise<NutritionEntry[]> {
  return (await sGet('nu-logs')) || [];
}
export async function addNutritionLog(e: Omit<NutritionEntry, 'id' | 'createdAt'>): Promise<NutritionEntry> {
  const logs = await getNutritionLogs();
  const entry: NutritionEntry = { ...e, id: uid(), createdAt: new Date().toISOString() };
  logs.push(entry);
  await sSet('nu-logs', logs);
  return entry;
}
export async function deleteNutritionLog(id: string) {
  const logs = await getNutritionLogs();
  await sSet('nu-logs', logs.filter(l => l.id !== id));
}
export async function setNutritionLogs(logs: NutritionEntry[]): Promise<boolean> {
  return sSet('nu-logs', logs);
}

// ── Coach Instructions CRUD ────────────────────────────
export async function getCoachInstructions(): Promise<CoachInstruction[]> {
  return (await sGet('coach-inst')) || [];
}
export async function addCoachInstruction(e: Omit<CoachInstruction, 'id' | 'createdAt'>): Promise<CoachInstruction> {
  const list = await getCoachInstructions();
  const entry: CoachInstruction = { ...e, id: uid(), createdAt: new Date().toISOString() };
  list.push(entry);
  await sSet('coach-inst', list);
  return entry;
}
export async function deleteCoachInstruction(id: string) {
  const list = await getCoachInstructions();
  await sSet('coach-inst', list.filter(i => i.id !== id));
}

// ── Draft Queue (batch sync) ─────────────────────────
export interface DraftLogEntry {
  id: string;
  rawText: string;
  tags: string[];
  date: string;
  createdAt: string;
}

export async function getDraftLogs(): Promise<DraftLogEntry[]> {
  return (await sGet('draft-logs')) || [];
}
export async function addDraftLog(rawText: string, tags: string[], date: string): Promise<DraftLogEntry> {
  const drafts = await getDraftLogs();
  const entry: DraftLogEntry = { id: uid(), rawText, tags, date, createdAt: new Date().toISOString() };
  drafts.push(entry);
  await sSet('draft-logs', drafts);
  return entry;
}
export async function clearDraftLogs(): Promise<boolean> {
  return sSet('draft-logs', []);
}
// Remove specific draft IDs after processing (incremental removal)
export async function removeDraftLogs(ids: string[]): Promise<boolean> {
  const drafts = await getDraftLogs();
  const idSet = new Set(ids);
  return sSet('draft-logs', drafts.filter(d => !idSet.has(d.id)));
}

// ── Sync Metadata ────────────────────────────────────
export interface SyncSettings {
  cutoffHour: number;
  lastSyncDate: string;
}

export async function getSyncSettings(): Promise<SyncSettings> {
  return (await sGet('sync-settings')) || { cutoffHour: 21, lastSyncDate: '' };
}
export async function saveSyncSettings(s: SyncSettings): Promise<boolean> {
  return sSet('sync-settings', s);
}

// ── Deduplication ─────────────────────────────────────
function nutritionHash(n: NutritionEntry): string {
  return `${n.date}|${n.mealType}|${n.mealName.toLowerCase().trim()}|${n.calories}|${n.protein}`;
}

function exerciseHash(e: ExerciseEntry): string {
  return `${e.date}|${e.activityType}|${e.workoutType.toLowerCase().trim()}|${e.duration}|${e.exercises || ''}`;
}

export async function deduplicateLogs(): Promise<{ removedNutrition: number; removedExercise: number }> {
  let removedNutrition = 0;
  let removedExercise = 0;

  // Deduplicate nutrition
  const nuLogs = await getNutritionLogs();
  const nuSeen = new Map<string, NutritionEntry>();
  const nuDeduped: NutritionEntry[] = [];
  for (const n of nuLogs) {
    const h = nutritionHash(n);
    if (!nuSeen.has(h)) {
      nuSeen.set(h, n);
      nuDeduped.push(n);
    } else {
      removedNutrition++;
    }
  }
  if (removedNutrition > 0) await setNutritionLogs(nuDeduped);

  // Deduplicate exercise
  const exLogs = await getExerciseLogs();
  const exSeen = new Map<string, ExerciseEntry>();
  const exDeduped: ExerciseEntry[] = [];
  for (const e of exLogs) {
    const h = exerciseHash(e);
    if (!exSeen.has(h)) {
      exSeen.set(h, e);
      exDeduped.push(e);
    } else {
      removedExercise++;
    }
  }
  if (removedExercise > 0) await setExerciseLogs(exDeduped);

  if (removedNutrition > 0 || removedExercise > 0) {
    console.log(`[Dedup] Removed ${removedNutrition} nutrition + ${removedExercise} exercise duplicates`);
  }

  return { removedNutrition, removedExercise };
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

// ── Trailing 7-Day Stats (with RAG) ──────────────────
export interface TrailingStats {
  avgDailyProtein: number;
  avgDailyCalories: number;
  totalWorkouts: number;
  totalMinutes: number;
  proteinHitDays: number;    // days hitting 165g+
  streak: number;
  daysWithData: number;
  proteinByDay: { date: string; value: number }[];
  caloriesByDay: { date: string; value: number }[];
  workoutsByDay: { date: string; types: ActivityType[] }[];
}

export function getTrailing7DayStats(ex: ExerciseEntry[], nu: NutritionEntry[]): TrailingStats {
  const days = getLast7Dates();
  const proteinByDay: { date: string; value: number }[] = [];
  const caloriesByDay: { date: string; value: number }[] = [];
  const workoutsByDay: { date: string; types: ActivityType[] }[] = [];

  let totalProtein = 0;
  let totalCalories = 0;
  let proteinHitDays = 0;
  let daysWithNuData = 0;
  let totalWorkouts = 0;
  let totalMinutes = 0;

  for (const d of days) {
    const dayNu = nu.filter(n => n.date === d);
    const dayEx = ex.filter(e => e.date === d);

    const dayP = dayNu.reduce((s, m) => s + m.protein, 0);
    const dayCal = dayNu.reduce((s, m) => s + m.calories, 0);

    proteinByDay.push({ date: d, value: dayP });
    caloriesByDay.push({ date: d, value: dayCal });
    workoutsByDay.push({ date: d, types: dayEx.map(e => e.activityType) });

    if (dayNu.length > 0) {
      totalProtein += dayP;
      totalCalories += dayCal;
      daysWithNuData++;
      if (dayP >= 165) proteinHitDays++;
    }

    totalWorkouts += dayEx.length;
    totalMinutes += dayEx.reduce((s, e) => s + (e.duration || 0), 0);
  }

  return {
    avgDailyProtein: daysWithNuData > 0 ? Math.round(totalProtein / daysWithNuData) : 0,
    avgDailyCalories: daysWithNuData > 0 ? Math.round(totalCalories / daysWithNuData) : 0,
    totalWorkouts,
    totalMinutes,
    proteinHitDays,
    streak: getCurrentStreak(ex),
    daysWithData: daysWithNuData,
    proteinByDay,
    caloriesByDay,
    workoutsByDay,
  };
}

// ── RAG Status ────────────────────────────────────────
export type RAGStatus = 'green' | 'yellow' | 'red' | 'gray';

export function getProteinRAG(avgProtein: number): RAGStatus {
  if (avgProtein === 0) return 'gray';
  if (avgProtein >= 165) return 'green';
  if (avgProtein >= 130) return 'yellow';
  return 'red';
}

export function getWorkoutRAG(totalWorkouts: number): RAGStatus {
  if (totalWorkouts === 0) return 'gray';
  if (totalWorkouts >= 4) return 'green';
  if (totalWorkouts >= 2) return 'yellow';
  return 'red';
}

export function getCalorieRAG(avgCalories: number): RAGStatus {
  if (avgCalories === 0) return 'gray';
  if (avgCalories >= 1800 && avgCalories <= 2800) return 'green';
  if (avgCalories >= 1500 && avgCalories <= 3200) return 'yellow';
  return 'red';
}

export function getStreakRAG(streak: number): RAGStatus {
  if (streak === 0) return 'gray';
  if (streak >= 3) return 'green';
  if (streak >= 1) return 'yellow';
  return 'red';
}

export const RAG_COLORS: Record<RAGStatus, string> = {
  green: '#34d399',
  yellow: '#fbbf24',
  red: '#f87171',
  gray: 'rgba(255,255,255,0.15)',
};

// ── Monthly Stats ─────────────────────────────────────
export interface WeekSummary {
  weekLabel: string;
  workouts: number;
  avgProtein: number;
  totalMinutes: number;
}

export function getMonthlyStats(ex: ExerciseEntry[], nu: NutritionEntry[]): WeekSummary[] {
  const weeks: WeekSummary[] = [];
  const now = new Date();

  for (let w = 3; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    const weekEx = ex.filter(e => e.date >= startStr && e.date <= endStr);
    const weekNu = nu.filter(n => n.date >= startStr && n.date <= endStr);

    const dates = [];
    const d = new Date(weekStart);
    while (d <= weekEnd) {
      dates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }

    let totalP = 0;
    let nuDays = 0;
    for (const dt of dates) {
      const dayNu = weekNu.filter(n => n.date === dt);
      if (dayNu.length > 0) {
        totalP += dayNu.reduce((s, m) => s + m.protein, 0);
        nuDays++;
      }
    }

    weeks.push({
      weekLabel: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      workouts: weekEx.length,
      avgProtein: nuDays > 0 ? Math.round(totalP / nuDays) : 0,
      totalMinutes: weekEx.reduce((s, e) => s + (e.duration || 0), 0),
    });
  }

  return weeks;
}

// ── Calendar helpers ──────────────────────────────────
export type DayLogStatus = 'none' | 'nutrition' | 'exercise' | 'both';

export function getDayLogStatus(
  date: string,
  exByDate: Record<string, ExerciseEntry[]>,
  nuByDate: Record<string, NutritionEntry[]>
): DayLogStatus {
  const hasEx = (exByDate[date]?.length || 0) > 0;
  const hasNu = (nuByDate[date]?.length || 0) > 0;
  if (hasEx && hasNu) return 'both';
  if (hasEx) return 'exercise';
  if (hasNu) return 'nutrition';
  return 'none';
}

export function getCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(date);
  }
  return cells;
}

// ── Exercise Drill-Down helpers ───────────────────────
export function getAllUniqueExerciseNames(logs: ExerciseEntry[]): string[] {
  const names = new Set<string>();
  for (const log of logs) {
    if (log.structuredExercises) {
      for (const se of log.structuredExercises) {
        names.add(se.name);
      }
    }
  }
  return [...names].sort();
}

export interface ExerciseProgressEntry {
  date: string;
  weight: number;
  sets: number[];
  workoutType: string;
}

export function getExerciseProgress(logs: ExerciseEntry[], exerciseName: string): ExerciseProgressEntry[] {
  const entries: ExerciseProgressEntry[] = [];
  const nameLower = exerciseName.toLowerCase();

  for (const log of logs) {
    if (!log.structuredExercises) continue;
    for (const se of log.structuredExercises) {
      if (se.name.toLowerCase() === nameLower && se.weight) {
        entries.push({
          date: log.date,
          weight: se.weight,
          sets: se.sets,
          workoutType: log.workoutType,
        });
      }
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Streak + date helpers ─────────────────────────────
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
