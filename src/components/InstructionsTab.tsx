import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  getExerciseLogs, getNutritionLogs, getCoachInstructions, addCoachInstruction, deleteCoachInstruction,
  getUserProfile, saveUserProfile, DEFAULT_PROFILE,
  type CoachInstruction, type ExerciseEntry, type NutritionEntry, type UserProfile,
} from '@/lib/storage';
import { generateWeeklyPlan } from '@/lib/ai-service';

const COACH_IMG = 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80&auto=format&fit=crop';
const PLAN_IMG = 'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=600&q=80&auto=format&fit=crop';

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
    <div className="card-inset rounded-lg p-3.5 space-y-1.5 cursor-pointer hover:bg-muted/60 transition-colors" onClick={onClick}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: isW ? 'hsl(210,12%,40%)' : 'hsl(14,68%,52%)' }}>
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
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">{inst.type === 'weekly' ? 'Weekly Plan' : 'Daily Briefing'} · {inst.date}</p>
        <h2 className="font-display text-2xl font-bold leading-tight mt-1">{inst.title}</h2>
      </div>
      <div className="card-inset rounded-xl p-5">
        <pre className="text-[13px] text-foreground/85 whitespace-pre-wrap leading-[1.7]" style={{ fontFamily: "'Outfit', sans-serif" }}>{inst.body}</pre>
      </div>
    </div>
  );
}

export default function InstructionsTab() {
  const [instructions, setInstructions] = useState<CoachInstruction[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const [draft, setDraft] = useState<UserProfile>(DEFAULT_PROFILE);
  const [profileSaved, setProfileSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'weekly' | 'daily' | null>(null);
  const [selected, setSelected] = useState<CoachInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep ref in sync with editing state so the interval callback can read it
  useEffect(() => { editingRef.current = editing; }, [editing]);

  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv); }, []);
  async function load() {
    const [inst, ex, nu, prof] = await Promise.all([getCoachInstructions(), getExerciseLogs(), getNutritionLogs(), getUserProfile()]);
    setInstructions(inst.sort((a, b) => b.date.localeCompare(a.date)));
    setExercises(ex); setNutrition(nu); setProfile(prof);
    // Only update draft if user is NOT currently editing (prevents wiping typed text)
    if (!editingRef.current) setDraft(prof);
    setLoading(false);
  }

  async function saveProfile() {
    await saveUserProfile(draft); setProfile(draft); setEditing(false);
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

  async function handleDel(id: string) { await deleteCoachInstruction(id); setInstructions(prev => prev.filter(i => i.id !== id)); setSelected(null); }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (selected) return <div className="pb-4 fade-up"><DetailView inst={selected} onBack={() => setSelected(null)} onDelete={() => handleDel(selected.id)} /></div>;

  const wk = instructions.filter(i => i.type === 'weekly');

  return (
    <div className="space-y-5 pb-4">
      {/* Hero */}
      <div className="hero-card fade-up" style={{ height: '140px' }}>
        <img src={COACH_IMG} alt="" loading="eager" />
        <div className="hero-overlay" />
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <p className="text-white/60 text-[11px] font-medium uppercase tracking-[0.15em]">Your AI fitness coach</p>
          <h2 className="font-display text-2xl font-bold text-white mt-0.5">Coach</h2>
        </div>
      </div>

      {/* Profile */}
      <div className="card-elevated rounded-xl fade-up d1">
        {/* Header row — always visible, clicking toggles collapse */}
        <div
          className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none"
          onClick={() => { if (!editing) setProfileOpen(o => !o); }}
        >
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">My Profile</p>
            {!editing && (
              <span className="text-[10px] text-muted-foreground/40">{profileOpen ? '▲' : '▼'}</span>
            )}
          </div>
          {!editing ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {profileSaved && <span className="text-[10px] text-primary font-semibold">Saved ✓</span>}
              <button
                onClick={() => { setDraft(profile); setEditing(true); setProfileOpen(true); }}
                className="text-[11px] font-semibold text-primary hover:underline">Edit</button>
            </div>
          ) : (
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={saveProfile} className="text-[11px] font-semibold text-primary hover:underline">Save</button>
            </div>
          )}
        </div>

        {/* Collapsible body */}
        {(profileOpen || editing) && (
          <div className="px-5 pb-5 space-y-3 border-t border-border/40">
            {editing ? (
              <div className="space-y-3 pt-3">
                {FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">{f.label}</label>
                    {f.multi
                      ? <Textarea value={draft[f.key]} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))} className="min-h-[50px] bg-background border-border text-sm resize-none rounded-lg" />
                      : <Input value={draft[f.key]} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))} className="bg-background border-border text-sm h-9 rounded-lg" />
                    }
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/60 italic">Changes will be used when generating new plans and briefings.</p>
              </div>
            ) : (
              <div className="space-y-2 pt-3">
                {FIELDS.filter(f => profile[f.key]).map(f => (
                  <div key={f.key} className="flex gap-3">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 font-semibold w-24 shrink-0 pt-0.5">{f.label}</span>
                    <span className="text-[12px] text-foreground/75 leading-relaxed">{profile[f.key]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate */}
      <div className="fade-up d2">
        <button onClick={genWeekly} disabled={generating !== null}
          className="relative overflow-hidden rounded-xl text-left disabled:opacity-50 w-full" style={{ height: '100px' }}>
          <img src={PLAN_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
          <div className="relative h-full flex flex-col justify-end p-3.5">
            {generating === 'weekly'
              ? <span className="flex items-center gap-2 text-[12px] font-semibold text-white"><span className="w-3 h-3 border-[1.5px] border-white border-t-transparent rounded-full animate-spin" />Generating…</span>
              : <><p className="text-white text-[12px] font-semibold">📋 Generate Weekly Plan</p><p className="text-white/60 text-[9px] mt-0.5 leading-snug">7-day training + nutrition plan tailored to your profile</p></>
            }
          </div>
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 fade-up"><p className="text-sm text-red-600">{error}</p></div>}

      {/* List */}
      {/* Weekly Plans List */}
      <div className="fade-up d3">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-3">Weekly Plans ({wk.length})</p>
        {wk.length === 0 ? (
          <div className="card-elevated rounded-xl py-14 text-center">
            <p className="font-display text-4xl mb-3">📋</p>
            <h3 className="font-display text-lg font-semibold mb-1">No Plans Yet</h3>
            <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">Generate your first weekly plan above.</p>
          </div>
        ) : (
          <div className="space-y-2">{wk.map(i => <InstCard key={i.id} inst={i} onClick={() => setSelected(i)} />)}</div>
        )}
      </div>
    </div>
  );
}
