import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { QdrantService } from './qdrant.service';
import { ElasticsearchService } from './elasticsearch.service';
import {
  ObjectStorageBackendFactory,
  ObjectStorageService,
  OSS_EXTERNAL,
  OSS_INTERNAL,
} from './object-storage';

@Module({
  providers: [
    PrismaService,
    RedisService,
    QdrantService,
    ElasticsearchService,
    ObjectStorageBackendFactory,
    {
      provide: OSS_EXTERNAL,
      useFactory: (backendFactory: ObjectStorageBackendFactory, configService: ConfigService) => {
        const backendType = configService.get('objectStorage.backend');

        let backendConfig: any;
        if (backendType === 'minio') {
          backendConfig = configService.get('objectStorage.minio.external');
        } else if (backendType === 'fs') {
          backendConfig = configService.get('objectStorage.fs');
        } else {
          throw new Error(`Unknown backend type: ${backendType}`);
        }

        const backend = backendFactory.createBackend({
          type: backendType,
          config: backendConfig,
        });

        return new ObjectStorageService(backend);
      },
      inject: [ObjectStorageBackendFactory, ConfigService],
    },
    {
      provide: OSS_INTERNAL,
      useFactory: (backendFactory: ObjectStorageBackendFactory, configService: ConfigService) => {
        const backendType = configService.get('objectStorage.backend');

        let backendConfig: any;
        if (backendType === 'minio') {
          backendConfig = configService.get('objectStorage.minio.internal');
        } else if (backendType === 'fs') {
          backendConfig = configService.get('objectStorage.fs');
        } else {
          throw new Error(`Unknown backend type: ${backendType}`);
        }

        const backend = backendFactory.createBackend({
          type: backendType,
          config: backendConfig,
        });

        return new ObjectStorageService(backend);
      },
      inject: [ObjectStorageBackendFactory, ConfigService],
    },
  ],
  exports: [
    PrismaService,
    RedisService,
    QdrantService,
    ElasticsearchService,
    OSS_EXTERNAL,
    OSS_INTERNAL,
  ],
})
export class CommonModule {}
