import { useState, useEffect } from 'react';
import {
  getExerciseLogs, getNutritionLogs,
  getTrailing7DayStats, getMonthlyStats,
  getProteinRAG, getWorkoutRAG, getCalorieRAG, getStreakRAG,
  RAG_COLORS, getDayLabel, getLast7Dates,
  ACTIVITY_META,
  type ExerciseEntry, type NutritionEntry, type ActivityType, type RAGStatus,
} from '@/lib/storage';

function RAGDot({ status }: { status: RAGStatus }) {
  return (
    <div
      className={`w-2 h-2 rounded-full rag-${status}`}
    />
  );
}

function StatCard({ value, label, suffix, rag }: { value: number | string; label: string; suffix?: string; rag?: RAGStatus }) {
  return (
    <div className="card-elevated rounded-xl p-4 text-center relative">
      {rag && (
        <div className="absolute top-3 right-3">
          <RAGDot status={rag} />
        </div>
      )}
      <p className="text-2xl font-bold tracking-tight tabular-nums">{value}{suffix}</p>
      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-medium">{label}</p>
    </div>
  );
}

function BarChart({ data, maxVal, targetMin, targetMax, label }: {
  data: { date: string; value: number }[];
  maxVal: number;
  targetMin?: number;
  targetMax?: number;
  label: string;
}) {
  const chartMax = Math.max(maxVal, ...data.map(d => d.value)) * 1.15;

  return (
    <div className="card-elevated rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
        {targetMin && targetMax && (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full rag-green" />
            <span className="text-[10px] text-muted-foreground mono">{targetMin}–{targetMax}g target</span>
          </div>
        )}
      </div>
      <div className="flex items-end gap-2" style={{ height: '120px' }}>
        {data.map((d, i) => {
          const pct = d.value > 0 ? Math.max((d.value / chartMax) * 100, 6) : 4;
          const inTarget = targetMin && targetMax && d.value >= targetMin && d.value <= targetMax;
          const over = targetMax && d.value > targetMax;
          const barColor = d.value === 0
            ? 'rgba(255,255,255,0.06)'
            : inTarget
              ? '#34d399'
              : over
                ? 'hsl(14,80%,55%)'
                : '#fbbf24';

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] mono text-muted-foreground font-medium tabular-nums">
                {d.value > 0 ? d.value : ''}
              </span>
              <div
                className="w-full rounded-md transition-all duration-700"
                style={{
                  height: `${pct}%`,
                  minHeight: '4px',
                  backgroundColor: barColor,
                  opacity: d.value === 0 ? 0.3 : 1,
                }}
              />
              <span className="text-[10px] text-muted-foreground font-medium">{getDayLabel(d.date)}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      {targetMin && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#34d399' }} />
            <span className="text-[9px] text-muted-foreground">On target</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#fbbf24' }} />
            <span className="text-[9px] text-muted-foreground">Below target</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(14,80%,55%)' }} />
            <span className="text-[9px] text-muted-foreground">Over target</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyActivityRow({ data }: { data: { date: string; types: ActivityType[] }[] }) {
  return (
    <div className="card-elevated rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Activity · 7 Days</p>
        <div className="flex items-center gap-3">
          {(['Lifting', 'Running', 'Soccer'] as ActivityType[]).map(type => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ACTIVITY_META[type].color }} />
              <span className="text-[9px] text-muted-foreground">{type}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 justify-between">
        {data.map((d, i) => {
          const hasWorkout = d.types.length > 0;
          const primaryType = d.types[0];
          const meta = primaryType ? ACTIVITY_META[primaryType] : null;

          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all"
                style={{
                  backgroundColor: meta ? meta.color : 'rgba(255,255,255,0.04)',
                  color: meta ? 'white' : 'rgba(255,255,255,0.15)',
                  boxShadow: meta ? `0 2px 8px ${meta.color}40` : 'none',
                }}
              >
                {meta ? meta.icon : '·'}
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">{getDayLabel(d.date)}</span>
              {d.types.length > 1 && (
                <div className="flex gap-0.5 -mt-1">
                  {d.types.slice(1).map((t, j) => (
                    <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACTIVITY_META[t].color }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyNutritionRow({ nutrition }: { nutrition: NutritionEntry[] }) {
  const dates = getLast7Dates();
  const today = new Date().toISOString().split('T')[0];

  const nuByDate: Record<string, NutritionEntry[]> = {};
  for (const n of nutrition) (nuByDate[n.date] ??= []).push(n);

  return (
    <div className="card-elevated rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Nutrition · 7 Days</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(14,80%,55%)' }} />
            <span className="text-[9px] text-muted-foreground">Logged</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'rgba(248,113,113,0.5)' }} />
            <span className="text-[9px] text-muted-foreground">Missing</span>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-3 justify-between">
        {dates.map((date, i) => {
          const meals = nuByDate[date] || [];
          const logged = meals.length > 0;
          const isPast = date < today;
          const missing = isPast && !logged;
          const totalCal = meals.reduce((s, m) => s + m.calories, 0);
          const totalPro = meals.reduce((s, m) => s + m.protein, 0);
          const proColor = totalPro >= 165 ? '#34d399' : totalPro >= 130 ? '#fbbf24' : '#f87171';

          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <div
                className="w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all"
                style={{
                  backgroundColor: logged
                    ? 'hsl(14,80%,55%)'
                    : missing
                      ? 'rgba(248,113,113,0.10)'
                      : 'rgba(255,255,255,0.04)',
                  border: missing ? '1px solid rgba(248,113,113,0.25)' : '1px solid transparent',
                  boxShadow: logged ? '0 2px 8px hsl(14,80%,55%,0.3)' : 'none',
                }}
              >
                {logged ? (
                  <span className="text-[8px] font-bold text-white leading-none tabular-nums">{totalCal}</span>
                ) : missing ? (
                  <span className="text-[12px]" style={{ color: '#f87171' }}>!</span>
                ) : (
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                )}
              </div>
              {logged ? (
                <span className="text-[9px] mono font-semibold tabular-nums" style={{ color: proColor }}>
                  {totalPro}g
                </span>
              ) : (
                <span className="text-[9px] text-transparent select-none">—</span>
              )}
              <span className="text-[10px] text-muted-foreground font-medium">{getDayLabel(date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyOverview({ data }: { data: { weekLabel: string; workouts: number; avgProtein: number; totalMinutes: number }[] }) {
  if (data.every(w => w.workouts === 0 && w.avgProtein === 0)) return null;

  const maxWorkouts = Math.max(...data.map(w => w.workouts), 1);

  return (
    <div className="card-elevated rounded-xl p-5">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-4">Monthly Trend</p>
      <div className="grid grid-cols-4 gap-3">
        {data.map((week, i) => {
          const pRAG = getProteinRAG(week.avgProtein);
          const wPct = (week.workouts / maxWorkouts) * 100;
          return (
            <div key={i} className="text-center">
              <div className="h-16 flex items-end justify-center mb-2">
                <div
                  className="w-8 rounded-md transition-all"
                  style={{
                    height: `${Math.max(wPct, 8)}%`,
                    background: week.workouts >= 4 ? '#34d399' : week.workouts >= 2 ? '#fbbf24' : week.workouts > 0 ? '#f87171' : 'rgba(255,255,255,0.06)',
                  }}
                />
              </div>
              <p className="text-xs font-semibold tabular-nums">{week.workouts}</p>
              <p className="text-[9px] text-muted-foreground">workouts</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <RAGDot status={pRAG} />
                <span className="text-[9px] text-muted-foreground tabular-nums">{week.avgProtein}g</span>
              </div>
              <p className="text-[8px] text-muted-foreground/50 mt-1">{week.weekLabel}</p>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#34d399' }} />
          <span className="text-[9px] text-muted-foreground">4+ workouts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#fbbf24' }} />
          <span className="text-[9px] text-muted-foreground">2-3 workouts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f87171' }} />
          <span className="text-[9px] text-muted-foreground">1 workout</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardTab() {
  const [ex, setEx] = useState<ExerciseEntry[]>([]);
  const [nu, setNu] = useState<NutritionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); const iv = setInterval(load, 4000); return () => clearInterval(iv); }, []);
  async function load() {
    const [e, n] = await Promise.all([getExerciseLogs(), getNutritionLogs()]);
    setEx(e); setNu(n); setLoading(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const hasData = ex.length > 0 || nu.length > 0;
  const stats = getTrailing7DayStats(ex, nu);
  const monthly = getMonthlyStats(ex, nu);

  const proteinRAG = getProteinRAG(stats.avgDailyProtein);
  const workoutRAG = getWorkoutRAG(stats.totalWorkouts);
  const calorieRAG = getCalorieRAG(stats.avgDailyCalories);
  const streakRAG = getStreakRAG(stats.streak);

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="fade-up pt-2">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h2 className="text-3xl font-bold tracking-tight mt-1">
          {hasData ? 'Dashboard' : 'Welcome'}
        </h2>
      </div>

      {!hasData ? (
        <div className="card-elevated rounded-xl p-8 text-center fade-up d1">
          <div className="text-4xl mb-4">🔥</div>
          <h3 className="text-xl font-bold mb-2">Start Your Journey</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Log your first workout or meal to see your dashboard come alive with insights, trends, and progress tracking.
          </p>
        </div>
      ) : (
        <>
          {/* Trailing 7-Day Summary with RAG */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 fade-up d1">
            <StatCard value={stats.totalWorkouts} label="Workouts" rag={workoutRAG} />
            <StatCard value={stats.streak} label="Streak" suffix="d" rag={streakRAG} />
            <StatCard value={stats.avgDailyProtein} label="Avg Protein" suffix="g" rag={proteinRAG} />
            <StatCard value={stats.totalMinutes} label="Minutes" rag={workoutRAG} />
          </div>

          {/* RAG Legend */}
          <div className="flex items-center gap-5 px-1 fade-up d1">
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-semibold">Trailing 7 days</span>
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full rag-green" /><span className="text-[9px] text-muted-foreground">On track</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full rag-yellow" /><span className="text-[9px] text-muted-foreground">Behind</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full rag-red" /><span className="text-[9px] text-muted-foreground">Off pace</span></div>
            </div>
          </div>

          {/* Protein Trend */}
          <div className="fade-up d2">
            <BarChart
              data={stats.proteinByDay}
              maxVal={210}
              targetMin={165}
              targetMax={180}
              label="Protein · 7 Days"
            />
          </div>

          {/* Weekly Activity */}
          <div className="fade-up d3">
            <WeeklyActivityRow data={stats.workoutsByDay} />
          </div>

          {/* Weekly Nutrition */}
          <div className="fade-up d3">
            <WeeklyNutritionRow nutrition={nu} />
          </div>

          {/* Monthly Overview */}
          <div className="fade-up d4">
            <MonthlyOverview data={monthly} />
          </div>
        </>
      )}
    </div>
  );
}
