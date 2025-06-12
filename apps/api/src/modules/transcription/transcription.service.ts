import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
  confidence?: number;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured, transcription service disabled');
      return;
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });

    this.logger.log('Transcription service initialized with OpenAI Whisper');
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string,
    options?: {
      language?: string;
      responseFormat?: 'text' | 'json' | 'verbose_json';
    },
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const fileSize = audioBuffer.length;

    this.logger.log(`Starting transcription for file: ${filename}, size: ${fileSize} bytes`);

    try {
      // Check if service is available
      if (!this.openai) {
        throw new Error('Transcription service not initialized - missing OpenAI API key');
      }

      // Validate file size (Whisper has 25MB limit)
      const maxSizeBytes = 25 * 1024 * 1024; // 25MB
      if (fileSize > maxSizeBytes) {
        throw new Error(`File too large: ${fileSize} bytes (max: ${maxSizeBytes} bytes)`);
      }

      // Estimate duration based on file size (rough estimation)
      const estimatedDuration = this.estimateAudioDuration(fileSize, filename);
      this.logger.debug(`Estimated audio duration: ${estimatedDuration} seconds`);

      // Create file object for OpenAI
      const file = new File([audioBuffer], filename, {
        type: this.getAudioMimeType(filename),
      });

      this.logger.debug(`Calling OpenAI Whisper API with options:`, {
        filename,
        language: options?.language || 'zh',
        responseFormat: options?.responseFormat || 'text',
        fileSize,
      });

      // Call OpenAI Whisper API
      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: options?.language || 'zh', // Default to Chinese
        response_format: options?.responseFormat || 'text',
        // Add prompt to improve accuracy for Chinese
        prompt: '这是一段中文语音，请准确转录。',
      });

      const processingTime = Date.now() - startTime;
      const result: TranscriptionResult = {
        text: typeof transcription === 'string' ? transcription : transcription.text,
        duration: estimatedDuration,
        language: options?.language || 'zh',
      };

      this.logger.log(`Transcription completed successfully`, {
        filename,
        textLength: result.text.length,
        processingTime: `${processingTime}ms`,
        estimatedDuration: `${estimatedDuration}s`,
      });

      this.logger.debug(`Transcription result preview: "${result.text.slice(0, 100)}..."`);

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Transcription failed for file: ${filename}`, {
        error: error.message,
        processingTime: `${processingTime}ms`,
        fileSize,
        stack: error.stack,
      });

      // Re-throw with more context
      if (error.message?.includes('API key')) {
        throw new Error('转录服务配置错误，请联系管理员');
      } else if (error.message?.includes('File too large')) {
        throw new Error('音频文件过大，请选择小于25MB的文件');
      } else if (error.message?.includes('invalid_request_error')) {
        throw new Error('音频文件格式不支持，请使用mp3、wav、m4a等格式');
      } else {
        throw new Error(`转录失败: ${error.message}`);
      }
    }
  }

  /**
   * Check if transcription service is available
   */
  isAvailable(): boolean {
    const available = !!this.openai;
    this.logger.debug(`Transcription service availability check: ${available}`);
    return available;
  }

  /**
   * Get supported audio formats
   */
  getSupportedFormats(): string[] {
    return ['mp3', 'mp4', 'm4a', 'wav', 'webm', 'flac', 'ogg'];
  }

  /**
   * Estimate audio duration based on file size and format
   * This is a rough estimation for logging purposes
   */
  private estimateAudioDuration(fileSize: number, filename: string): number {
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    // Rough bitrate estimates (kbps)
    const bitrateEstimates: Record<string, number> = {
      mp3: 128,
      wav: 1411, // CD quality
      m4a: 128,
      flac: 1000,
      ogg: 128,
      webm: 128,
    };

    const estimatedBitrate = bitrateEstimates[extension] || 128;
    const durationSeconds = Math.round((fileSize * 8) / (estimatedBitrate * 1000));

    this.logger.debug(`Duration estimation for ${extension}:`, {
      fileSize,
      estimatedBitrate: `${estimatedBitrate}kbps`,
      durationSeconds,
    });

    return durationSeconds;
  }

  /**
   * Get MIME type for audio file
   */
  private getAudioMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      flac: 'audio/flac',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
    };

    return mimeTypes[extension] || 'audio/mpeg';
  }
}
