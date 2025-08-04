import { describe, it, expect, beforeAll } from 'vitest';
import { denoise, DenoiseOptions } from '../src';

describe('denoise function', () => {
  // Test with a simple sine wave
  const createSineWave = (frequency: number, duration: number, sampleRate: number = 48000): Float32Array => {
    const samples = duration * sampleRate;
    const data = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
    }
    return data;
  };

  // Create noisy audio by adding white noise
  const addNoise = (clean: Float32Array, noiseLevel: number = 0.1): Float32Array => {
    const noisy = new Float32Array(clean.length);
    for (let i = 0; i < clean.length; i++) {
      noisy[i] = clean[i] + (Math.random() - 0.5) * noiseLevel;
    }
    return noisy;
  };

  beforeAll(async () => {
    // Ensure WASM is loaded before tests run
    await denoise.ready();
  });

  describe('single-line API', () => {
    it('should denoise audio from ArrayBuffer', async () => {
      const sineWave = createSineWave(440, 1); // 1 second of 440Hz
      const noisyAudio = addNoise(sineWave);
      
      const cleanAudio = await denoise(noisyAudio.buffer);
      
      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
      expect(cleanAudio.byteLength).toBeGreaterThan(0);
    });

    it('should denoise audio from Float32Array', async () => {
      const sineWave = createSineWave(440, 1);
      const noisyAudio = addNoise(sineWave);
      
      const cleanAudio = await denoise(noisyAudio);
      
      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
    });

    it('should denoise audio from Blob', async () => {
      const sineWave = createSineWave(440, 1);
      const noisyAudio = addNoise(sineWave);
      const blob = new Blob([noisyAudio.buffer], { type: 'audio/raw' });
      
      const cleanAudio = await denoise(blob);
      
      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
    });

    it('should denoise audio from File', async () => {
      const sineWave = createSineWave(440, 1);
      const noisyAudio = addNoise(sineWave);
      const file = new File([noisyAudio.buffer], 'test.raw', { type: 'audio/raw' });
      
      const cleanAudio = await denoise(file);
      
      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle MediaStream input', async () => {
      // Mock MediaStream for testing
      const mockStream = {
        getTracks: () => [{
          kind: 'audio',
          stop: () => {}
        }]
      } as unknown as MediaStream;
      
      const cleanAudio = await denoise(mockStream, { duration: 1000 });
      
      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('options', () => {
    it('should respect sample rate option', async () => {
      const sineWave = createSineWave(440, 1, 44100);
      const noisyAudio = addNoise(sineWave);
      
      const cleanAudio = await denoise(noisyAudio, { 
        sampleRate: 44100 
      });
      
      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle returnType option', async () => {
      const sineWave = createSineWave(440, 1);
      const noisyAudio = addNoise(sineWave);
      
      const cleanBlob = await denoise(noisyAudio, { 
        returnType: 'blob' 
      });
      
      expect(cleanBlob).toBeInstanceOf(Blob);
      
      const cleanFloat32 = await denoise(noisyAudio, { 
        returnType: 'float32array' 
      });
      
      expect(cleanFloat32).toBeInstanceOf(Float32Array);
    });

    it('should use custom model if provided', async () => {
      const sineWave = createSineWave(440, 1);
      const noisyAudio = addNoise(sineWave);
      
      // Mock custom model
      const customModel = new ArrayBuffer(1024);
      
      const cleanAudio = await denoise(noisyAudio, { 
        model: customModel 
      });
      
      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid input', async () => {
      await expect(denoise(null as any)).rejects.toThrow();
      await expect(denoise(undefined as any)).rejects.toThrow();
      await expect(denoise('invalid' as any)).rejects.toThrow();
    });

    it('should throw on empty audio', async () => {
      const emptyArray = new Float32Array(0);
      await expect(denoise(emptyArray)).rejects.toThrow();
    });

    it('should handle non-48kHz audio with warning', async () => {
      const sineWave = createSineWave(440, 1, 22050);
      const noisyAudio = addNoise(sineWave);
      
      // Should not throw, but resample internally
      const cleanAudio = await denoise(noisyAudio);
      expect(cleanAudio).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('performance', () => {
    it('should process 1 second of audio quickly', async () => {
      const sineWave = createSineWave(440, 1);
      const noisyAudio = addNoise(sineWave);
      
      const start = performance.now();
      await denoise(noisyAudio);
      const duration = performance.now() - start;
      
      // Should process faster than real-time (< 1000ms for 1s of audio)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle streaming chunks efficiently', async () => {
      const chunkSize = 480; // Frame size
      const chunks: Float32Array[] = [];
      
      // Create 10 chunks
      for (let i = 0; i < 10; i++) {
        const chunk = createSineWave(440, chunkSize / 48000);
        chunks.push(addNoise(chunk));
      }
      
      const results = await Promise.all(
        chunks.map(chunk => denoise(chunk))
      );
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeInstanceOf(ArrayBuffer);
      });
    });
  });
});