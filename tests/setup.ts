import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Web Audio API
global.AudioContext = vi.fn().mockImplementation(() => ({
  createScriptProcessor: vi.fn(),
  createMediaStreamSource: vi.fn(),
  createMediaStreamDestination: vi.fn(),
  sampleRate: 48000,
  currentTime: 0,
  state: 'running',
  close: vi.fn(),
}));

global.AudioWorkletNode = vi.fn();

// Mock performance.now for Node.js environment
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
  } as any;
}

// Mock fetch for loading WASM
global.fetch = vi.fn().mockImplementation((url) => {
  if (url.includes('.wasm')) {
    return Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });
  }
  return Promise.reject(new Error('Not found'));
});