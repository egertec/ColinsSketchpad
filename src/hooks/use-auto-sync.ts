import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getDraftLogs, removeDraftLogs, getSyncSettings, saveSyncSettings,
  addExerciseLog, addNutritionLog, getUserProfile,
  acquireSyncLock, releaseSyncLock, isSyncLocked,
} from '@/lib/storage';
import { parseNaturalLanguageLog } from '@/lib/ai-service';

export type AutoSyncStatus = 'idle' | 'checking' | 'syncing' | 'done' | 'error';

export function useAutoSync() {
  const [status, setStatus] = useState<AutoSyncStatus>('idle');
  const [syncedCount, setSyncedCount] = useState(0);
  const ran = useRef(false);

  const checkAndSync = useCallback(async () => {
    // Check sync lock — if another sync is running, skip
    if (isSyncLocked()) {
      setStatus('idle');
      return;
    }

    setStatus('checking');
    try {
      const [drafts, settings] = await Promise.all([getDraftLogs(), getSyncSettings()]);

      if (drafts.length === 0) {
        setStatus('idle');
        return;
      }

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentHour = now.getHours();

      if (settings.lastSyncDate === todayStr) {
        setStatus('idle');
        return;
      }

      const oldestDraft = drafts.reduce((oldest, d) =>
        d.createdAt < oldest.createdAt ? d : oldest, drafts[0]);
      const oldestDraftDate = oldestDraft.createdAt.split('T')[0];
      const hasPreviousDayDrafts = oldestDraftDate < todayStr;
      const isPastCutoff = currentHour >= settings.cutoffHour;

      if (!isPastCutoff && !hasPreviousDayDrafts) {
        setStatus('idle');
        return;
      }

      // Acquire lock before syncing
      if (!acquireSyncLock()) {
        setStatus('idle');
        return;
      }

      setStatus('syncing');
      const profile = await getUserProfile();

      // Group drafts by date
      const byDate = drafts.reduce<Record<string, typeof drafts>>((acc, d) => {
        (acc[d.date] = acc[d.date] || []).push(d);
        return acc;
      }, {});

      let totalParsed = 0;
      for (const [date, group] of Object.entries(byDate)) {
        const combinedInput = group.map(d => d.rawText).join('\n\n---\n\n');
        const parsed = await parseNaturalLanguageLog(combinedInput, profile);
        for (const e of parsed.exercises) await addExerciseLog({ ...e, date });
        for (const m of parsed.meals) await addNutritionLog({ ...m, date });
        totalParsed += parsed.exercises.length + parsed.meals.length;

        // Incrementally remove processed drafts
        await removeDraftLogs(group.map(d => d.id));
      }

      settings.lastSyncDate = todayStr;
      await saveSyncSettings(settings);

      releaseSyncLock();

      setSyncedCount(totalParsed);
      setStatus('done');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (e) {
      releaseSyncLock();
      console.error('Auto-sync error:', e);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    checkAndSync();
  }, [checkAndSync]);

  useEffect(() => {
    function onFocus() { checkAndSync(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [checkAndSync]);

  return { status, syncedCount };
}
