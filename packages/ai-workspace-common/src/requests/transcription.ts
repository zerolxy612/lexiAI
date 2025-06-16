import { serverOrigin } from '@refly-packages/ai-workspace-common/utils/env';

export interface TranscriptionResult {
  text: string;
  duration: number;
  language: string;
  filename: string;
  fileSize: number;
  processingTimeMs: number;
  requestId: string;
}

export interface TranscriptionHealthCheck {
  status: 'healthy' | 'unavailable';
  service: string;
  supportedFormats: string[];
  timestamp: string;
}

export interface TranscriptionStats {
  service: string;
  version: string;
  supportedFormats: string[];
  maxFileSize: string;
  isAvailable: boolean;
  timestamp: string;
}

// Standard API response format
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Transcribe audio file to text
 * @param file - Audio file to transcribe
 * @returns Promise<TranscriptionResult>
 */
export const transcribeAudio = async (file: File): Promise<TranscriptionResult> => {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch(`${serverOrigin}/v1/transcription/audio`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: {
      // Don't set Content-Type, let browser set it with boundary for FormData
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${response.status} ${errorText}`);
  }

  const result: ApiResponse<TranscriptionResult> = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Transcription failed');
  }

  return result.data;
};

/**
 * Check transcription service health
 * @returns Promise<TranscriptionHealthCheck>
 */
export const checkTranscriptionHealth = async (): Promise<TranscriptionHealthCheck> => {
  const response = await fetch(`${serverOrigin}/v1/transcription/health`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to check transcription service health');
  }

  const result: ApiResponse<TranscriptionHealthCheck> = await response.json();
  return result.data;
};

/**
 * Get transcription service statistics
 * @returns Promise<TranscriptionStats>
 */
export const getTranscriptionStats = async (): Promise<TranscriptionStats> => {
  const response = await fetch(`${serverOrigin}/v1/transcription/stats`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get transcription statistics');
  }

  const result: ApiResponse<TranscriptionStats> = await response.json();
  return result.data;
};
