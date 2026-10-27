import type { HeatmapDay } from '../../types';

/** 0 = no focus, 4 = a full deep-work day. Thresholds follow the 60-minute streak goal. */
export const intensityLevel = (minutes: number): 0 | 1 | 2 | 3 | 4 => {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
};

export interface HeatmapCell extends HeatmapDay {
  /** 0 = Monday ... 6 = Sunday */
  row: number;
}

/** Splits days into week columns (Monday first); the first column is padded with `null`. */
export const toWeekColumns = (days: HeatmapDay[]): (HeatmapCell | null)[][] => {
  if (days.length === 0) return [];
  const offset = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (HeatmapCell | null)[] = [...Array(offset).fill(null)];
  days.forEach((d, i) => cells.push({ ...d, row: (offset + i) % 7 }));
  const columns: (HeatmapCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));
  return columns;
};
