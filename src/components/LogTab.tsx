import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseNaturalLanguageLog, type ParseResult } from '@/lib/ai-service';
import {
  addExerciseLog, addNutritionLog, getNutritionLogs, getUserProfile,
  ACTIVITY_META, type NutritionEntry, type UserProfile, type ActivityType,
  getDraftLogs, addDraftLog, removeDraftLogs, getSyncSettings, saveSyncSettings,
  acquireSyncLock, releaseSyncLock, isSyncLocked,
  type DraftLogEntry,
} from '@/lib/storage';

type TagId = ActivityType | 'breakfast' | 'lunch' | 'dinner' | 'snack';

const EXERCISE_TAGS: { id: ActivityType; label: string }[] = [
  { id: 'Lifting', label: '🏋️ Lifting' }, { id: 'Running', label: '🏃 Run' }, { id: 'Soccer', label: '⚽ Soccer' },
  { id: 'Golf', label: '⛳ Golf' }, { id: 'Hiking', label: '🥾 Hiking' }, { id: 'Biking', label: '🚴 Biking' },
  { id: 'Skiing', label: '⛷️ Skiing' }, { id: 'Other', label: '💪 Other' },
];
const MEAL_TAGS: { id: 'breakfast' | 'lunch' | 'dinner' | 'snack'; label: string }[] = [
  { id: 'breakfast', label: '🍳 Breakfast' }, { id: 'lunch', label: '🥗 Lunch' },
  { id: 'dinner', label: '🍖 Dinner' }, { id: 'snack', label: '🍎 Snack' },
];

interface SectionInput { id: TagId; text: string; }
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

