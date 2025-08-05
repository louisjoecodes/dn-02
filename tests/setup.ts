import { vi } from "vitest";
import "@testing-library/jest-dom";

// Suppress React act() warnings in test environment
process.env.NODE_ENV = "test";
// Suppress specific React warnings in tests
(global as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  isDisabled: true,
  supportsFiber: true,
  inject: () => {},
  onCommitFiberRoot: () => {},
  onCommitFiberUnmount: () => {},
};

// Mock Web Audio API
global.AudioContext = vi.fn().mockImplementation(() => ({
  createScriptProcessor: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  }),
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  createMediaStreamDestination: vi.fn().mockReturnValue({
    stream: {
      getTracks: () => [
        {
          kind: "audio",
          stop: vi.fn(),
        },
      ],
    },
  }),
  sampleRate: 48000,
  currentTime: 0,
  state: "running",
  close: vi.fn(),
  destination: {
    connect: vi.fn(),
  },
}));

global.AudioWorkletNode = vi.fn();

// Mock MediaStream
global.MediaStream = vi.fn().mockImplementation(() => ({
  getTracks: () => [
    {
      kind: "audio",
      stop: vi.fn(),
    },
  ],
}));

// Fix Blob and File arrayBuffer method in jsdom
if (typeof Blob !== "undefined" && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer);
      };
      reader.readAsArrayBuffer(this);
    });
  };
}

// Mock performance.now for Node.js environment
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
  } as any;
}

// Mock WebAssembly
if (!global.WebAssembly) {
  global.WebAssembly = {
    instantiate: vi.fn().mockResolvedValue({
      instance: {
        exports: {
          memory: new WebAssembly.Memory({ initial: 256 }),
          __wbindgen_export_0: {},
          __wbindgen_start: vi.fn(),
          main: vi.fn(),
          create_denoise_state: vi.fn().mockReturnValue(1),
          destroy_denoise_state: vi.fn(),
          process_frame: vi.fn().mockReturnValue(0),
          wasmdenoisestate_new: vi.fn().mockReturnValue(1),
          wasmdenoisestate_process_frame: vi.fn().mockReturnValue([1, 2]),
          wasmdenoisestate_get_frame_size: vi.fn().mockReturnValue(480),
          __wbg_wasmdenoisestate_free: vi.fn(),
          __wbindgen_malloc: vi.fn().mockReturnValue(1),
          __wbindgen_realloc: vi.fn().mockReturnValue(1),
          __wbindgen_free: vi.fn(),
          __wbindgen_export_3: {},
        },
      },
      module: {},
    }),
    Module: vi.fn(),
    Memory: vi.fn().mockImplementation((descriptor) => ({
      buffer: new ArrayBuffer(descriptor.initial * 65536),
      grow: vi.fn(),
    })),
    Table: vi.fn(),
    instantiateStreaming: vi.fn(),
    compile: vi.fn(),
    compileStreaming: vi.fn(),
  } as any;
}

// Mock fetch for loading WASM
global.fetch = vi.fn().mockImplementation((url) => {
  const urlString = url instanceof URL ? url.toString() : String(url);
  if (urlString.includes(".wasm")) {
    return Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      headers: new Headers(),
      status: 200,
      statusText: "OK",
    });
  }
  return Promise.reject(new Error("Not found"));
});

// Configure React Testing Library
import { configure } from "@testing-library/react";

configure({
  // Suppress act warnings for async effects that are hard to control in tests
  asyncUtilTimeout: 2000,
});

// Suppress React act() warnings in tests
// These warnings are often caused by async effects that are difficult to control in testing
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  const message = args[0]?.toString() || "";
  if (
    message.includes("Warning: An update to") &&
    message.includes("was not wrapped in act")
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

console.warn = (...args: any[]) => {
  const message = args[0]?.toString() || "";
  if (
    message.includes("Warning: An update to") &&
    message.includes("was not wrapped in act")
  ) {
    return;
  }
  originalConsoleWarn.call(console, ...args);
};
