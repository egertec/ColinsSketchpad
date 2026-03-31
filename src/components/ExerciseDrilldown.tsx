import { useMemo, useState } from 'react';
import { getExerciseProgress, type ExerciseEntry, type ExerciseProgressEntry } from '@/lib/storage';

function ProgressChart({ data, metric }: { data: ExerciseProgressEntry[]; metric: 'weight' | 'volume' }) {
  if (data.length === 0) return null;

  // Show last 8 entries max
  const entries = data.slice(-8);
  const values = entries.map(e => metric === 'weight' ? e.weight : e.weight * e.sets.reduce((a, b) => a + b, 0));
  const maxVal = Math.max(...values) * 1.15;
  const minVal = Math.min(...values) * 0.85;

  return (
    <div className="card-elevated rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
          {metric === 'weight' ? 'Weight Progression' : 'Volume Progression'}
        </p>
      </div>
      <div className="flex items-end gap-2" style={{ height: '140px' }}>
        {entries.map((entry, i) => {
          const val = metric === 'weight' ? entry.weight : entry.weight * entry.sets.reduce((a, b) => a + b, 0);
          const pct = maxVal > minVal
            ? ((val - minVal) / (maxVal - minVal)) * 80 + 15
            : 50;

          // Color based on trend
          const prevVal = i > 0 ? (metric === 'weight' ? entries[i - 1].weight : entries[i - 1].weight * entries[i - 1].sets.reduce((a, b) => a + b, 0)) : val;
          const barColor = val > prevVal ? '#34d399' : val < prevVal ? '#f87171' : 'hsl(14,80%,55%)';

          const dateLabel = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] mono text-muted-foreground font-medium tabular-nums">
                {metric === 'weight' ? entry.weight : val}
              </span>
              <div
                className="w-full rounded-md transition-all duration-500"
                style={{
                  height: `${pct}%`,
                  minHeight: '8px',
                  backgroundColor: barColor,
                }}
              />
              <span className="text-[9px] text-muted-foreground">{dateLabel}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#34d399' }} />
          <span className="text-[9px] text-muted-foreground">Increase</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(14,80%,55%)' }} />
          <span className="text-[9px] text-muted-foreground">Same</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f87171' }} />
          <span className="text-[9px] text-muted-foreground">Decrease</span>
        </div>
      </div>
    </div>
  );
}

function SessionTable({ data }: { data: ExerciseProgressEntry[] }) {
  // Show most recent first
  const entries = [...data].reverse().slice(0, 12);

  return (
    <div className="card-elevated rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Session History</p>
      </div>
      <div className="divide-y divide-border/50">
        {entries.map((entry, i) => {
          const dateLabel = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const repsStr = entry.sets.join(' / ');
          // Highlight the last set if it's lower (failure rep)
          const lastSet = entry.sets[entry.sets.length - 1];
          const targetRep = entry.sets[0];
          const hasFailure = entry.sets.length > 1 && lastSet < targetRep;

          return (
            <div key={i} className="flex items-center px-5 py-3 hover:bg-white/[0.02] transition-colors">
              <span className="text-[13px] text-muted-foreground w-24 shrink-0">{dateLabel}</span>
              <span className="text-[14px] font-semibold tabular-nums flex-1">{entry.weight} lb</span>
              <span className="text-[13px] mono text-muted-foreground tabular-nums">
                {entry.sets.map((rep, j) => (
                  <span key={j}>
                    {j > 0 && ' / '}
                    <span style={{
                      color: hasFailure && j === entry.sets.length - 1 ? '#f87171' : 'inherit',
                      fontWeight: hasFailure && j === entry.sets.length - 1 ? 600 : 400,
                    }}>
                      {rep}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      {entries.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">No logged sessions for this exercise yet.</p>
        </div>
      )}
    </div>
  );
}

export default function ExerciseDrilldown({
  exerciseName,
  allLogs,
  onBack,
}: {
  exerciseName: string;
  allLogs: ExerciseEntry[];
  onBack: () => void;
}) {
  const [metric, setMetric] = useState<'weight' | 'volume'>('weight');

  const progress = useMemo(
    () => getExerciseProgress(allLogs, exerciseName),
    [allLogs, exerciseName]
  );

  const totalSessions = progress.length;
  const latestWeight = progress.length > 0 ? progress[progress.length - 1].weight : 0;
  const maxWeight = progress.length > 0 ? Math.max(...progress.map(p => p.weight)) : 0;

  return (
    <div className="space-y-4 pb-4">
      {/* Back button + Header */}
      <div className="flex items-center gap-3 fade-up pt-2">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          ← Back
        </button>
      </div>

      <div className="fade-up">
        <h2 className="text-3xl font-bold tracking-tight">{exerciseName}</h2>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 fade-up d1">
        <div className="card-elevated rounded-xl p-4 text-center">
          <p className="text-xl font-bold tabular-nums">{totalSessions}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Sessions</p>
        </div>
        <div className="card-elevated rounded-xl p-4 text-center">
          <p className="text-xl font-bold tabular-nums">{latestWeight}<span className="text-sm text-muted-foreground ml-0.5">lb</span></p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Current</p>
        </div>
        <div className="card-elevated rounded-xl p-4 text-center">
          <p className="text-xl font-bold tabular-nums">{maxWeight}<span className="text-sm text-muted-foreground ml-0.5">lb</span></p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Best</p>
        </div>
      </div>

      {/* Metric Toggle */}
      <div className="flex gap-2 fade-up d1">
        <button
          onClick={() => setMetric('weight')}
          className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
          style={{
            background: metric === 'weight' ? 'hsl(14,80%,55%)' : 'rgba(255,255,255,0.04)',
            color: metric === 'weight' ? 'white' : 'rgba(255,255,255,0.5)',
          }}
        >
          Weight
        </button>
        <button
          onClick={() => setMetric('volume')}
          className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
          style={{
            background: metric === 'volume' ? 'hsl(14,80%,55%)' : 'rgba(255,255,255,0.04)',
            color: metric === 'volume' ? 'white' : 'rgba(255,255,255,0.5)',
          }}
        >
          Volume
        </button>
      </div>

      {/* Chart */}
      <div className="fade-up d2">
        <ProgressChart data={progress} metric={metric} />
      </div>

      {/* Session History Table */}
      <div className="fade-up d3">
        <SessionTable data={progress} />
      </div>
    </div>
  );
}
