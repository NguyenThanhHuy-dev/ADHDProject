import { intensityLevel, toWeekColumns } from './heatmap';

describe('heatmap helpers', () => {
  it('maps focus minutes to five levels', () => {
    expect([0, 10, 30, 59, 60, 119, 120, 400].map(intensityLevel)).toEqual([
      0, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });

  it('builds Monday-first week columns and pads the first one', () => {
    // 2030-06-12 is a Wednesday: two empty cells (Mon, Tue) come first.
    const days = Array.from({ length: 10 }, (_, i) => ({
      date: `2030-06-${String(12 + i).padStart(2, '0')}`,
      minutes: i,
      sessions: 0,
    }));
    const columns = toWeekColumns(days);
    expect(columns).toHaveLength(2);
    expect(columns[0].slice(0, 2)).toEqual([null, null]);
    expect(columns[0][2]).toMatchObject({ date: '2030-06-12', row: 2 });
    expect(columns[1][0]).toMatchObject({ date: '2030-06-17', row: 0 }); // next Monday
    expect(columns[1]).toHaveLength(5);
  });

  it('handles no data', () => {
    expect(toWeekColumns([])).toEqual([]);
  });
});
