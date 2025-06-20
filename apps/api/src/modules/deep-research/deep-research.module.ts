import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeepResearchController } from './deep-research.controller';
import { DeepResearchService } from './deep-research.service';
import { GoogleSearchService } from './google-search.service';
import { HKGAIClientFactory } from '../../utils/llm/hkgai-client-factory';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [ConfigModule, CommonModule],
  controllers: [DeepResearchController],
  providers: [
    DeepResearchService,
    GoogleSearchService,
    HKGAIClientFactory, // Add HKGAIClientFactory to providers
  ],
  exports: [DeepResearchService, GoogleSearchService],
})
export class DeepResearchModule {}
