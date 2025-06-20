import { IsString, IsArray, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeepResearchRequestDto {
  @ApiProperty({
    description: 'User query for deep research',
    example: '人工智能的发展历史',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: 'Previous conversation messages',
    example: [],
  })
  @IsArray()
  @IsOptional()
  messages?: any[];

  @ApiPropertyOptional({
    description: 'Research stage: 0=basic, 1=extended, 2=deep analysis',
    example: 0,
    enum: [0, 1, 2],
  })
  @IsNumber()
  @IsOptional()
  preGenerationRequired?: number;

  @ApiPropertyOptional({
    description: 'Whether to perform web search',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  search?: boolean = true;

  @ApiPropertyOptional({
    description: 'Current user ID',
  })
  @IsString()
  @IsOptional()
  currentUserId?: string;
}
