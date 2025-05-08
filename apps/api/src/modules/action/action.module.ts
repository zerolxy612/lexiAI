import { Module } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { CommonModule } from '../common/common.module';
import { ProviderModule } from '../provider/provider.module';

@Module({
  imports: [CommonModule, ProviderModule],
  controllers: [ActionController],
  providers: [ActionService],
  exports: [ActionService],
})
export class ActionModule {}
