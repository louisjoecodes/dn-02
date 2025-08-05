import React, { useState, useCallback, useRef } from "react";
import { useAudioDenoiser } from "../hooks/useAudioDenoiser";

export interface AudioDenoiserProps {
  onComplete: (audio: ArrayBuffer) => void;
  onError?: (error: Error) => void;
  className?: string;
  accept?: string;
  multiple?: boolean;
  enableMicrophone?: boolean;
  labels?: {
    dropzone?: string;
    processing?: string;
    microphone?: string;
    error?: string;
  };
}

export const AudioDenoiser: React.FC<AudioDenoiserProps> = ({
  onComplete,
  onError,
  className = "",
  accept = "audio/*",
  multiple = false,
  enableMicrophone = false,
  labels = {},
}) => {
  const {
    isReady,
    isProcessing,
    error,
    denoise,
    startMicrophone,
    stopMicrophone,
  } = useAudioDenoiser();

  const [isDragging, setIsDragging] = useState(false);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultLabels = {
    dropzone: labels.dropzone || "Drop audio file here or click to select",
    processing: labels.processing || "Processing...",
    microphone: labels.microphone || "Start Microphone",
    error: labels.error || "Error: ",
  };

  const handleFiles = useCallback(
    async (files: FileList) => {
      if (!files || files.length === 0) {
        const err = new Error("No files selected");
        onError?.(err);
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingFile(file.name);

        try {
          const result = await denoise(file);
          onComplete(result);
        } catch (err) {
          onError?.(err as Error);
        }
      }

      setProcessingFile(null);
    },
    [denoise, onComplete, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const handleMicrophoneToggle = useCallback(async () => {
    if (isMicrophoneActive) {
      stopMicrophone();
      setIsMicrophoneActive(false);
    } else {
      try {
        await startMicrophone();
        setIsMicrophoneActive(true);

        // Auto-stop after 30 seconds
        setTimeout(() => {
          stopMicrophone();
          setIsMicrophoneActive(false);
        }, 30000);
      } catch (err) {
        onError?.(err as Error);
      }
    }
  }, [isMicrophoneActive, startMicrophone, stopMicrophone, onError]);

  if (!isReady) {
    return (
      <div
        className={`audio-denoiser ${className}`}
        data-testid="audio-denoiser"
      >
        <div className="loading">Loading audio denoiser...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`audio-denoiser ${className}`}
        data-testid="audio-denoiser"
      >
        <div className="error">
          {defaultLabels.error} {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`audio-denoiser ${className}`} data-testid="audio-denoiser">
      <div
        className={`dropzone ${isDragging ? "dragging" : ""} ${
          isProcessing ? "processing" : ""
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        {isProcessing ? (
          <div className="processing-message">
            {defaultLabels.processing}
            {processingFile && (
              <div className="file-name">{processingFile}</div>
            )}
          </div>
        ) : (
          <div className="drop-message">{defaultLabels.dropzone}</div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        style={{ display: "none" }}
        aria-label="Choose file"
      />

      {enableMicrophone && (
        <button
          className={`microphone-button ${isMicrophoneActive ? "active" : ""}`}
          onClick={handleMicrophoneToggle}
          disabled={isProcessing}
        >
          {isMicrophoneActive ? "Stop Microphone" : defaultLabels.microphone}
        </button>
      )}
    </div>
  );
};
