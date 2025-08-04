import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioDenoiser } from '../src/components/AudioDenoiser';

describe('AudioDenoiser component', () => {
  // Mock file reading
  global.FileReader = class {
    readAsArrayBuffer = vi.fn();
    addEventListener = vi.fn((event, handler) => {
      if (event === 'load') {
        setTimeout(() => {
          handler({ target: { result: new ArrayBuffer(1024) } });
        }, 0);
      }
    });
  } as any;

  describe('rendering', () => {
    it('should render with default props', () => {
      render(<AudioDenoiser onComplete={vi.fn()} />);
      
      expect(screen.getByText(/drop audio file/i)).toBeInTheDocument();
    });

    it('should show loading state while initializing', () => {
      render(<AudioDenoiser onComplete={vi.fn()} />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show ready state when loaded', async () => {
      render(<AudioDenoiser onComplete={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('file handling', () => {
    it('should handle file drop', async () => {
      const onComplete = vi.fn();
      render(<AudioDenoiser onComplete={onComplete} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const dropZone = screen.getByText(/drop audio file/i);
      const file = new File([new ArrayBuffer(1024)], 'test.wav', { 
        type: 'audio/wav' 
      });
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          types: ['Files']
        }
      });
      
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(expect.any(ArrayBuffer));
      });
    });

    it('should handle file input', async () => {
      const onComplete = vi.fn();
      render(<AudioDenoiser onComplete={onComplete} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const input = screen.getByLabelText(/choose file/i);
      const file = new File([new ArrayBuffer(1024)], 'test.wav', { 
        type: 'audio/wav' 
      });
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(expect.any(ArrayBuffer));
      });
    });

    it('should show progress during processing', async () => {
      render(<AudioDenoiser onComplete={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const file = new File([new ArrayBuffer(1024)], 'test.wav', { 
        type: 'audio/wav' 
      });
      const input = screen.getByLabelText(/choose file/i);
      
      fireEvent.change(input, { target: { files: [file] } });
      
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    it('should handle multiple files', async () => {
      const onComplete = vi.fn();
      render(<AudioDenoiser onComplete={onComplete} multiple />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const files = [
        new File([new ArrayBuffer(1024)], 'test1.wav', { type: 'audio/wav' }),
        new File([new ArrayBuffer(1024)], 'test2.wav', { type: 'audio/wav' })
      ];
      
      const input = screen.getByLabelText(/choose file/i);
      fireEvent.change(input, { target: { files } });
      
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('microphone', () => {
    const mockMediaStream = {
      getTracks: () => [{
        kind: 'audio',
        stop: vi.fn()
      }]
    };

    beforeEach(() => {
      global.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
      } as any;
    });

    it('should show microphone button when enabled', () => {
      render(<AudioDenoiser onComplete={vi.fn()} enableMicrophone />);
      
      expect(screen.getByText(/start microphone/i)).toBeInTheDocument();
    });

    it('should toggle microphone on button click', async () => {
      render(<AudioDenoiser onComplete={vi.fn()} enableMicrophone />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const micButton = screen.getByText(/start microphone/i);
      fireEvent.click(micButton);
      
      await waitFor(() => {
        expect(screen.getByText(/stop microphone/i)).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText(/stop microphone/i));
      
      await waitFor(() => {
        expect(screen.getByText(/start microphone/i)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should display error messages', async () => {
      const onError = vi.fn();
      render(<AudioDenoiser onComplete={vi.fn()} onError={onError} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      // Trigger an error by passing invalid file
      const input = screen.getByLabelText(/choose file/i);
      fireEvent.change(input, { target: { files: [] } });
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should show error UI when processing fails', async () => {
      render(<AudioDenoiser onComplete={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      // Mock FileReader to fail
      global.FileReader = class {
        readAsArrayBuffer = vi.fn();
        addEventListener = vi.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => {
              handler(new Error('Read failed'));
            }, 0);
          }
        });
      } as any;

      const file = new File([new ArrayBuffer(1024)], 'test.wav');
      const input = screen.getByLabelText(/choose file/i);
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('customization', () => {
    it('should accept custom className', () => {
      render(
        <AudioDenoiser 
          onComplete={vi.fn()} 
          className="custom-class" 
        />
      );
      
      expect(screen.getByTestId('audio-denoiser')).toHaveClass('custom-class');
    });

    it('should accept custom accept types', () => {
      render(
        <AudioDenoiser 
          onComplete={vi.fn()} 
          accept="audio/mp3,audio/ogg" 
        />
      );
      
      const input = screen.getByLabelText(/choose file/i);
      expect(input).toHaveAttribute('accept', 'audio/mp3,audio/ogg');
    });

    it('should use custom labels', () => {
      render(
        <AudioDenoiser 
          onComplete={vi.fn()} 
          labels={{
            dropzone: 'Custom drop text',
            processing: 'Custom processing...',
            microphone: 'Custom mic'
          }}
        />
      );
      
      expect(screen.getByText('Custom drop text')).toBeInTheDocument();
    });
  });
});