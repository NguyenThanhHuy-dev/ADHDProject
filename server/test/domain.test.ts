import { describe, expect, it } from 'vitest';
import { REWARDS, rollReward } from '../src/domain/rewards';
import {
  applyFocus,
  effectiveStreak,
  localDate,
  previousDay,
  streakBonus,
} from '../src/domain/streak';

describe('streak rules', () => {
  const fresh = { currentStreak: 0, lastStreakDate: null };

  it('starts a streak only when the daily goal is reached', () => {
    expect(applyFocus(fresh, 59, '2030-06-10').extended).toBe(false);
    const r = applyFocus(fresh, 60, '2030-06-10');
    expect(r.extended).toBe(true);
    expect(r.state).toEqual({ currentStreak: 1, lastStreakDate: '2030-06-10' });
  });

  it('extends on consecutive days and restarts after a gap', () => {
    const day1 = { currentStreak: 3, lastStreakDate: '2030-06-09' };
    expect(applyFocus(day1, 60, '2030-06-10').state.currentStreak).toBe(4);
    const gap = { currentStreak: 3, lastStreakDate: '2030-06-07' };
    expect(applyFocus(gap, 60, '2030-06-10').state.currentStreak).toBe(1);
  });

  it('does not count the same day twice, and a short session never resets a streak', () => {
    const done = { currentStreak: 3, lastStreakDate: '2030-06-10' };
    expect(applyFocus(done, 120, '2030-06-10').extended).toBe(false);
    const alive = { currentStreak: 5, lastStreakDate: '2030-06-09' };
    const r = applyFocus(alive, 25, '2030-06-10');
    expect(r.state).toBe(alive);
  });

  it('treats a streak as over once yesterday was missed', () => {
    expect(effectiveStreak({ currentStreak: 4, lastStreakDate: '2030-06-10' }, '2030-06-10')).toBe(
      4,
    );
    expect(effectiveStreak({ currentStreak: 4, lastStreakDate: '2030-06-09' }, '2030-06-10')).toBe(
      4,
    );
    expect(effectiveStreak({ currentStreak: 4, lastStreakDate: '2030-06-08' }, '2030-06-10')).toBe(
      0,
    );
    expect(effectiveStreak({ currentStreak: 0, lastStreakDate: null }, '2030-06-10')).toBe(0);
  });

  it('pays a bonus only from the second day', () => {
    expect([streakBonus(0), streakBonus(1), streakBonus(2), streakBonus(7)]).toEqual([
      0, 0, 20, 70,
    ]);
  });

  it('uses the local calendar day for the given time zone', () => {
    const instant = new Date('2030-06-10T20:30:00Z');
    expect(localDate(instant, 'UTC')).toBe('2030-06-10');
    expect(localDate(instant, 'Asia/Ho_Chi_Minh')).toBe('2030-06-11');
    expect(localDate(instant, 'America/Los_Angeles')).toBe('2030-06-10');
    expect(previousDay('2030-03-01')).toBe('2030-02-28');
  });
});

describe('gacha roll', () => {
  const rarityAt = (roll: number) => rollReward(() => roll).rarity;

  it('maps rolls to the documented odds', () => {
    expect(rarityAt(0)).toBe('common');
    expect(rarityAt(0.59)).toBe('common');
    expect(rarityAt(0.61)).toBe('rare');
    expect(rarityAt(0.91)).toBe('epic');
    expect(rarityAt(0.995)).toBe('legendary');
  });

  it('always returns a catalogue reward, even for edge rolls', () => {
    for (const roll of [0, 0.5, 0.999999]) {
      expect(REWARDS).toContain(rollReward(() => roll));
    }
  });

  it('approximates the odds over many rolls', () => {
    let n = 0;
    const seq = () => (n++ * 0.6180339887) % 1;
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const total = 20000;
    for (let i = 0; i < total; i++) counts[rollReward(seq).rarity]++;
    expect(counts.common / total).toBeGreaterThan(0.55);
    expect(counts.common / total).toBeLessThan(0.65);
    expect(counts.legendary / total).toBeLessThan(0.04);
  });
});
