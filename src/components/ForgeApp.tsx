import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import DashboardTab from '@/components/DashboardTab';
import LogTab from '@/components/LogTab';
import CalendarView from '@/components/CalendarView';
import HistoryTab from '@/components/HistoryTab';
import InstructionsTab from '@/components/InstructionsTab';
import { useAutoGenerate } from '@/hooks/use-auto-generate';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { deduplicateLogs } from '@/lib/storage';
import { retroParseExercises } from '@/lib/exercise-parser';

type Tab = 'dashboard' | 'log' | 'calendar' | 'history' | 'instructions';

const TABS: { id: Tab; label: string; icon: string; iconActive: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '○', iconActive: '●' },
  { id: 'log', label: 'Log', icon: '＋', iconActive: '＋' },
  { id: 'calendar', label: 'Calendar', icon: '▫', iconActive: '▪' },
  { id: 'history', label: 'History', icon: '◫', iconActive: '◧' },
  { id: 'instructions', label: 'Coach', icon: '◇', iconActive: '◆' },
];

export default function ForgeApp() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { status } = useAutoGenerate();
  const { status: syncStatus, syncedCount } = useAutoSync();
  const initRan = useRef(false);

  // One-time init: dedup logs + retro-parse structured exercises
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    (async () => {
      await deduplicateLogs();
      await retroParseExercises();
    })();
  }, []);

  const isGenerating = status === 'generating-weekly';
  const isDone = status === 'done';
  const isError = status === 'error';
  const showBanner = isGenerating || isDone || isError;

  const isSyncing = syncStatus === 'syncing';
  const isSyncDone = syncStatus === 'done';
  const isSyncError = syncStatus === 'error';
  const showSyncBanner = isSyncing || isSyncDone || isSyncError;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm mr-1">←</Link>
          <div className="w-7 h-7 rounded-lg accent-gradient flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">F</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight">FORGE</h1>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-subtle" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Syncing</span>
            </div>
          )}
        </div>
      </div>

      {showBanner && (
        <div className={`mx-5 mb-2 px-4 py-2.5 rounded-lg flex items-center gap-2.5 text-[12px] fade-up ${
          isError ? 'bg-red-500/10 border border-red-500/20 text-red-400'
          : isDone ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          : 'card-inset text-muted-foreground'
        }`}>
          {isGenerating && <div className="w-3.5 h-3.5 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          {isDone && <span className="text-emerald-400 shrink-0">✓</span>}
          {isError && <span className="shrink-0">✕</span>}
          <span className="font-medium">
            {status === 'generating-weekly' && 'Generating your weekly plan…'}
            {isDone && 'Plans updated — check Coach'}
            {isError && 'Generation failed — try manually'}
          </span>
        </div>
      )}

      {showSyncBanner && (
        <div className={`mx-5 mb-2 px-4 py-2.5 rounded-lg flex items-center gap-2.5 text-[12px] fade-up ${
          isSyncError ? 'bg-red-500/10 border border-red-500/20 text-red-400'
          : isSyncDone ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          : 'card-inset text-muted-foreground'
        }`}>
          {isSyncing && <div className="w-3.5 h-3.5 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          {isSyncDone && <span className="text-emerald-400 shrink-0">✓</span>}
          {isSyncError && <span className="shrink-0">✕</span>}
          <span className="font-medium">
            {isSyncing && 'Syncing queued entries…'}
            {isSyncDone && `${syncedCount} ${syncedCount === 1 ? 'entry' : 'entries'} synced`}
            {isSyncError && 'Auto-sync failed — use Sync Now on Log tab'}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pt-1 pb-24 hide-scroll">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'log' && <LogTab />}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'instructions' && <InstructionsTab />}
      </div>

      {/* Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-center justify-around px-2 py-2.5 border-t"
            style={{
              background: 'linear-gradient(to top, hsl(220,14%,8%) 90%, hsla(220,14%,8%,0.92))',
              backdropFilter: 'blur(20px)',
              borderColor: 'hsl(220,12%,16%)',
            }}
          >
            {TABS.map(t => {
              const active = tab === t.id;
              const hasNotif = t.id === 'instructions' && isDone;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="relative flex flex-col items-center gap-1 py-0.5 px-3 transition-all"
                >
                  <span
                    className="text-[14px] leading-none transition-all"
                    style={{
                      color: active ? 'hsl(14,80%,55%)' : 'rgba(255,255,255,0.3)',
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {active ? t.iconActive : t.icon}
                  </span>
                  <span
                    className="text-[10px] tracking-wide transition-all"
                    style={{
                      color: active ? 'hsl(14,80%,55%)' : 'rgba(255,255,255,0.3)',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {t.label}
                  </span>
                  {hasNotif && !active && (
                    <div className="absolute -top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
