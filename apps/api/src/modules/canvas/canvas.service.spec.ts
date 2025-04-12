import { Test, TestingModule } from '@nestjs/testing';
import { CanvasService } from './canvas.service';
import { MiscService } from '../misc/misc.service';
import { createMock } from '@golevelup/ts-jest';
import { PrismaService } from '../common/prisma.service';
import { ElasticsearchService } from '../common/elasticsearch.service';
import { CollabService } from '../collab/collab.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_DELETE_KNOWLEDGE_ENTITY } from '../../utils/const';
import { OSS_INTERNAL, ObjectStorageService } from '@/modules/common/object-storage';

describe('CanvasService', () => {
  let service: CanvasService;

  const prismaService = createMock<PrismaService>();
  const elasticsearchService = createMock<ElasticsearchService>();
  const collabService = createMock<CollabService>();
  const miscService = createMock<MiscService>();
  const oss = createMock<ObjectStorageService>();

  const mockQueue = {
    add: jest.fn(),
  } as unknown as Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanvasService,
        { provide: PrismaService, useValue: prismaService },
        { provide: ElasticsearchService, useValue: elasticsearchService },
        { provide: CollabService, useValue: collabService },
        { provide: MiscService, useValue: miscService },
        { provide: OSS_INTERNAL, useValue: oss },
        { provide: getQueueToken(QUEUE_DELETE_KNOWLEDGE_ENTITY), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<CanvasService>(CanvasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
