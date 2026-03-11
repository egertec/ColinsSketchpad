import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  getExerciseLogs, getNutritionLogs,
  getRecentExerciseStats, getCurrentStreak, getLast7Dates, getDayLabel,
  ACTIVITY_META,
  type ExerciseEntry, type NutritionEntry, type ActivityType,
} from '@/lib/storage';

// Unsplash images - high quality, fitness-themed
const HERO_IMG = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80&auto=format&fit=crop';
const MOTIVATION_IMG = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80&auto=format&fit=crop';
const EMPTY_IMG = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80&auto=format&fit=crop';

const QUOTES = [
  { text: 'The body achieves what the mind believes.', author: 'Napoleon Hill' },
  { text: 'Strength does not come from the body. It comes from the will.', author: 'Gandhi' },
  { text: 'Take care of your body. It\u2019s the only place you have to live.', author: 'Jim Rohn' },
  { text: 'The pain you feel today will be the strength you feel tomorrow.', author: 'Arnold' },
  { text: 'Success isn\u2019t always about greatness. It\u2019s about consistency.', author: 'Dwayne Johnson' },
];

function Ring({ value, max, size = 72, sw = 5, color, children }: {
  value: number; max: number; size?: number; sw?: number; color: string; children: React.ReactNode;
}) {
  const r = (size - sw) / 2;
  const circ = r * 2 * Math.PI;
  const pct = Math.min(value / Math.max(max, 1), 1);
  const off = circ - pct * circ;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(35,18%,91%)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const stats = getRecentExerciseStats(ex, 7);
  const streak = getCurrentStreak(ex);
  const days7 = getLast7Dates();
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = nu.filter(n => n.date === today);
  const tP = todayMeals.reduce((s, m) => s + m.protein, 0);
  const tCal = todayMeals.reduce((s, m) => s + m.calories, 0);
  const tC = todayMeals.reduce((s, m) => s + m.carbs, 0);
  const tF = todayMeals.reduce((s, m) => s + m.fat, 0);
  const proteinByDay = days7.map(d => nu.filter(n => n.date === d).reduce((s, m) => s + m.protein, 0));
  const workoutByDay = days7.map(d => { const de = ex.filter(e => e.date === d); return de.length > 0 ? de[0].activityType : null; });
  const hasData = ex.length > 0 || nu.length > 0;
  const activeTypes = Object.entries(stats.byType).filter(([_, v]) => v && v > 0) as [ActivityType, number][];
  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  return (
    <div className="space-y-5 pb-4">
      {/* Hero Banner */}
      <div className="hero-card fade-up" style={{ height: '180px' }}>
        <img src={HERO_IMG} alt="" loading="eager" />
        <div className="hero-overlay" />
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <p className="text-white/70 text-[11px] font-medium uppercase tracking-[0.15em]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="font-display text-3xl font-bold text-white mt-0.5 tracking-tight">
            {hasData ? 'Your Day' : 'Welcome'}
          </h2>
        </div>
      </div>

      {!hasData ? (
        <>
          <div className="hero-card fade-up d1" style={{ height: '200px' }}>
            <img src={EMPTY_IMG} alt="" loading="lazy" />
            <div className="hero-overlay-strong" />
            <div className="absolute inset-0 flex flex-col justify-end p-6">
              <h3 className="font-display text-2xl font-bold text-white mb-1.5">Start Your Journey</h3>
              <p className="text-white/70 text-[13px] leading-relaxed max-w-[280px]">
                Log your first workout or meal to see your dashboard come alive with insights and tracking.
              </p>
            </div>
          </div>

          {/* Quote card */}
          <div className="hero-card fade-up d2" style={{ height: '120px' }}>
            <img src={MOTIVATION_IMG} alt="" loading="lazy" />
            <div className="hero-overlay-uniform" />
            <div className="absolute inset-0 flex flex-col justify-center px-6">
              <p className="font-display text-lg text-white italic leading-snug">"{quote.text}"</p>
              <p className="text-white/50 text-[11px] mt-1.5 uppercase tracking-[0.12em]">— {quote.author}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Macro Rings */}
          <div className="card-elevated rounded-xl p-5 fade-up d1">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-4">Today's Macros</p>
            <div className="grid grid-cols-4 gap-1">
              {[
                { v: tP, max: 175, color: 'hsl(14,68%,52%)', label: 'Protein', unit: 'g' },
                { v: tCal, max: 2500, color: 'hsl(30,10%,22%)', label: 'Calories', unit: '' },
                { v: tC, max: 300, color: 'hsl(38,70%,52%)', label: 'Carbs', unit: 'g' },
                { v: tF, max: 90, color: 'hsl(210,12%,55%)', label: 'Fat', unit: 'g' },
              ].map(({ v, max, color, label, unit }) => (
                <div key={label} className="flex flex-col items-center">
                  <Ring value={v} max={max} color={color}>
                    <div className="text-center">
                      <span className="font-display text-[18px] font-bold">{v}</span>
                      {unit && <span className="text-[8px] text-muted-foreground block -mt-1">{unit}</span>}
                    </div>
                  </Ring>
                  <span className="text-[10px] text-muted-foreground mt-1.5 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 fade-up d2">
            {[
              { val: streak, label: 'Streak', suffix: 'd' },
              { val: stats.totalWorkouts, label: 'Workouts', suffix: '' },
              { val: stats.totalMinutes, label: 'Minutes', suffix: '' },
            ].map(({ val, label, suffix }) => (
              <div key={label} className="card-elevated rounded-xl p-4 text-center">
                <p className="font-display text-2xl font-bold tracking-tight">{val}{suffix}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-[0.12em] font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Protein Trend */}
          <div className="card-elevated rounded-xl p-5 fade-up d3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Protein · 7 Day</p>
              <p className="text-[10px] text-muted-foreground mono">165–180g target</p>
            </div>
            <div className="flex items-end gap-2 h-24">
              {proteinByDay.map((val, i) => {
                const pct = Math.max((val / 210) * 100, 4);
                const hit = val >= 165 && val <= 180;
                const over = val > 180;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[9px] mono text-muted-foreground font-medium">{val > 0 ? val : ''}</span>
                    <div className="w-full rounded-md transition-all duration-700"
                      style={{
                        height: `${pct}%`, minHeight: '4px',
                        backgroundColor: val === 0 ? 'hsl(35,18%,91%)' : hit ? 'hsl(14,68%,52%)' : over ? 'hsl(30,10%,22%)' : 'hsl(38,70%,52%)',
                        opacity: val === 0 ? 0.5 : 1,
                      }} />
                    <span className="text-[9px] text-muted-foreground font-medium">{getDayLabel(days7[i])}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Motivational Quote */}
          <div className="hero-card fade-up d3" style={{ height: '110px' }}>
            <img src={MOTIVATION_IMG} alt="" loading="lazy" />
            <div className="hero-overlay-uniform" />
            <div className="absolute inset-0 flex flex-col justify-center px-5">
              <p className="font-display text-[16px] text-white italic leading-snug">"{quote.text}"</p>
              <p className="text-white/50 text-[10px] mt-1 uppercase tracking-[0.12em]">— {quote.author}</p>
            </div>
          </div>

          {/* Activity + Split */}
          <div className="grid grid-cols-2 gap-3 fade-up d4">
            <div className="card-elevated rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-3">This Week</p>
              <div className="flex items-center gap-1 justify-center">
                {workoutByDay.map((type, i) => {
                  const meta = type ? ACTIVITY_META[type] : null;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px]"
                        style={{ backgroundColor: meta ? meta.color : 'hsl(35,18%,91%)', color: meta ? 'white' : 'hsl(30,8%,72%)' }}>
                        {meta ? meta.icon : '·'}
                      </div>
                      <span className="text-[8px] text-muted-foreground font-medium">{getDayLabel(days7[i])}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card-elevated rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-3">Split</p>
              <div className="space-y-2">
                {activeTypes.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No workouts yet</p>
                ) : activeTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-[11px] w-6">{ACTIVITY_META[type].icon}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(count / 7) * 100}%`, backgroundColor: ACTIVITY_META[type].color, transition: 'width 0.6s ease' }} />
                    </div>
                    <span className="text-[10px] mono w-3 text-right text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
