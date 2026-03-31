import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getExerciseLogs, getNutritionLogs, getCoachInstructions, addCoachInstruction, deleteCoachInstruction,
  getUserProfile, saveUserProfile, DEFAULT_PROFILE, getSyncSettings, saveSyncSettings,
  type CoachInstruction, type ExerciseEntry, type NutritionEntry, type UserProfile, type SyncSettings,
} from '@/lib/storage';
import { generateWeeklyPlan, generateDailyBriefing } from '@/lib/ai-service';

const FIELDS: { key: keyof UserProfile; label: string; multi?: boolean }[] = [
  { key: 'currentWeight', label: 'Current Weight' }, { key: 'goalWeight', label: 'Goal Weight' },
  { key: 'fitnessGoals', label: 'Fitness Goals', multi: true }, { key: 'physique', label: 'Current Physique' },
  { key: 'supplements', label: 'Supplements' }, { key: 'equipment', label: 'Equipment', multi: true },
  { key: 'weeklyCommitments', label: 'Weekly Commitments' }, { key: 'proteinTarget', label: 'Protein Target' },
  { key: 'dietaryPreferences', label: 'Dietary Preferences' }, { key: 'injuries', label: 'Injuries / Limitations' },
  { key: 'additionalNotes', label: 'Additional Notes', multi: true },
];

function InstCard({ inst, onClick }: { inst: CoachInstruction; onClick: () => void }) {
  const isW = inst.type === 'weekly';
  const preview = inst.body.slice(0, 140).replace(/\n/g, ' ') + (inst.body.length > 140 ? '…' : '');
  const dl = new Date(inst.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="card-inset rounded-lg p-3.5 space-y-1.5 cursor-pointer hover:bg-white/[0.03] transition-colors" onClick={onClick}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: isW ? '#60a5fa' : 'hsl(14,80%,55%)' }}>
          {isW ? '📋 Weekly' : '◆ Daily'}
        </span>
        <span className="text-[10px] text-muted-foreground mono ml-auto">{dl}</span>
      </div>
      <h4 className="text-[13px] font-semibold leading-snug">{inst.title}</h4>
      <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{preview}</p>
    </div>
  );
}

function DetailView({ inst, onBack, onDelete }: { inst: CoachInstruction; onBack: () => void; onDelete: () => void }) {
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">← Back</button>
        {confirmDel ? <Button size="sm" variant="destructive" className="text-[10px] h-6 rounded-lg" onClick={onDelete}>Confirm</Button>
          : <button className="text-[10px] text-muted-foreground/40 hover:text-destructive transition-colors" onClick={() => setConfirmDel(true)}>delete</button>}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{inst.type === 'weekly' ? 'Weekly Plan' : 'Daily Briefing'} · {inst.date}</p>
        <h2 className="text-2xl font-bold leading-tight mt-1">{inst.title}</h2>
      </div>
      <div className="card-inset rounded-xl p-5">
        <pre className="text-[13px] text-foreground/85 whitespace-pre-wrap leading-[1.7]" style={{ fontFamily: "'Inter', 'Outfit', sans-serif" }}>{inst.body}</pre>
      </div>
    </div>
  );
}

