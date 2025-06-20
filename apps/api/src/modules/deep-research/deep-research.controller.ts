import { Controller, Post, Body, Sse, UseGuards, Logger, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { DeepResearchService } from './deep-research.service';
import { DeepResearchRequestDto } from './dto/deep-research-request.dto';
import { DeepResearchResponseDto } from './dto/deep-research-response.dto';
import { User } from '@refly/openapi-schema';

@ApiTags('Deep Research')
@Controller('api/v1/deep-research')
export class DeepResearchController {
  private readonly logger = new Logger(DeepResearchController.name);

  constructor(private readonly deepResearchService: DeepResearchService) {}

  @Post('stream')
  @Sse()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate streaming deep research response',
    description: 'Performs three-stage retrieval analysis with Google search and AI processing',
  })
  @ApiResponse({
    status: 200,
    description: 'Streaming response with three-stage analysis',
    type: DeepResearchResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async generateStream(
    @Body() request: DeepResearchRequestDto,
    @LoginedUser() user: User,
  ): Promise<Observable<MessageEvent>> {
    // Add current user ID to request
    request.currentUserId = user?.uid;

    this.logger.log(`Starting deep research for user ${request.currentUserId}: "${request.query}"`);

    try {
      return this.deepResearchService.generateStream(request);
    } catch (error) {
      this.logger.error('Error in deep research controller:', error);
      throw error;
    }
  }

  @Get('health')
  @ApiOperation({
    summary: 'Check deep research service health',
    description: 'Returns the health status of Google Search and AI model services',
  })
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      googleSearch: boolean;
      aiModel: boolean;
      configuration: boolean;
    };
    timestamp: string;
  }> {
    this.logger.debug('Checking deep research service health');

    const services = await this.deepResearchService.getHealthStatus();

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const healthyServices = Object.values(services).filter(Boolean).length;

    if (healthyServices === 0) {
      status = 'unhealthy';
    } else if (healthyServices < Object.keys(services).length) {
      status = 'degraded';
    }

    return {
      status,
      services,
      timestamp: new Date().toISOString(),
    };
  }
}
