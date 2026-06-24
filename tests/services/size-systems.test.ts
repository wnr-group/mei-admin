import { getSizeSystems, getSizeSystemEntries, getSizeChart } from '@/lib/services/size-systems';

describe('Size Systems Service', () => {
  test('getSizeSystems returns all size systems', async () => {
    const systems = await getSizeSystems();
    expect(systems).toBeDefined();
    expect(systems.length).toBeGreaterThan(0);
    expect(systems[0]).toHaveProperty('id');
    expect(systems[0]).toHaveProperty('name');
  });

  test('getSizeSystemEntries returns entries for a system', async () => {
    const systems = await getSizeSystems();
    const entries = await getSizeSystemEntries(systems[0].id);
    expect(entries).toBeDefined();
    expect(Array.isArray(entries)).toBe(true);
  });

  test('getSizeChart returns formatted chart with measurements', async () => {
    const systems = await getSizeSystems();
    const chart = await getSizeChart(systems[0].id);
    expect(chart).toBeDefined();
    expect(Array.isArray(chart)).toBe(true);
    if (chart.length > 0) {
      expect(chart[0]).toHaveProperty('label');
      expect(chart[0]).toHaveProperty('bust_cm');
    }
  });
});
