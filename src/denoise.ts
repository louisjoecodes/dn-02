import { loadWasm, DenoiseProcessor } from './wasm/loader';

export interface DenoiseOptions {
  sampleRate?: number;
  returnType?: 'arraybuffer' | 'blob' | 'float32array';
  model?: ArrayBuffer;
  duration?: number; // For MediaStream
}

// Create a namespace for the function to add properties
export const denoise = Object.assign(
  async function denoise(
    input: ArrayBuffer | Float32Array | Blob | File | MediaStream,
    options: DenoiseOptions = {}
  ): Promise<ArrayBuffer | Blob | Float32Array> {
    // Validate input
    if (!input) {
      throw new Error('Invalid input: input cannot be null or undefined');
    }

    // Initialize WASM if not already loaded
    await denoise.ready();

    // Convert input to Float32Array
    let audioData: Float32Array;
    
    if (input instanceof ArrayBuffer) {
      audioData = new Float32Array(input);
    } else if (input instanceof Float32Array) {
      audioData = input;
    } else if (input instanceof Blob || input instanceof File) {
      const buffer = await input.arrayBuffer();
      audioData = new Float32Array(buffer);
    } else if (input instanceof MediaStream) {
      audioData = await captureStreamAudio(input, options.duration || 5000);
    } else {
      throw new Error('Invalid input type');
    }

    // Validate audio data
    if (audioData.length === 0) {
      throw new Error('Audio data is empty');
    }

    // Process with denoiser
    const processor = denoise._processor;
    if (!processor) {
      throw new Error('Denoise processor not initialized');
    }

    const denoised = await processor.process(audioData, options);

    // Return in requested format
    switch (options.returnType) {
      case 'blob':
        return new Blob([denoised], { type: 'audio/raw' });
      case 'float32array':
        return new Float32Array(denoised);
      default:
        return denoised;
    }
  },
  {
    _processor: null as DenoiseProcessor | null,
    _ready: false,
    _readyPromise: null as Promise<void> | null,

    ready(): Promise<void> {
      if (this._ready) {
        return Promise.resolve();
      }

      if (!this._readyPromise) {
        this._readyPromise = this._initialize();
      }

      return this._readyPromise;
    },

    async _initialize(): Promise<void> {
      const wasmModule = await loadWasm();
      this._processor = new DenoiseProcessor(wasmModule);
      this._ready = true;
    }
  }
);

// Helper function to capture audio from MediaStream
async function captureStreamAudio(
  stream: MediaStream,
  duration: number
): Promise<Float32Array> {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  
  const chunks: Float32Array[] = [];
  const sampleRate = audioContext.sampleRate;
  const targetSamples = Math.floor((duration / 1000) * sampleRate);
  let totalSamples = 0;

  return new Promise((resolve) => {
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(inputData));
      totalSamples += inputData.length;

      if (totalSamples >= targetSamples) {
        source.disconnect();
        processor.disconnect();
        audioContext.close();

        // Combine chunks
        const result = new Float32Array(totalSamples);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        resolve(result.slice(0, targetSamples));
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  });
}