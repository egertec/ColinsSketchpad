import { useState } from 'react';
import DashboardTab from '@/components/DashboardTab';
import LogTab from '@/components/LogTab';
import HistoryTab from '@/components/HistoryTab';
import InstructionsTab from '@/components/InstructionsTab';
import { useAutoGenerate } from '@/hooks/use-auto-generate';

type Tab = 'dashboard' | 'log' | 'history' | 'instructions';

const TABS: { id: Tab; label: string; iconDefault: string; iconActive: string }[] = [
  { id: 'dashboard', label: 'Home', iconDefault: '○', iconActive: '●' },
  { id: 'log', label: 'Log', iconDefault: '＋', iconActive: '＋' },
  { id: 'history', label: 'History', iconDefault: '◫', iconActive: '◧' },
  { id: 'instructions', label: 'Coach', iconDefault: '◇', iconActive: '◆' },
];

export default function ForgeApp() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { status } = useAutoGenerate();

  const isGenerating = status === 'generating-weekly' || status === 'generating-daily';
  const isDone = status === 'done';
  const isError = status === 'error';
  const showBanner = isGenerating || isDone || isError;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg accent-gradient flex items-center justify-center">
            <span className="text-white text-[11px] font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>F</span>
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight" style={{ color: 'hsl(30,10%,12%)' }}>FORGE</h1>
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
          isError ? 'bg-red-50 border border-red-100 text-red-600'
          : isDone ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
          : 'card-inset text-muted-foreground'
        }`}>
          {isGenerating && <div className="w-3.5 h-3.5 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          {isDone && <span className="text-emerald-600 shrink-0">✓</span>}
          {isError && <span className="shrink-0">✕</span>}
          <span className="font-medium">
            {status === 'generating-weekly' && 'Generating your weekly plan…'}
            {status === 'generating-daily' && "Preparing today's briefing…"}
            {isDone && 'Plans updated — check Coach'}
            {isError && 'Generation failed — try manually'}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pt-1 pb-24 hide-scroll">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'log' && <LogTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'instructions' && <InstructionsTab />}
      </div>

      {/* Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-around px-4 py-2.5 border-t"
            style={{ background: 'linear-gradient(to top, hsl(40,33%,97%) 90%, hsla(40,33%,97%,0.92))', backdropFilter: 'blur(20px)', borderColor: 'hsl(35,16%,88%)' }}>
            {TABS.map(t => {
              const active = tab === t.id;
              const hasNotif = t.id === 'instructions' && isDone;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="relative flex flex-col items-center gap-1 py-0.5 px-5 transition-all">
                  <span className="text-[15px] leading-none transition-all"
                    style={{ color: active ? 'hsl(14,68%,52%)' : 'hsl(30,8%,62%)', fontWeight: active ? 700 : 400 }}>
                    {active ? t.iconActive : t.iconDefault}
                  </span>
                  <span className="text-[10px] tracking-wide transition-all"
                    style={{ color: active ? 'hsl(14,68%,52%)' : 'hsl(30,8%,62%)', fontWeight: active ? 600 : 400 }}>
                    {t.label}
                  </span>
                  {hasNotif && !active && <div className="absolute -top-0.5 right-3 w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
