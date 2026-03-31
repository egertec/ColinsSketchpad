import { useState, useEffect, useMemo } from 'react';
import {
  getExerciseLogs, getNutritionLogs, getCoachInstructions,
  getCalendarDays, getDayLogStatus, formatDateHeader,
  ACTIVITY_META,
  type ExerciseEntry, type NutritionEntry, type CoachInstruction, type DayLogStatus,
} from '@/lib/storage';
import ExerciseDrilldown from './ExerciseDrilldown';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const STATUS_COLORS: Record<DayLogStatus, string> = {
  none: 'transparent',
  nutrition: 'hsl(14,80%,55%)',
  exercise: 'hsl(158,80%,42%)',
  both: 'hsl(45,90%,55%)',
};

function DayCell({
  date,
  status,
  isToday,
  isSelected,
  onClick,
}: {
  date: string;
  status: DayLogStatus;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const day = parseInt(date.split('-')[2]);

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-all hover:bg-white/5"
      style={{
        background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
      }}
    >
      <span
        className="text-sm tabular-nums font-medium"
        style={{
          color: isToday
            ? 'hsl(14,80%,55%)'
            : isSelected
              ? 'white'
              : 'rgba(255,255,255,0.7)',
          fontWeight: isToday ? 700 : 500,
        }}
      >
        {day}
      </span>
      {/* Activity dots */}
      <div className="flex gap-0.5 mt-0.5 h-1.5">
        {status === 'both' ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(158,80%,42%)' }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(14,80%,55%)' }} />
          </>
        ) : status !== 'none' ? (
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
        ) : null}
      </div>
      {/* Today ring */}
      {isToday && (
        <div className="absolute inset-0 rounded-lg border border-primary/40 pointer-events-none" />
      )}
    </button>
  );
}

