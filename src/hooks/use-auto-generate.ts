import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getExerciseLogs, getNutritionLogs, getCoachInstructions, addCoachInstruction, getUserProfile,
} from '@/lib/storage';
import { generateWeeklyPlan } from '@/lib/ai-service';

export type AutoGenStatus = 'idle' | 'checking' | 'generating-weekly' | 'done' | 'error';

function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function useAutoGenerate() {
  const [status, setStatus] = useState<AutoGenStatus>('idle');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    waitForSessionThenRun();
  }, []);

  async function waitForSessionThenRun() {
    let attempts = 0;
    while (attempts < 10) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        runAutoGen();
        return;
      }
      await new Promise(r => setTimeout(r, 500));
      attempts++;
    }
    console.warn('Auto-gen skipped: no auth session after waiting');
    setStatus('idle');
  }

  async function runAutoGen() {
    setStatus('checking');
    try {
      const [instructions, exercises, nutrition, profile] = await Promise.all([
        getCoachInstructions(), getExerciseLogs(), getNutritionLogs(), getUserProfile(),
      ]);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const thisMonday = getWeekMonday(today);

      const weeklyPlans = instructions.filter(i => i.type === 'weekly');
      const hasThisWeekPlan = weeklyPlans.some(p => p.weekStart === thisMonday || (p.date >= thisMonday && p.date <= todayStr));

      if (!hasThisWeekPlan) {
        setStatus('generating-weekly');
        try {
          const body = await generateWeeklyPlan(exercises, nutrition, instructions, profile);
          await addCoachInstruction({
            date: todayStr, type: 'weekly',
            title: `Weekly Plan — Week of ${new Date(thisMonday + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            body, weekStart: thisMonday,
          });
        } catch (e) { console.error('Auto-gen weekly failed:', e); }
      }

      if (hasThisWeekPlan) { setStatus('idle'); }
      else { setStatus('done'); setTimeout(() => setStatus('idle'), 3500); }
    } catch (e) {
      console.error('Auto-gen error:', e);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  }

  return { status };
}
