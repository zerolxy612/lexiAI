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
}
