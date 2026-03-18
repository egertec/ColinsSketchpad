import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseNaturalLanguageLog, type ParseResult } from '@/lib/ai-service';
import { addExerciseLog, addNutritionLog, getNutritionLogs, getUserProfile, ACTIVITY_META, type NutritionEntry, type UserProfile, type ActivityType } from '@/lib/storage';

type TagId = ActivityType | 'breakfast' | 'lunch' | 'dinner' | 'snack';

const LOG_HEADER_IMG = 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&q=80&auto=format&fit=crop';

const EXERCISE_TAGS: { id: ActivityType; label: string }[] = [
  { id: 'Lifting', label: '🏋️ Lifting' }, { id: 'Running', label: '🏃 Run' }, { id: 'Soccer', label: '⚽ Soccer' },
  { id: 'Golf', label: '⛳ Golf' }, { id: 'Hiking', label: '🥾 Hiking' }, { id: 'Biking', label: '🚴 Biking' },
  { id: 'Skiing', label: '⛷️ Skiing' }, { id: 'Other', label: '💪 Other' },
];
const MEAL_TAGS: { id: 'breakfast' | 'lunch' | 'dinner' | 'snack'; label: string }[] = [
  { id: 'breakfast', label: '🍳 Breakfast' }, { id: 'lunch', label: '🥗 Lunch' },
  { id: 'dinner', label: '🍖 Dinner' }, { id: 'snack', label: '🍎 Snack' },
];

interface QueuedEntry { id: string; label: string; text: string; date: string; timestamp: number; }
interface RecentLog { id: string; summary: string; feedback: string; timestamp: number; }

const PH: Partial<Record<TagId, string>> = {
  Lifting: 'Bench 185×5×4, OHP 135×8×3, lat pulldown 150×10×3. About 55 min.',
  Running: '3 miles at 8:30 pace, felt solid',
  Soccer: '1 hour pickup game, high intensity', Golf: '18 holes, walked the course, about 4 hours',
  Hiking: '5 mile hike, moderate terrain, ~2 hours', Biking: '15 miles on the trail, about 1 hour',
  Skiing: '4 hours on the mountain, mix of blues and blacks', Other: 'Yoga class 45 min',
  breakfast: '3 eggs, toast, avocado', lunch: 'Chipotle bowl: chicken, rice, beans, guac',
  dinner: 'Pesto pasta with chicken, tomatoes, parmesan', snack: 'Greek yogurt with berries, protein shake',
};

const QUEUE_KEY = 'forge-log-queue';

