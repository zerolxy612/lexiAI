import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { TranscriptionService } from './transcription.service';
import { buildSuccessResponse } from '../../utils/response';

@ApiTags('transcription')
@Controller('v1/transcription')
export class TranscriptionController {
  private readonly logger = new Logger(TranscriptionController.name);

  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check transcription service health' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async getHealth() {
    this.logger.log('Health check requested');

    const isAvailable = this.transcriptionService.isAvailable();
    const supportedFormats = this.transcriptionService.getSupportedFormats();

    const health = {
      status: isAvailable ? 'healthy' : 'unavailable',
      service: 'OpenAI Whisper',
      supportedFormats,
      timestamp: new Date().toISOString(),
    };

    this.logger.log('Health check result:', health);
    return buildSuccessResponse(health);
  }

  @Post('audio')
  @UseInterceptors(FileInterceptor('audio'))
  @ApiOperation({ summary: 'Transcribe audio file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Transcription completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            duration: { type: 'number' },
            language: { type: 'string' },
            filename: { type: 'string' },
            fileSize: { type: 'number' },
            processingTimeMs: { type: 'number' },
            requestId: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or service unavailable',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - transcription failed',
  })
  async transcribeAudio(@UploadedFile() file: Express.Multer.File) {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    this.logger.log(`[${requestId}] Transcription request received`, {
      filename: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
    });

    try {
      // Validate input
      if (!file) {
        this.logger.warn(`[${requestId}] No file provided in request`);
        throw new BadRequestException('No audio file provided');
      }

      // Check service availability
      if (!this.transcriptionService.isAvailable()) {
        this.logger.error(`[${requestId}] Transcription service not available`);
        throw new BadRequestException('转录服务暂不可用，请联系管理员配置');
      }

      // Validate file type
      const supportedMimeTypes = [
        'audio/mpeg', // mp3
        'audio/wav', // wav
        'audio/mp4', // m4a
        'audio/flac', // flac
        'audio/ogg', // ogg
        'audio/webm', // webm
      ];

      if (!supportedMimeTypes.includes(file.mimetype)) {
        this.logger.warn(`[${requestId}] Unsupported file type: ${file.mimetype}`);
        throw new BadRequestException(
          `不支持的音频格式: ${file.mimetype}。支持的格式: ${supportedMimeTypes.join(', ')}`,
        );
      }

      this.logger.log(`[${requestId}] Starting transcription process`);

      // Call transcription service
      const result = await this.transcriptionService.transcribeAudio(
        file.buffer,
        file.originalname,
      );

      const processingTime = Date.now() - startTime;

      const response = {
        ...result,
        filename: file.originalname,
        fileSize: file.size,
        processingTimeMs: processingTime,
        requestId,
      };

      this.logger.log(`[${requestId}] Transcription completed successfully`, {
        textLength: result.text.length,
        duration: result.duration,
        processingTimeMs: processingTime,
      });

      return buildSuccessResponse(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`[${requestId}] Transcription failed`, {
        error: error.message,
        processingTimeMs: processingTime,
        filename: file?.originalname,
        stack: error.stack,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(`转录失败: ${error.message || '未知错误'}`);
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transcription service statistics' })
  @ApiResponse({ status: 200, description: 'Service statistics' })
  async getStats() {
    this.logger.log('Statistics requested');

    const stats = {
      service: 'OpenAI Whisper',
      version: '1.0.0',
      supportedFormats: this.transcriptionService.getSupportedFormats(),
      maxFileSize: '25MB',
      isAvailable: this.transcriptionService.isAvailable(),
      timestamp: new Date().toISOString(),
    };

    this.logger.debug('Service statistics:', stats);
    return buildSuccessResponse(stats);
  }
}
