import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getExerciseLogs, getNutritionLogs, deleteExerciseLog, deleteNutritionLog,
  formatDateHeader, ACTIVITY_META, type ExerciseEntry, type NutritionEntry,
} from '@/lib/storage';

function ExCard({ e, onDel }: { e: ExerciseEntry; onDel: () => void }) {
  const [showDel, setShowDel] = useState(false);
  const meta = ACTIVITY_META[e.activityType] || ACTIVITY_META.Other;
  return (
    <div className="card-inset rounded-lg p-3 space-y-1.5 border-l-[3px] cursor-pointer" style={{ borderLeftColor: meta.color }} onClick={() => setShowDel(!showDel)}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.icon} {e.activityType}</span>
        <span className="text-sm font-medium">{e.workoutType}</span>
        <span className="text-[10px] text-muted-foreground ml-auto mono">{e.duration}min</span>
      </div>
      {e.exercises && <p className="text-[12px] text-muted-foreground truncate">{e.exercises}</p>}
      {e.miles != null && e.miles > 0 && <p className="text-[11px] text-muted-foreground mono">{e.miles}mi {e.averagePace && `@ ${e.averagePace}`} {e.runningType && `· ${e.runningType}`}</p>}
      {e.notes && <p className="text-[11px] text-muted-foreground/60 italic">{e.notes}</p>}
      {showDel && <Button variant="ghost" size="sm" className="text-[11px] text-destructive hover:text-destructive h-6 px-2" onClick={ev => { ev.stopPropagation(); onDel(); }}>Delete</Button>}
    </div>
  );
}

function MealRow({ m, onDel }: { m: NutritionEntry; onDel: () => void }) {
  return (
    <div className="card-inset rounded-lg p-2.5 flex items-start gap-2.5 group">
      <span className="text-[9px] uppercase text-muted-foreground/60 tracking-wider font-semibold w-14 shrink-0 pt-0.5">{m.mealType}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate font-medium">{m.mealName}</p>
        <div className="flex gap-2.5 text-[10px] mono text-muted-foreground mt-0.5">
          <span>{m.calories}cal</span>
          <span style={{ color: 'hsl(14,68%,52%)' }}>{m.protein}gP</span>
          <span>{m.carbs}gC</span>
          <span>{m.fat}gF</span>
        </div>
      </div>
      <button className="text-muted-foreground/20 hover:text-destructive text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={onDel}>✕</button>
    </div>
  );
}

function DaySummary({ exercises, meals }: { exercises: ExerciseEntry[]; meals: NutritionEntry[] }) {
  const tc = meals.reduce((s, m) => s + m.calories, 0);
  const tp = meals.reduce((s, m) => s + m.protein, 0);
  const tmin = exercises.reduce((s, e) => s + (e.duration || 0), 0);
  const hit = tp >= 165 && tp <= 180;
  return (
    <div className="flex items-center gap-2.5 flex-wrap text-[10px] mono">
      {exercises.length > 0 && <span className="px-2 py-0.5 rounded-full text-white text-[9px] font-semibold" style={{ backgroundColor: 'hsl(14,68%,52%)' }}>{exercises.map(e => ACTIVITY_META[e.activityType]?.icon || '💪').join('')} {tmin}min</span>}
      {meals.length > 0 && (
        <>
          <span className="text-muted-foreground">{tc}cal</span>
          <span className={hit ? 'font-bold' : ''} style={{ color: hit ? 'hsl(14,68%,52%)' : tp >= 150 ? 'hsl(38,70%,52%)' : tp > 0 ? 'hsl(0,60%,48%)' : '' }}>{tp}gP</span>
          {hit && <span style={{ color: 'hsl(14,68%,52%)' }}>●</span>}
        </>
      )}
    </div>
  );
}

function DayCard({ date, exercises, meals, onDelEx, onDelNu }: { date: string; exercises: ExerciseEntry[]; meals: NutritionEntry[]; onDelEx: (id: string) => void; onDelNu: (id: string) => void; }) {
  const sorted = [...meals].sort((a, b) => ({ breakfast: 0, lunch: 1, dinner: 2, snack: 3 }[a.mealType] ?? 4) - ({ breakfast: 0, lunch: 1, dinner: 2, snack: 3 }[b.mealType] ?? 4));
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">{formatDateHeader(date)}</p>
      <div className="card-elevated rounded-xl p-4 space-y-3">
        <DaySummary exercises={exercises} meals={meals} />
        {exercises.length > 0 && <div className="space-y-2">{exercises.map(e => <ExCard key={e.id} e={e} onDel={() => onDelEx(e.id)} />)}</div>}
        {exercises.length > 0 && meals.length > 0 && <div className="border-t border-border" />}
        {sorted.length > 0 && <div className="space-y-2">{sorted.map(m => <MealRow key={m.id} m={m} onDel={() => onDelNu(m.id)} />)}</div>}
      </div>
    </div>
  );
}