function loadQueue(): QueuedEntry[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function saveQueue(q: QueuedEntry[]) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

export default function LogTab() {
  const [selectedTags, setSelectedTags] = useState<TagId[]>([]);
  const [sections, setSections] = useState<{ id: TagId; text: string }[]>([]);
  const [freeform, setFreeform] = useState('');
  const [queue, setQueue] = useState<QueuedEntry[]>(loadQueue);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [todayP, setTodayP] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const freeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadCtx(); }, [recentLogs]);
  async function loadCtx() {
    const nu = await getNutritionLogs();
    const today = new Date().toISOString().split('T')[0];
    setTodayP(nu.filter((n: NutritionEntry) => n.date === today).reduce((s: number, m: NutritionEntry) => s + m.protein, 0));
    setProfile(await getUserProfile());
  }

  function toggleTag(id: TagId) {
    setSelectedTags(prev => {
      const next = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
      setSections(next.map(t => ({ id: t, text: sections.find(s => s.id === t)?.text || '' })));
      return next;
    });
  }
  function updateSection(id: TagId, text: string) { setSections(prev => prev.map(s => s.id === id ? { ...s, text } : s)); }

  function tagLabel(id: TagId): string {
    return EXERCISE_TAGS.find(t => t.id === id)?.label || MEAL_TAGS.find(t => t.id === id)?.label || id;
  }

  function buildInput(): string {
    const parts: string[] = [];
    for (const s of sections) { if (!s.text.trim()) continue; const isEx = EXERCISE_TAGS.some(t => t.id === s.id); parts.push(isEx ? `Exercise (${s.id}): ${s.text.trim()}` : `${s.id.charAt(0).toUpperCase() + s.id.slice(1)}: ${s.text.trim()}`); }
    if (freeform.trim()) parts.push(freeform.trim());
    return parts.join('\n\n');
  }

  // Add to queue (no API call)
  function addToQueue() {
    const input = buildInput(); if (!input) return;
    const labels = sections.filter(s => s.text.trim()).map(s => tagLabel(s.id));
    if (freeform.trim() && labels.length === 0) labels.push('Freeform');
    const entry: QueuedEntry = { id: `${Date.now()}`, label: labels.join(', '), text: input, date: entryDate, timestamp: Date.now() };
    const updated = [...queue, entry];
    setQueue(updated);
    saveQueue(updated);
    setSelectedTags([]); setSections([]); setFreeform('');
    setEntryDate(new Date().toISOString().split('T')[0]); // reset to today
  }

  function removeFromQueue(id: string) {
    const updated = queue.filter(q => q.id !== id);
    setQueue(updated);
    saveQueue(updated);
  }

  // Process entire queue — group by date, one API call per date bucket
  async function processQueue() {
    if (queue.length === 0 || !profile) return;
    setProcessing(true); setError(null);
    try {
      // Group by explicit date so each date is processed as one prompt
      const byDate = queue.reduce<Record<string, QueuedEntry[]>>((acc, q) => {
        const d = q.date || new Date().toISOString().split('T')[0];
        (acc[d] = acc[d] || []).push(q);
        return acc;
      }, {});

      let totalExercises = 0, totalMeals = 0, lastFeedback = '';
      for (const [date, group] of Object.entries(byDate)) {
        const combined = group.map((q, i) => `--- Entry ${i + 1} (${q.label}) ---\n${q.text}`).join('\n\n');
        const parsed = await parseNaturalLanguageLog(combined, profile);
        for (const e of parsed.exercises) await addExerciseLog({ ...e, date });
        for (const m of parsed.meals) await addNutritionLog({ ...m, date });
        totalExercises += parsed.exercises.length;
        totalMeals += parsed.meals.length;
        lastFeedback = parsed.feedback;
      }

      const parts: string[] = [];
      if (totalExercises > 0) parts.push(`${totalExercises} exercise ${totalExercises === 1 ? 'entry' : 'entries'}`);
      if (totalMeals > 0) parts.push(`${totalMeals} meal ${totalMeals === 1 ? 'entry' : 'entries'}`);
      const newId = `${Date.now()}`;
      setRecentLogs(prev => [{ id: newId, summary: parts.join(' + ') || 'Synced', feedback: lastFeedback, timestamp: Date.now() }, ...prev].slice(0, 10));
      setExpandedLog(newId);
      setQueue([]);
      saveQueue([]);
    } catch (e: any) { setError(e.message || 'Failed to parse.'); }
    finally { setProcessing(false); }
  }

  const hasInput = sections.some(s => s.text.trim()) || freeform.trim();
  const pPct = Math.min((todayP / 175) * 100, 100);
  const pClr = todayP >= 165 ? 'hsl(14,68%,52%)' : todayP >= 130 ? 'hsl(38,70%,52%)' : 'hsl(30,8%,62%)';

  return (
    <div className="space-y-5 pb-4">
      {/* Header with image */}
      <div className="hero-card fade-up" style={{ height: '120px' }}>
        <img src={LOG_HEADER_IMG} alt="" loading="eager" />
        <div className="hero-overlay" />
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <p className="text-white/60 text-[11px] font-medium uppercase tracking-[0.15em]">Track your progress</p>
          <h2 className="font-display text-2xl font-bold text-white mt-0.5">Log</h2>
        </div>
      </div>

      {/* Protein bar */}
      {todayP > 0 && (
        <div className="fade-up d1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Today's Protein</span>
            <span className="text-[11px] mono font-semibold" style={{ color: pClr }}>{todayP}g / {profile?.proteinTarget || '165-180g'}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pPct}%`, backgroundColor: pClr }} />
          </div>
        </div>
      )}

      {/* Date selector */}
      <div className="fade-up d1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Date</p>
          {entryDate !== new Date().toISOString().split('T')[0] && (
            <button onClick={() => setEntryDate(new Date().toISOString().split('T')[0])}
              className="text-[10px] text-primary hover:underline font-medium">Today</button>
          )}
        </div>
        <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="mt-1.5 w-full h-9 bg-card border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Exercise Tags */}
      <div className="space-y-2 fade-up d1">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Exercise</p>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_TAGS.map(t => (
            <button key={t.id} onClick={() => toggleTag(t.id)}
              className={`chip px-3 py-1.5 text-[12px] rounded-full border ${selectedTags.includes(t.id) ? 'chip-active' : 'border-border bg-card text-foreground hover:border-primary/40'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meal Tags */}
      <div className="space-y-2 fade-up d2">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Nutrition</p>
        <div className="flex flex-wrap gap-2">
          {MEAL_TAGS.map(t => (
            <button key={t.id} onClick={() => toggleTag(t.id)}
              className={`chip px-3 py-1.5 text-[12px] rounded-full border ${selectedTags.includes(t.id) ? 'chip-active' : 'border-border bg-card text-foreground hover:border-primary/40'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      {sections.length > 0 && (
        <div className="space-y-3 fade-up">
          {sections.map(s => (
            <div key={s.id} className="card-elevated rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em]">{tagLabel(s.id)}</span>
                <button onClick={() => toggleTag(s.id)} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">Remove</button>
              </div>
              <Textarea value={s.text} onChange={e => updateSection(s.id, e.target.value)} placeholder={PH[s.id] || 'Describe…'}
                className="min-h-[56px] bg-background border-border text-sm resize-none rounded-lg" disabled={processing} />
            </div>
          ))}
        </div>
      )}

      {/* Freeform */}
      {sections.length === 0 && (
        <div className="card-elevated rounded-xl p-4 space-y-2 fade-up d3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Or type freely</p>
          <Textarea ref={freeRef} value={freeform} onChange={e => setFreeform(e.target.value)} disabled={processing}
            placeholder={'Describe your workout, meals, or both…\n\n"Did upper body — bench 185×5×4, rows 135×8×3. For lunch I had a Chipotle bowl with chicken and guac."'}
            className="min-h-[90px] bg-background border-border text-sm resize-none rounded-lg" />
        </div>
      )}

      {/* Add to Queue button */}
      <div className="flex gap-2 fade-up">
        <Button onClick={addToQueue} disabled={!hasInput || processing}
          className="flex-1 accent-gradient text-white font-semibold h-11 rounded-xl border-0 shadow-sm">
          Add to Today's Log
        </Button>
        {hasInput && !processing && (
          <Button onClick={() => { setSelectedTags([]); setSections([]); setFreeform(''); }} variant="outline" className="text-muted-foreground text-xs px-4 rounded-xl h-11 border-border">Clear</Button>
        )}
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-3 fade-up">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
              Queued Entries <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-white text-[9px]">{queue.length}</span>
            </p>
            <span className="text-[9px] text-muted-foreground/50">Not yet processed</span>
          </div>
          {queue.map(q => {
            const today = new Date().toISOString().split('T')[0];
            const dateLabel = (q.date || today) === today ? 'today' : q.date;
            return (
              <div key={q.id} className="card-inset rounded-lg px-3.5 py-2.5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold truncate">{q.label}</p>
                    <span className="text-[9px] text-muted-foreground/50 mono shrink-0">{dateLabel}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{q.text.slice(0, 80)}{q.text.length > 80 ? '…' : ''}</p>
                </div>
                <button onClick={() => removeFromQueue(q.id)} className="text-[10px] text-muted-foreground/40 hover:text-destructive transition-colors ml-2 shrink-0">✕</button>
              </div>
            );
          })}

          {/* Process All button */}
          <Button onClick={processQueue} disabled={processing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 rounded-xl border-0 shadow-sm">
            {processing
              ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing all entries…</span>
              : `Process All (${queue.length} ${queue.length === 1 ? 'entry' : 'entries'} — 1 AI call)`
            }
          </Button>
          <p className="text-[9px] text-center text-muted-foreground/50">All queued entries are parsed in a single API call to save credits</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between fade-up">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-500 text-xs ml-2">✕</button>
        </div>
      )}

      {/* Recent Logs */}
      {recentLogs.length > 0 && (
        <div className="space-y-2 fade-up">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Recent Entries</p>
            <button onClick={() => setRecentLogs([])} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Clear</button>
          </div>
          {recentLogs.map(log => {
            const isExp = expandedLog === log.id;
            const age = Date.now() - log.timestamp;
            const isNew = age < 3000;
            return (
              <div key={log.id} onClick={() => setExpandedLog(isExp ? null : log.id)}
                className={`rounded-xl border transition-all cursor-pointer ${isNew ? 'border-primary/30 bg-orange-50/50' : 'border-border bg-card'}`}>
                <div className="px-4 py-2.5 flex items-center gap-2">
                  <span className="text-primary text-xs font-bold">✓</span>
                  <span className="text-[12px] text-foreground/80 flex-1 truncate">{log.summary}</span>
                  <span className="text-[9px] text-muted-foreground/50 mono shrink-0">{age < 60000 ? 'now' : `${Math.floor(age / 60000)}m`}</span>
                </div>
                {isExp && log.feedback && (
                  <div className="px-4 pb-3 border-t border-border/50">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mt-2 mb-1">Coach</p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{log.feedback}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
