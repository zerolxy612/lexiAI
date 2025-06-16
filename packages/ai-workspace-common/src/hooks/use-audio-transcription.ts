import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  transcribeAudio,
  type TranscriptionResult,
} from '@refly-packages/ai-workspace-common/requests/transcription';

export type TranscriptionStatus = 'idle' | 'transcribing' | 'completed' | 'error';

export interface TranscriptionState {
  status: TranscriptionStatus;
  result: TranscriptionResult | null;
  error: string | null;
  progress: number;
}

export interface UseAudioTranscriptionOptions {
  onTranscriptionComplete?: (result: TranscriptionResult, uid?: string) => void;
  onTranscriptionError?: (error: string, uid?: string) => void;
  autoShowMessages?: boolean;
}

export const useAudioTranscription = (options: UseAudioTranscriptionOptions = {}) => {
  const { t } = useTranslation();
  const { onTranscriptionComplete, onTranscriptionError, autoShowMessages = true } = options;

  const [transcriptionState, setTranscriptionState] = useState<TranscriptionState>({
    status: 'idle',
    result: null,
    error: null,
    progress: 0,
  });

  /**
   * Start transcription for an audio file
   */
  const startTranscription = useCallback(
    async (file: File, uid?: string) => {
      try {
        setTranscriptionState({
          status: 'transcribing',
          result: null,
          error: null,
          progress: 0,
        });

        if (autoShowMessages) {
          message.loading({
            content: t('resource.transcription.processing', { filename: file.name }),
            key: 'transcription',
            duration: 0,
          });
        }

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setTranscriptionState((prev) => ({
            ...prev,
            progress: Math.min(prev.progress + 10, 90),
          }));
        }, 500);

        const result = await transcribeAudio(file);

        clearInterval(progressInterval);

        setTranscriptionState({
          status: 'completed',
          result,
          error: null,
          progress: 100,
        });

        if (autoShowMessages) {
          message.destroy('transcription');
          message.success(t('resource.transcription.completed'));
        }

        onTranscriptionComplete?.(result, uid);

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        setTranscriptionState({
          status: 'error',
          result: null,
          error: errorMessage,
          progress: 0,
        });

        if (autoShowMessages) {
          message.destroy('transcription');
          message.error(t('resource.transcription.failed', { error: errorMessage }));
        }

        onTranscriptionError?.(errorMessage, uid);

        throw error;
      }
    },
    [t, onTranscriptionComplete, onTranscriptionError, autoShowMessages],
  );

  /**
   * Reset transcription state
   */
  const resetTranscription = useCallback(() => {
    setTranscriptionState({
      status: 'idle',
      result: null,
      error: null,
      progress: 0,
    });
    message.destroy('transcription');
  }, []);

  /**
   * Check if transcription is in progress
   */
  const isTranscribing = transcriptionState.status === 'transcribing';

  /**
   * Check if transcription is completed
   */
  const isCompleted = transcriptionState.status === 'completed';

  /**
   * Check if transcription has error
   */
  const hasError = transcriptionState.status === 'error';

  return {
    transcriptionState,
    startTranscription,
    resetTranscription,
    isTranscribing,
    isCompleted,
    hasError,
  };
};
