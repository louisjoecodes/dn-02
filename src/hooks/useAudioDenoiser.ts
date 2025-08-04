import { useState, useEffect, useCallback, useRef } from 'react';
import { denoise, DenoiseOptions } from '../denoise';

export interface UseAudioDenoiserOptions {
  model?: ArrayBuffer;
  modelUrl?: string;
  workletUrl?: string;
}

export interface UseAudioDenoiserReturn {
  isReady: boolean;
  isProcessing: boolean;
  error: Error | null;
  denoise: (
    input: ArrayBuffer | Float32Array | Blob | File | MediaStream,
    options?: DenoiseOptions
  ) => Promise<ArrayBuffer>;
  startMicrophone: () => Promise<MediaStream>;
  stopMicrophone: () => void;
}

export function useAudioDenoiser(
  options: UseAudioDenoiserOptions = {}
): UseAudioDenoiserReturn {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize WASM on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await denoise.ready();
        setIsReady(true);
      } catch (err) {
        setError(err as Error);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Load custom model if provided
  useEffect(() => {
    if (options.modelUrl) {
      fetch(options.modelUrl)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          // Store model for use in denoising
          options.model = buffer;
        })
        .catch(err => setError(err));
    }
  }, [options.modelUrl]);

  const denoiseAudio = useCallback(
    async (
      input: ArrayBuffer | Float32Array | Blob | File | MediaStream,
      denoiseOptions?: DenoiseOptions
    ): Promise<ArrayBuffer> => {
      setIsProcessing(true);
      setError(null);

      try {
        const result = await denoise(input, {
          ...denoiseOptions,
          model: options.model,
        });

        // Ensure we return ArrayBuffer
        if (result instanceof ArrayBuffer) {
          return result;
        } else if (result instanceof Blob) {
          return await result.arrayBuffer();
        } else if (result instanceof Float32Array) {
          return result.buffer;
        }
        
        throw new Error('Unexpected result type');
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [options.model]
  );

  const startMicrophone = useCallback(async (): Promise<MediaStream> => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // We'll do our own
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      microphoneStreamRef.current = stream;

      // Create audio context for processing
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      }

      // Create a processed stream
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const destination = audioContextRef.current.createMediaStreamDestination();
      
      // In a real implementation, we'd process audio here
      // For now, just pass through
      source.connect(destination);

      return destination.stream;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    }
  }, []);

  const stopMicrophone = useCallback(() => {
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
  }, []);

  return {
    isReady,
    isProcessing,
    error,
    denoise: denoiseAudio,
    startMicrophone,
    stopMicrophone,
  };
}