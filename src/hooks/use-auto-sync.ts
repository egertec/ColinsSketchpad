import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { addExerciseLog, addNutritionLog, getUserProfile } from '@/lib/storage';
import { parseNaturalLanguageLog } from '@/lib/ai-service';

export type AutoSyncStatus = 'idle' | 'checking' | 'syncing' | 'done' | 'error';

const QUEUE_KEY = 'forge-log-queue';
const SYNC_META_KEY = 'forge-sync-meta';

interface QueuedEntry { id: string; label: string; text: string; date: string; timestamp: number; }
interface SyncMeta { cutoffHour: number; lastSyncDate: string; }

function loadQueue(): QueuedEntry[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function clearQueue() { localStorage.setItem(QUEUE_KEY, JSON.stringify([])); }

function getSyncMeta(): SyncMeta {
  try { return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}'); } catch { return { cutoffHour: 21, lastSyncDate: '' }; }
}
function saveSyncMeta(m: SyncMeta) { localStorage.setItem(SYNC_META_KEY, JSON.stringify(m)); }

export function useAutoSync() {
  const [status, setStatus] = useState<AutoSyncStatus>('idle');
  const [syncedCount, setSyncedCount] = useState(0);
  const ran = useRef(false);

  const checkAndSync = useCallback(async () => {
    const queue = loadQueue();

    // Nothing in queue — skip entirely
    if (queue.length === 0) { setStatus('idle'); return; }

    setStatus('checking');

    // Wait for auth session (same pattern as use-auto-generate)
    let session = null;
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) { session = data.session; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    if (!session) { setStatus('idle'); return; }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const meta = getSyncMeta();
    const cutoffHour = meta.cutoffHour ?? 21;

    // Already synced today — skip
    if (meta.lastSyncDate === todayStr) { setStatus('idle'); return; }

    // Check if past cutoff OR if any queued entries are from a previous day (carry-over)
    const hasCarryOver = queue.some(q => (q.date || todayStr) < todayStr);
    const isPastCutoff = currentHour >= cutoffHour;

    if (!isPastCutoff && !hasCarryOver) { setStatus('idle'); return; }

    // Sync time
    setStatus('syncing');
    try {
      const profile = await getUserProfile();

      // Group by date so each date bucket is one API call
      const byDate = queue.reduce<Record<string, QueuedEntry[]>>((acc, q) => {
        const d = q.date || todayStr;
        (acc[d] = acc[d] || []).push(q);
        return acc;
      }, {});

      let total = 0;
      for (const [date, group] of Object.entries(byDate)) {
        const combined = group.map((q, i) => `--- Entry ${i + 1} (${q.label}) ---\n${q.text}`).join('\n\n');
        const parsed = await parseNaturalLanguageLog(combined, profile);
        for (const e of parsed.exercises) await addExerciseLog({ ...e, date });
        for (const m of parsed.meals) await addNutritionLog({ ...m, date });
        total += parsed.exercises.length + parsed.meals.length;
      }

      clearQueue();
      saveSyncMeta({ cutoffHour, lastSyncDate: todayStr });
      setSyncedCount(total);
      setStatus('done');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (e) {
      console.error('Auto-sync error:', e);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  }, []);

  // Run on mount
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    checkAndSync();
  }, [checkAndSync]);

  // Re-check when app regains focus
  useEffect(() => {
    window.addEventListener('focus', checkAndSync);
    return () => window.removeEventListener('focus', checkAndSync);
  }, [checkAndSync]);

  // Expose cutoff hour setting
  function setCutoffHour(hour: number) {
    const meta = getSyncMeta();
    saveSyncMeta({ ...meta, cutoffHour: hour });
  }

  function getCutoffHour(): number {
    return getSyncMeta().cutoffHour ?? 21;
  }

  return { status, syncedCount, setCutoffHour, getCutoffHour };
}
