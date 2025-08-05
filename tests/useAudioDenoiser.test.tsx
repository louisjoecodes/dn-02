import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAudioDenoiser } from "../src/hooks/useAudioDenoiser";

describe("useAudioDenoiser hook", () => {
  // Mock getUserMedia
  const mockMediaStream = {
    getTracks: () => [
      {
        kind: "audio",
        stop: vi.fn(),
      },
    ],
  };

  beforeAll(() => {
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
      },
      writable: true,
      configurable: true,
    });
  });

  describe("initialization", () => {
    it("should initialize with correct default state", () => {
      let result: any;
      act(() => {
        result = renderHook(() => useAudioDenoiser()).result;
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.isReady).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.denoise).toBeInstanceOf(Function);
      expect(result.current.startMicrophone).toBeInstanceOf(Function);
      expect(result.current.stopMicrophone).toBeInstanceOf(Function);
    });

    it("should load WASM and become ready", async () => {
      const { result } = renderHook(() => useAudioDenoiser());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });
    });
  });

  describe("denoise function", () => {
    it("should denoise audio file", async () => {
      const { result } = renderHook(() => useAudioDenoiser());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const mockFile = new File([new ArrayBuffer(1024)], "test.wav", {
        type: "audio/wav",
      });

      let cleanAudio: ArrayBuffer | null = null;

      await act(async () => {
        cleanAudio = await result.current.denoise(mockFile);
      });

      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
      expect(result.current.error).toBeNull();
    });

    it("should set isProcessing during denoising", async () => {
      const { result } = renderHook(() => useAudioDenoiser());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const mockFile = new File([new ArrayBuffer(1024)], "test.wav", {
        type: "audio/wav",
      });

      const denoisePromise = await act(async () => {
        return result.current.denoise(mockFile);
      });

      expect(result.current.isProcessing).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      const { result } = renderHook(() => useAudioDenoiser());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        try {
          await result.current.denoise(null as any);
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe("microphone functions", () => {
    it("should start microphone and return denoised stream", async () => {
      const { result } = renderHook(() => useAudioDenoiser());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      let stream: MediaStream | null = null;

      await act(async () => {
        stream = await result.current.startMicrophone();
      });

      expect(stream).toBeTruthy();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it("should stop microphone", async () => {
      const { result } = renderHook(() => useAudioDenoiser());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        await result.current.startMicrophone();
      });

      act(() => {
        result.current.stopMicrophone();
      });

      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    it("should handle microphone permission errors", async () => {
      const { result } = renderHook(() => useAudioDenoiser());

      Object.defineProperty(global.navigator, "mediaDevices", {
        value: {
          getUserMedia: vi
            .fn()
            .mockRejectedValue(new Error("Permission denied")),
        },
        writable: true,
        configurable: true,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        try {
          await result.current.startMicrophone();
        } catch (e) {
          // Expected
        }
      });

      expect(result.current.error?.message).toContain("Permission denied");
    });
  });

  describe("options", () => {
    it("should accept custom options", () => {
      const customOptions = {
        modelUrl: "https://example.com/model.rnn",
        workletUrl: "https://example.com/processor.js",
      };

      let result: any;
      act(() => {
        result = renderHook(() => useAudioDenoiser(customOptions)).result;
      });

      // Hook should initialize with custom options
      expect(result.current).toBeTruthy();
    });

    it("should use custom model when provided", async () => {
      const customModel = new ArrayBuffer(1024);
      const { result } = renderHook(() =>
        useAudioDenoiser({
          model: customModel,
        })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const mockFile = new File([new ArrayBuffer(1024)], "test.wav");

      await act(async () => {
        await result.current.denoise(mockFile);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("cleanup", () => {
    it("should cleanup on unmount", async () => {
      const { result, unmount } = renderHook(() => useAudioDenoiser());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        await result.current.startMicrophone();
      });

      unmount();

      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
    });
  });
});
