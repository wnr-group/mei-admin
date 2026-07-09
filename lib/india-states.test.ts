import { describe, it, expect } from 'vitest';
import { indianStates } from './india-states';

describe('indianStates', () => {
  it('should contain exactly 29 entries', () => {
    expect(indianStates).toHaveLength(29);
  });

  it('should contain no duplicates', () => {
    const unique = new Set(indianStates);
    expect(unique.size).toBe(indianStates.length);
  });

  it('should include all 7 pre-seeded states', () => {
    const preSeededStates = [
      'Tamil Nadu',
      'Maharashtra',
      'Karnataka',
      'Delhi',
      'Telangana',
      'Kerala',
      'Andhra Pradesh',
    ];
    preSeededStates.forEach((state) => {
      expect(indianStates).toContain(state);
    });
  });
});
