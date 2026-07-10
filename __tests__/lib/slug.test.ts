import { describe, it, expect } from 'vitest';
import { generateSlug } from '@/lib/slug';

describe('generateSlug', () => {
  it('lowercases and hyphenates a simple name', () => {
    expect(generateSlug('Bridal Lehenga A2')).toBe('bridal-lehenga-a2');
  });

  it('strips punctuation characters', () => {
    expect(generateSlug("Women's Silk Saree!")).toBe('womens-silk-saree');
  });

  it('collapses repeated spaces, underscores, and hyphens into one hyphen', () => {
    expect(generateSlug('Red   -- Gold_ _Lehenga')).toBe('red-gold-lehenga');
  });

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('  -Gown-  ')).toBe('gown');
  });

  it('returns an empty string for an all-punctuation input', () => {
    expect(generateSlug('!!!')).toBe('');
  });
});