export default function InstructionsTab() {
  const [instructions, setInstructions] = useState<CoachInstruction[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(DEFAULT_PROFILE);
  const [profileSaved, setProfileSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'weekly' | 'daily' | null>(null);
  const [selected, setSelected] = useState<CoachInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({ cutoffHour: 21, lastSyncDate: '' });
  const [syncDraft, setSyncDraft] = useState(21);

  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv); }, []);
  async function load() {
    const [inst, ex, nu, prof, ss] = await Promise.all([getCoachInstructions(), getExerciseLogs(), getNutritionLogs(), getUserProfile(), getSyncSettings()]);
    setInstructions(inst.sort((a, b) => b.date.localeCompare(a.date)));
    setExercises(ex); setNutrition(nu); setProfile(prof); setDraft(prof); setSyncSettings(ss); setSyncDraft(ss.cutoffHour); setLoading(false);
  }

  async function saveProfile() {
    await saveUserProfile(draft); setProfile(draft); setEditing(false);
    await saveSyncSettings({ ...syncSettings, cutoffHour: syncDraft });
    setSyncSettings(prev => ({ ...prev, cutoffHour: syncDraft }));
    setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2500);
  }

  async function genWeekly() {
    setGenerating('weekly'); setError(null);
    try {
      const body = await generateWeeklyPlan(exercises, nutrition, instructions, profile);
      const today = new Date(); const dow = today.getDay();
      const mOff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
      const mon = new Date(today); mon.setDate(today.getDate() + mOff);
      const inst = await addCoachInstruction({ date: today.toISOString().split('T')[0], type: 'weekly',
        title: `Weekly Plan — Week of ${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        body, weekStart: mon.toISOString().split('T')[0] });
      setInstructions(prev => [inst, ...prev]); setSelected(inst);
    } catch (e: any) { setError(e.message || 'Failed.'); } finally { setGenerating(null); }
  }

  async function genDaily() {
    setGenerating('daily'); setError(null);
    try {
      const wp = instructions.filter(i => i.type === 'weekly').sort((a, b) => b.date.localeCompare(a.date));
      const body = await generateDailyBriefing(exercises, nutrition, wp[0] || null, profile);
      const today = new Date();
      const inst = await addCoachInstruction({ date: today.toISOString().split('T')[0], type: 'daily',
        title: `${today.toLocaleDateString('en-US', { weekday: 'long' })} Briefing — ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, body });
      setInstructions(prev => [inst, ...prev]); setSelected(inst);
    } catch (e: any) { setError(e.message || 'Failed.'); } finally { setGenerating(null); }
  }

  async function handleDel(id: string) { await deleteCoachInstruction(id); setInstructions(prev => prev.filter(i => i.id !== id)); setSelected(null); }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (selected) return <div className="pb-4 fade-up"><DetailView inst={selected} onBack={() => setSelected(null)} onDelete={() => handleDel(selected.id)} /></div>;

  const wk = instructions.filter(i => i.type === 'weekly');
  const dl = instructions.filter(i => i.type === 'daily');

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="fade-up pt-2">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">Your AI fitness coach</p>
        <h2 className="text-3xl font-bold tracking-tight mt-1">Coach</h2>
      </div>

      {/* Profile */}
      <div className="card-elevated rounded-xl p-5 space-y-4 fade-up d1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">My Profile</p>
          {!editing ? (
            <div className="flex items-center gap-2">
              {profileSaved && <span className="text-[10px] text-primary font-semibold">Saved ✓</span>}
              <button onClick={() => { setDraft(profile); setEditing(true); }} className="text-[11px] font-semibold text-primary hover:underline">Edit</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={saveProfile} className="text-[11px] font-semibold text-primary hover:underline">Save</button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="space-y-3">
            {FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{f.label}</label>
                {f.multi
                  ? <Textarea value={draft[f.key]} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))} className="min-h-[50px] text-sm resize-none rounded-lg" />
                  : <Input value={draft[f.key]} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))} className="text-sm h-9 rounded-lg" />
                }
              </div>
            ))}
            <div className="space-y-1 pt-2 border-t border-border/40">
              <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Auto-Sync Time</label>
              <div className="flex items-center gap-3">
                <select value={syncDraft} onChange={e => setSyncDraft(Number(e.target.value))}
                  className="text-sm h-9 rounded-lg px-2 appearance-none">
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted-foreground/60">Queued entries sync automatically after this time</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 italic">Changes will be used when generating new plans and briefings.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {FIELDS.filter(f => profile[f.key]).map(f => (
              <div key={f.key} className="flex gap-3">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold w-24 shrink-0 pt-0.5">{f.label}</span>
                <span className="text-[12px] text-foreground/75 leading-relaxed">{profile[f.key]}</span>
              </div>
            ))}
            <div className="flex gap-3 pt-2 border-t border-border/30">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold w-24 shrink-0 pt-0.5">Auto-Sync</span>
              <span className="text-[12px] text-foreground/75 leading-relaxed">
                {syncSettings.cutoffHour === 0 ? '12:00 AM' : syncSettings.cutoffHour < 12 ? `${syncSettings.cutoffHour}:00 AM` : syncSettings.cutoffHour === 12 ? '12:00 PM' : `${syncSettings.cutoffHour - 12}:00 PM`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Generate buttons */}
      <div className="grid grid-cols-2 gap-3 fade-up d2">
        <button onClick={genWeekly} disabled={generating !== null}
          className="card-elevated rounded-xl p-4 text-left hover:bg-white/[0.02] transition-colors disabled:opacity-50 flex flex-col justify-end" style={{ height: '90px' }}>
          {generating === 'weekly'
            ? <span className="flex items-center gap-2 text-[12px] font-semibold"><span className="w-3 h-3 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />Generating…</span>
            : <><p className="text-[12px] font-semibold">📋 Weekly Plan</p><p className="text-muted-foreground text-[9px] mt-0.5 leading-snug">7-day training + nutrition</p></>
          }
        </button>
        <button onClick={genDaily} disabled={generating !== null}
          className="card-elevated rounded-xl p-4 text-left hover:bg-white/[0.02] transition-colors disabled:opacity-50 flex flex-col justify-end" style={{ height: '90px' }}>
          {generating === 'daily'
            ? <span className="flex items-center gap-2 text-[12px] font-semibold"><span className="w-3 h-3 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />Generating…</span>
            : <><p className="text-[12px] font-semibold">◆ Daily Briefing</p><p className="text-muted-foreground text-[9px] mt-0.5 leading-snug">Today's workout + review</p></>
          }
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 fade-up"><p className="text-sm text-red-400">{error}</p></div>}

      {/* List */}
      <Tabs defaultValue="all" className="fade-up d3">
        <TabsList className="w-full rounded-xl p-1 h-auto">
          <TabsTrigger value="all" className="flex-1 text-[11px] rounded-lg py-1.5 font-semibold">All ({instructions.length})</TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1 text-[11px] rounded-lg py-1.5 font-semibold">Weekly ({wk.length})</TabsTrigger>
          <TabsTrigger value="daily" className="flex-1 text-[11px] rounded-lg py-1.5 font-semibold">Daily ({dl.length})</TabsTrigger>
        </TabsList>
        {(['all', 'weekly', 'daily'] as const).map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {(() => {
              const items = tab === 'all' ? instructions : tab === 'weekly' ? wk : dl;
              if (items.length === 0) return (
                <div className="card-elevated rounded-xl py-14 text-center">
                  <p className="text-4xl mb-3">{tab === 'weekly' ? '📋' : tab === 'daily' ? '◆' : '◎'}</p>
                  <h3 className="text-lg font-semibold mb-1">No Instructions Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">Generate your first plan above.</p>
                </div>
              );
              return <div className="space-y-2">{items.map(i => <InstCard key={i.id} inst={i} onClick={() => setSelected(i)} />)}</div>;
            })()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
