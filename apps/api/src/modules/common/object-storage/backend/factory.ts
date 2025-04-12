import { Injectable, Logger } from '@nestjs/common';
import { ObjectStorageBackend } from './interface';
import { MinioStorageBackend, MinioConfig } from './minio';
import { FsStorageBackend, FsConfig } from './fs';

export const OBJECT_STORAGE_BACKEND = Symbol('OBJECT_STORAGE_BACKEND');

export type ObjectStorageType = 'minio' | 'fs';

// Define a discriminated union type for storage configurations
export type ObjectStorageConfig =
  | { type: 'fs'; config: FsConfig }
  | { type: 'minio'; config: MinioConfig };

@Injectable()
export class ObjectStorageBackendFactory {
  private readonly logger = new Logger(ObjectStorageBackendFactory.name);

  createBackend(storageConfig: ObjectStorageConfig): ObjectStorageBackend {
    const { type, config } = storageConfig;
    this.logger.log(`Creating storage backend of type: ${type}`);

    switch (type) {
      case 'fs':
        return new FsStorageBackend(config);
      case 'minio':
        return new MinioStorageBackend(config);
      default:
        throw new Error(`Unknown storage backend type '${type}'`);
    }
  }
}