function DayDetail({
  date,
  exercises,
  meals,
  coachPlans,
  onExerciseClick,
}: {
  date: string;
  exercises: ExerciseEntry[];
  meals: NutritionEntry[];
  coachPlans: CoachInstruction[];
  onExerciseClick: (name: string) => void;
}) {
  const totalP = meals.reduce((s, m) => s + m.protein, 0);
  const totalCal = meals.reduce((s, m) => s + m.calories, 0);
  const totalMin = exercises.reduce((s, e) => s + (e.duration || 0), 0);

  const sortedMeals = [...meals].sort((a, b) =>
    ({ breakfast: 0, lunch: 1, dinner: 2, snack: 3 }[a.mealType] ?? 4) -
    ({ breakfast: 0, lunch: 1, dinner: 2, snack: 3 }[b.mealType] ?? 4)
  );

  return (
    <div className="card-elevated rounded-xl p-5 space-y-4 fade-up">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">{formatDateHeader(date)}</h3>
        {(exercises.length > 0 || meals.length > 0) && (
          <div className="flex items-center gap-3 text-[11px] mono text-muted-foreground">
            {totalMin > 0 && <span>{totalMin}min</span>}
            {totalCal > 0 && <span>{totalCal}cal</span>}
            {totalP > 0 && (
              <span style={{ color: totalP >= 165 ? '#34d399' : totalP >= 130 ? '#fbbf24' : '#f87171' }}>
                {totalP}g P
              </span>
            )}
          </div>
        )}
      </div>

      {/* Coach Recommendations */}
      {coachPlans.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Coach Plan</p>
          {coachPlans.map(plan => (
            <div key={plan.id} className="card-inset rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: plan.type === 'weekly' ? '#60a5fa' : 'hsl(14,80%,55%)' }}>
                  {plan.type === 'weekly' ? '📋 Weekly' : '◆ Daily'}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground line-clamp-3 leading-relaxed">{plan.body.slice(0, 200)}...</p>
            </div>
          ))}
        </div>
      )}

      {/* Exercises */}
      {exercises.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Workouts</p>
          {exercises.map(e => {
            const meta = ACTIVITY_META[e.activityType] || ACTIVITY_META.Other;
            return (
              <div key={e.id} className="card-inset rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold" style={{ color: meta.color }}>
                    {meta.icon} {e.activityType}
                  </span>
                  <span className="text-sm font-medium">{e.workoutType}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto mono">{e.duration}min</span>
                </div>
                {e.structuredExercises && e.structuredExercises.length > 0 ? (
                  <div className="space-y-1">
                    {e.structuredExercises.map((se, i) => (
                      <button
                        key={i}
                        onClick={() => onExerciseClick(se.name)}
                        className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 transition-colors text-left"
                      >
                        <span className="text-[12px] text-foreground/80">{se.name}</span>
                        <span className="text-[11px] mono text-muted-foreground">
                          {se.weight ? `${se.weight}lb` : ''}{se.sets.length > 0 ? ` · ${se.sets.join('/')}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : e.exercises ? (
                  <p className="text-[12px] text-muted-foreground">{e.exercises}</p>
                ) : null}
                {e.miles != null && e.miles > 0 && (
                  <p className="text-[11px] text-muted-foreground mono">
                    {e.miles}mi {e.averagePace && `@ ${e.averagePace}`} {e.runningType && `· ${e.runningType}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Meals */}
      {sortedMeals.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Nutrition</p>
          {sortedMeals.map(m => (
            <div key={m.id} className="card-inset rounded-lg p-2.5 flex items-start gap-3">
              <span className="text-[9px] uppercase text-muted-foreground/60 tracking-wider font-semibold w-14 shrink-0 pt-0.5">
                {m.mealType}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate font-medium">{m.mealName}</p>
                <div className="flex gap-2.5 text-[10px] mono text-muted-foreground mt-0.5">
                  <span>{m.calories}cal</span>
                  <span style={{ color: 'hsl(14,80%,55%)' }}>{m.protein}gP</span>
                  <span>{m.carbs}gC</span>
                  <span>{m.fat}gF</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {exercises.length === 0 && meals.length === 0 && coachPlans.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No activity logged for this day.</p>
      )}
    </div>
  );
}

export default function CalendarView() {
  const [ex, setEx] = useState<ExerciseEntry[]>([]);
  const [nu, setNu] = useState<NutritionEntry[]>([]);
  const [coach, setCoach] = useState<CoachInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drilldownExercise, setDrilldownExercise] = useState<string | null>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => { load(); }, []);
  async function load() {
    const [e, n, c] = await Promise.all([getExerciseLogs(), getNutritionLogs(), getCoachInstructions()]);
    setEx(e); setNu(n); setCoach(c); setLoading(false);
  }

  const todayStr = now.toISOString().split('T')[0];

  const exByDate = useMemo(() => {
    const map: Record<string, ExerciseEntry[]> = {};
    for (const e of ex) (map[e.date] ??= []).push(e);
    return map;
  }, [ex]);

  const nuByDate = useMemo(() => {
    const map: Record<string, NutritionEntry[]> = {};
    for (const n of nu) (map[n.date] ??= []).push(n);
    return map;
  }, [nu]);

  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const selectedExercises = selectedDate ? (exByDate[selectedDate] || []) : [];
  const selectedMeals = selectedDate ? (nuByDate[selectedDate] || []) : [];
  const selectedCoach = selectedDate
    ? coach.filter(c => c.date === selectedDate || (c.type === 'weekly' && c.weekStart && selectedDate >= c.weekStart && selectedDate < addDays(c.weekStart, 7)))
    : [];

  if (drilldownExercise) {
    return (
      <ExerciseDrilldown
        exerciseName={drilldownExercise}
        allLogs={ex}
        onBack={() => setDrilldownExercise(null)}
      />
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="fade-up pt-2">
        <h2 className="text-3xl font-bold tracking-tight">Calendar</h2>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between fade-up d1">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-white/5">
          ‹
        </button>
        <h3 className="text-lg font-bold">{monthLabel}</h3>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-white/5">
          ›
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="card-elevated rounded-xl p-4 fade-up d1">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="text-center text-[10px] text-muted-foreground font-semibold uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {calendarDays.map((date, i) => (
            <div key={i}>
              {date ? (
                <DayCell
                  date={date}
                  status={getDayLogStatus(date, exByDate, nuByDate)}
                  isToday={date === todayStr}
                  isSelected={date === selectedDate}
                  onClick={() => setSelectedDate(date === selectedDate ? null : date)}
                />
              ) : (
                <div className="py-1.5" />
              )}
            </div>
          ))}
        </div>

        {/* Calendar Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(158,80%,42%)' }} />
            <span className="text-[9px] text-muted-foreground">Exercise</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(14,80%,55%)' }} />
            <span className="text-[9px] text-muted-foreground">Nutrition</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(158,80%,42%)' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(14,80%,55%)' }} />
            <span className="text-[9px] text-muted-foreground">Both</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-4 h-4 rounded-md border border-primary/40" />
            <span className="text-[9px] text-muted-foreground">Today</span>
          </div>
        </div>
      </div>

      {/* Day Detail */}
      {selectedDate && (
        <DayDetail
          date={selectedDate}
          exercises={selectedExercises}
          meals={selectedMeals}
          coachPlans={selectedCoach}
          onExerciseClick={setDrilldownExercise}
        />
      )}
    </div>
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
