import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
  it('should have vitest configured', () => {
    expect(true).toBe(true);
  });

  it('should have global mocks available', () => {
    expect(global.AudioContext).toBeDefined();
    expect(global.fetch).toBeDefined();
    expect(global.performance.now).toBeDefined();
  });
});