import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchResultDto {
  @ApiProperty({
    description: 'Search result title',
    example: 'Artificial Intelligence: A Modern Approach',
  })
  title: string;

  @ApiProperty({
    description: 'Search result URL',
    example: 'https://example.com/ai-history',
  })
  link: string;

  @ApiProperty({
    description: 'Search result snippet/summary',
    example: 'AI development began in the 1950s with Alan Turing...',
  })
  snippet: string;

  @ApiPropertyOptional({
    description: 'Search result display link',
    example: 'example.com',
  })
  displayLink?: string;
}

export class DeepResearchStageDto {
  @ApiProperty({
    description: 'Stage number (0, 1, 2)',
    example: 0,
  })
  stage: number;

  @ApiProperty({
    description: 'Search query used for this stage',
    example: '人工智能的发展历史',
  })
  searchQuery: string;

  @ApiProperty({
    description: 'Search results for this stage',
    type: [SearchResultDto],
  })
  searchResults: SearchResultDto[];

  @ApiProperty({
    description: 'AI generated content for this stage',
    example: '人工智能的发展可以追溯到20世纪50年代...',
  })
  aiContent: string;

  @ApiProperty({
    description: 'Stage completion timestamp',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Stage name',
    example: '基础分析',
  })
  stageName: string;
}

export class DeepResearchResponseDto {
  @ApiProperty({
    description: 'Event type',
    example: 'stage_start',
    enum: [
      'stage_start',
      'stage_progress',
      'stage_complete',
      'search_complete',
      'ai_response',
      'complete',
      'error',
    ],
  })
  type:
    | 'stage_start'
    | 'stage_progress'
    | 'stage_complete'
    | 'search_complete'
    | 'ai_response'
    | 'complete'
    | 'error';

  @ApiPropertyOptional({
    description: 'Stage data',
    type: DeepResearchStageDto,
  })
  stageData?: DeepResearchStageDto;

  @ApiPropertyOptional({
    description: 'Streaming content chunk',
    example: '人工智能的发展历史可以分为几个重要阶段...',
  })
  content?: string;

  @ApiPropertyOptional({
    description: 'Error message if any',
    example: 'Search API rate limit exceeded',
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Progress information',
  })
  progress?: {
    currentStage: number;
    totalStages: number;
    percentage: number;
  };
}