export default function LogTab() {
  const [selectedTags, setSelectedTags] = useState<TagId[]>([]);
  const [sections, setSections] = useState<SectionInput[]>([]);
  const [freeform, setFreeform] = useState('');
  const [processing, setProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [todayP, setTodayP] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [drafts, setDrafts] = useState<DraftLogEntry[]>([]);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const freeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadCtx(); }, [recentLogs]);
  async function loadCtx() {
    const nu = await getNutritionLogs();
    const today = new Date().toISOString().split('T')[0];
    setTodayP(nu.filter((n: NutritionEntry) => n.date === today).reduce((s: number, m: NutritionEntry) => s + m.protein, 0));
    setProfile(await getUserProfile());
    setDrafts(await getDraftLogs());
  }

  function toggleTag(id: TagId) {
    setSelectedTags(prev => {
      const next = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
      setSections(next.map(t => ({ id: t, text: sections.find(s => s.id === t)?.text || '' })));
      return next;
    });
  }
  function updateSection(id: TagId, text: string) { setSections(prev => prev.map(s => s.id === id ? { ...s, text } : s)); }
  function buildInput(): string {
    const parts: string[] = [];
    for (const s of sections) { if (!s.text.trim()) continue; const isEx = EXERCISE_TAGS.some(t => t.id === s.id); parts.push(isEx ? `Exercise (${s.id}): ${s.text.trim()}` : `${s.id.charAt(0).toUpperCase() + s.id.slice(1)}: ${s.text.trim()}`); }
    if (freeform.trim()) parts.push(freeform.trim());
    return parts.join('\n\n');
  }

  async function submit() {
    const input = buildInput(); if (!input) return;
    setProcessing(true); setError(null);
    try {
      const draft = await addDraftLog(input, [...selectedTags], entryDate);
      setDrafts(prev => [draft, ...prev]);
      setSelectedTags([]); setSections([]); setFreeform('');
      setEntryDate(new Date().toISOString().split('T')[0]);
    } catch (e: any) { setError(e.message || 'Failed to save draft.'); }
    finally { setProcessing(false); }
  }

  async function syncNow() {
    if (drafts.length === 0 || !profile) return;
    // Check sync lock
    if (isSyncLocked() || !acquireSyncLock()) {
      setError('Another sync is in progress. Please wait.');
      return;
    }
    setSyncing(true); setError(null);
    try {
      const byDate = drafts.reduce<Record<string, DraftLogEntry[]>>((acc, d) => {
        (acc[d.date] = acc[d.date] || []).push(d);
        return acc;
      }, {});

      let totalExercises = 0, totalMeals = 0;
      let lastFeedback = '';
      for (const [date, group] of Object.entries(byDate)) {
        const combinedInput = group.map(d => d.rawText).join('\n\n---\n\n');
        const parsed = await parseNaturalLanguageLog(combinedInput, profile);
        for (const e of parsed.exercises) await addExerciseLog({ ...e, date });
        for (const m of parsed.meals) await addNutritionLog({ ...m, date });
        totalExercises += parsed.exercises.length;
        totalMeals += parsed.meals.length;
        lastFeedback = parsed.feedback;

        // Incrementally remove processed drafts
        await removeDraftLogs(group.map(d => d.id));
      }

      const settings = await getSyncSettings();
      settings.lastSyncDate = new Date().toISOString().split('T')[0];
      await saveSyncSettings(settings);

      releaseSyncLock();

      const parts: string[] = [];
      if (totalExercises > 0) parts.push(`${totalExercises} exercise ${totalExercises === 1 ? 'entry' : 'entries'}`);
      if (totalMeals > 0) parts.push(`${totalMeals} meal ${totalMeals === 1 ? 'entry' : 'entries'}`);
      const newId = `${Date.now()}`;
      setRecentLogs(prev => [{ id: newId, summary: parts.join(' + ') || 'Synced', feedback: lastFeedback, timestamp: Date.now() }, ...prev].slice(0, 10));
      setExpandedLog(newId);
      setDrafts([]);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (e: any) {
      releaseSyncLock();
      setError(e.message || 'Sync failed.');
    }
    finally { setSyncing(false); }
  }

  const hasInput = sections.some(s => s.text.trim()) || freeform.trim();
  const pPct = Math.min((todayP / 175) * 100, 100);
  const pClr = todayP >= 165 ? '#34d399' : todayP >= 130 ? '#fbbf24' : 'rgba(255,255,255,0.3)';

  function tagLabel(id: TagId): string {
    return EXERCISE_TAGS.find(t => t.id === id)?.label || MEAL_TAGS.find(t => t.id === id)?.label || id;
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="fade-up pt-2">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">Track your progress</p>
        <h2 className="text-3xl font-bold tracking-tight mt-1">Log</h2>
      </div>

      {/* Protein bar */}
      {todayP > 0 && (
        <div className="fade-up d1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Today's Protein</span>
            <span className="text-[11px] mono font-semibold" style={{ color: pClr }}>{todayP}g / {profile?.proteinTarget || '165-180g'}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pPct}%`, backgroundColor: pClr }} />
          </div>
        </div>
      )}

      {/* Date selector */}
      <div className="fade-up d1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Date</p>
          {entryDate !== new Date().toISOString().split('T')[0] && (
            <button onClick={() => setEntryDate(new Date().toISOString().split('T')[0])}
              className="text-[10px] text-primary hover:underline font-medium">Today</button>
          )}
        </div>
        <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="mt-1.5 w-full h-9 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Exercise Tags */}
      <div className="space-y-2 fade-up d1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Exercise</p>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_TAGS.map(t => (
            <button key={t.id} onClick={() => toggleTag(t.id)}
              className={`chip px-3 py-1.5 text-[12px] rounded-full border ${selectedTags.includes(t.id)
                ? 'chip-active'
                : 'border-border bg-card text-foreground hover:border-primary/40'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meal Tags */}
      <div className="space-y-2 fade-up d2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Nutrition</p>
        <div className="flex flex-wrap gap-2">
          {MEAL_TAGS.map(t => (
            <button key={t.id} onClick={() => toggleTag(t.id)}
              className={`chip px-3 py-1.5 text-[12px] rounded-full border ${selectedTags.includes(t.id)
                ? 'chip-active'
                : 'border-border bg-card text-foreground hover:border-primary/40'}`}>
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
                <span className="text-[11px] font-semibold uppercase tracking-widest">{tagLabel(s.id)}</span>
                <button onClick={() => toggleTag(s.id)} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">Remove</button>
              </div>
              <Textarea value={s.text} onChange={e => updateSection(s.id, e.target.value)} placeholder={PH[s.id] || 'Describe…'}
                className="min-h-[56px] text-sm resize-none rounded-lg" disabled={processing} />
            </div>
          ))}
        </div>
      )}

      {/* Freeform */}
      {sections.length === 0 && (
        <div className="card-elevated rounded-xl p-4 space-y-2 fade-up d3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Or type freely</p>
          <Textarea ref={freeRef} value={freeform} onChange={e => setFreeform(e.target.value)} disabled={processing}
            placeholder={'Describe your workout, meals, or both…\n\n"Did upper body — bench 185×5×4, rows 135×8×3. For lunch I had a Chipotle bowl with chicken and guac."'}
            className="min-h-[90px] text-sm resize-none rounded-lg" />
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2 fade-up">
        <Button onClick={submit} disabled={!hasInput || processing}
          className="flex-1 accent-gradient text-white font-semibold h-11 rounded-xl border-0 shadow-sm">
          {processing ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</span> : 'Queue Entry'}
        </Button>
        {hasInput && !processing && (
          <Button onClick={() => { setSelectedTags([]); setSections([]); setFreeform(''); }} variant="outline" className="text-muted-foreground text-xs px-4 rounded-xl h-11 border-border">Clear</Button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between fade-up">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 text-xs ml-2">✕</button>
        </div>
      )}

      {/* Pending Drafts Queue */}
      {drafts.length > 0 && (
        <div className="space-y-2 fade-up">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Pending ({drafts.length} {drafts.length === 1 ? 'entry' : 'entries'})
            </p>
            <span className="text-[9px] text-muted-foreground/50 italic">syncs automatically at end of day</span>
          </div>
          {drafts.map(d => {
            const preview = d.rawText.length > 120 ? d.rawText.slice(0, 120) + '…' : d.rawText;
            const age = Date.now() - new Date(d.createdAt).getTime();
            const isNew = age < 3000;
            return (
              <div key={d.id} className={`rounded-xl border transition-all ${isNew ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/60 bg-card/60'}`}>
                <div className="px-4 py-2.5 flex items-center gap-2">
                  <span className="text-amber-500 text-xs font-bold">⏳</span>
                  <span className="text-[12px] text-foreground/70 flex-1 truncate">{preview}</span>
                  <span className="text-[9px] text-muted-foreground/50 mono shrink-0 ml-1">
                    {d.date === new Date().toISOString().split('T')[0] ? 'today' : d.date}
                  </span>
                </div>
              </div>
            );
          })}
          <Button onClick={syncNow} disabled={syncing} variant="outline"
            className="w-full h-10 rounded-xl border-primary/30 text-primary font-semibold text-[12px] hover:bg-primary/5">
            {syncing
              ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />Syncing…</span>
              : `Sync Now (${drafts.length})`}
          </Button>
        </div>
      )}

      {/* Sync success banner */}
      {syncSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2 fade-up">
          <span className="text-emerald-400 text-xs font-bold">✓</span>
          <p className="text-[12px] text-emerald-400 font-medium">All entries synced successfully</p>
        </div>
      )}

      {/* Recent Logs */}
      {recentLogs.length > 0 && (
        <div className="space-y-2 fade-up">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Recent Entries</p>
            <button onClick={() => setRecentLogs([])} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Clear</button>
          </div>
          {recentLogs.map(log => {
            const isExp = expandedLog === log.id;
            const age = Date.now() - log.timestamp;
            const isNew = age < 3000;
            return (
              <div key={log.id} onClick={() => setExpandedLog(isExp ? null : log.id)}
                className={`rounded-xl border transition-all cursor-pointer ${isNew ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
                <div className="px-4 py-2.5 flex items-center gap-2">
                  <span className="text-primary text-xs font-bold">✓</span>
                  <span className="text-[12px] text-foreground/80 flex-1 truncate">{log.summary}</span>
                  <span className="text-[9px] text-muted-foreground/50 mono shrink-0">{age < 60000 ? 'now' : `${Math.floor(age / 60000)}m`}</span>
                </div>
                {isExp && log.feedback && (
                  <div className="px-4 pb-3 border-t border-border/50">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-2 mb-1">Coach</p>
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