export default function HistoryTab() {
  const [ex, setEx] = useState<ExerciseEntry[]>([]);
  const [nu, setNu] = useState<NutritionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    const [e, n] = await Promise.all([getExerciseLogs(), getNutritionLogs()]);
    setEx(e.sort((a, b) => b.date.localeCompare(a.date)));
    setNu(n.sort((a, b) => b.date.localeCompare(a.date)));
    setLoading(false);
  }
  async function delEx(id: string) { await deleteExerciseLog(id); setEx(p => p.filter(e => e.id !== id)); }
  async function delNu(id: string) { await deleteNutritionLog(id); setNu(p => p.filter(n => n.id !== id)); }

  const allDates = [...new Set([...ex.map(e => e.date), ...nu.map(n => n.date)])].sort((a, b) => b.localeCompare(a));
  const exByDate: Record<string, ExerciseEntry[]> = {}; for (const e of ex) (exByDate[e.date] ??= []).push(e);
  const nuByDate: Record<string, NutritionEntry[]> = {}; for (const n of nu) (nuByDate[n.date] ??= []).push(n);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 pb-4">
      <div className="fade-up">
        <p className="text-sm text-muted-foreground font-medium">{ex.length} workouts · {nu.length} meals</p>
        <h2 className="font-display text-3xl font-bold tracking-tight mt-0.5">History</h2>
      </div>

      <Tabs defaultValue="daily" className="fade-up d1">
        <TabsList className="w-full bg-muted/60 rounded-xl p-1 h-auto">
          <TabsTrigger value="daily" className="flex-1 text-[11px] rounded-lg py-1.5 font-semibold">Daily</TabsTrigger>
          <TabsTrigger value="exercise" className="flex-1 text-[11px] rounded-lg py-1.5 font-semibold">Exercise</TabsTrigger>
          <TabsTrigger value="nutrition" className="flex-1 text-[11px] rounded-lg py-1.5 font-semibold">Nutrition</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4 space-y-5">
          {allDates.length === 0
            ? <div className="card-elevated rounded-xl py-12 text-center"><p className="text-sm text-muted-foreground">No data logged yet.</p></div>
            : allDates.map(d => <DayCard key={d} date={d} exercises={exByDate[d] || []} meals={nuByDate[d] || []} onDelEx={delEx} onDelNu={delNu} />)}
        </TabsContent>

        <TabsContent value="exercise" className="mt-4 space-y-5">
          {Object.keys(exByDate).length === 0
            ? <div className="card-elevated rounded-xl py-12 text-center"><p className="text-sm text-muted-foreground">No workouts logged yet.</p></div>
            : Object.entries(exByDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, entries]) => (
              <div key={date} className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">{formatDateHeader(date)}</p>
                <div className="card-elevated rounded-xl p-4 space-y-2">{entries.map(e => <ExCard key={e.id} e={e} onDel={() => delEx(e.id)} />)}</div>
              </div>))}
        </TabsContent>

        <TabsContent value="nutrition" className="mt-4 space-y-5">
          {Object.keys(nuByDate).length === 0
            ? <div className="card-elevated rounded-xl py-12 text-center"><p className="text-sm text-muted-foreground">No meals logged yet.</p></div>
            : Object.entries(nuByDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, meals]) => {
              const tp = meals.reduce((s, m) => s + m.protein, 0);
              const tc = meals.reduce((s, m) => s + m.calories, 0);
              const hit = tp >= 165 && tp <= 180;
              const sorted = [...meals].sort((a, b) => ({ breakfast: 0, lunch: 1, dinner: 2, snack: 3 }[a.mealType] ?? 4) - ({ breakfast: 0, lunch: 1, dinner: 2, snack: 3 }[b.mealType] ?? 4));
              return (
                <div key={date} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">{formatDateHeader(date)}</p>
                    <div className="flex items-center gap-2 text-[10px] mono">
                      <span className="text-muted-foreground">{tc}cal</span>
                      <span className={hit ? 'font-bold' : ''} style={{ color: hit ? 'hsl(14,68%,52%)' : tp >= 150 ? 'hsl(38,70%,52%)' : 'hsl(0,60%,48%)' }}>{tp}gP</span>
                      {hit && <span style={{ color: 'hsl(14,68%,52%)' }}>●</span>}
                    </div>
                  </div>
                  <div className="card-elevated rounded-xl p-4 space-y-2">{sorted.map(m => <MealRow key={m.id} m={m} onDel={() => delNu(m.id)} />)}</div>
                </div>);
            })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
