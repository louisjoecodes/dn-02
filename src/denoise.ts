import { loadWasm, DenoiseProcessor } from "./wasm/loader";

export interface DenoiseOptions {
  sampleRate?: number;
  returnType?: "arraybuffer" | "blob" | "float32array";
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
      throw new Error("Invalid input: input cannot be null or undefined");
    }

    // Initialize WASM if not already loaded
    await (denoise as any).ready();

    // Convert input to Float32Array
    let audioData: Float32Array;
    let sampleRate = options.sampleRate;

    if (input instanceof ArrayBuffer) {
      // Assume raw PCM data if ArrayBuffer
      audioData = new Float32Array(input);
    } else if (input instanceof Float32Array) {
      audioData = input;
    } else if (input instanceof Blob || input instanceof File) {
      // Decode audio file using Web Audio API
      const buffer = await input.arrayBuffer();
      const audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      
      try {
        const audioBuffer = await audioContext.decodeAudioData(buffer);
        sampleRate = audioBuffer.sampleRate;
        
        // Get the first channel (convert to mono if stereo)
        audioData = audioBuffer.getChannelData(0);
        
        // Close the audio context
        await audioContext.close();
      } catch (error: any) {
        throw new Error(`Failed to decode audio file: ${error.message}`);
      }
    } else if (input instanceof MediaStream) {
      audioData = await captureStreamAudio(input, options.duration || 5000);
    } else {
      throw new Error("Invalid input type");
    }

    // Validate audio data
    if (audioData.length === 0) {
      throw new Error("Audio data is empty");
    }

    // Process with denoiser
    const processor = (denoise as any)._processor;
    if (!processor) {
      throw new Error("Denoise processor not initialized");
    }

    const denoised = await processor.process(audioData, {
      ...options,
      sampleRate: sampleRate || options.sampleRate
    });

    // Return in requested format
    switch (options.returnType) {
      case "blob":
        // Create WAV file from the denoised audio
        const wavBuffer = createWavFile(new Float32Array(denoised), sampleRate || 48000);
        return new Blob([wavBuffer], { type: "audio/wav" });
      case "float32array":
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
    },
  }
);

// Helper function to create a WAV file from Float32Array
function createWavFile(audioData: Float32Array, sampleRate: number): ArrayBuffer {
  const length = audioData.length;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);

  // Convert float32 to int16
  const offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset + i * 2, sample * 0x7FFF, true);
  }

  return buffer;
}

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
