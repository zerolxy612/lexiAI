import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import pLimit from 'p-limit';
import { Queue } from 'bullmq';
import * as Y from 'yjs';
import { InjectQueue } from '@nestjs/bullmq';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { getWholeParsedContent } from '@refly/utils';
import {
  Prisma,
  SkillTrigger as SkillTriggerModel,
  ActionResult as ActionResultModel,
} from '@/generated/client';
import { Response } from 'express';
import { AIMessageChunk, BaseMessage, MessageContentComplex } from '@langchain/core/dist/messages';
import {
  CreateSkillInstanceRequest,
  CreateSkillTriggerRequest,
  DeleteSkillInstanceRequest,
  DeleteSkillTriggerRequest,
  InvokeSkillRequest,
  ListSkillInstancesData,
  ListSkillTriggersData,
  PinSkillInstanceRequest,
  Resource,
  SkillContext,
  SkillEvent,
  Skill,
  SkillTriggerCreateParam,
  TimerInterval,
  TimerTriggerConfig,
  UnpinSkillInstanceRequest,
  UpdateSkillInstanceRequest,
  UpdateSkillTriggerRequest,
  User,
  Document,
  TokenUsageItem,
  ActionResult,
  ActionStep,
  Artifact,
  ActionMeta,
  ModelScene,
  LLMModelConfig,
  CodeArtifact,
} from '@refly/openapi-schema';
import {
  BaseSkill,
  ReflyService,
  SkillEngine,
  SkillEventMap,
  SkillRunnableConfig,
  SkillRunnableMeta,
  createSkillInventory,
} from '@refly/skill-template';
import {
  detectLanguage,
  genActionResultID,
  genSkillID,
  genSkillTriggerID,
  incrementalMarkdownUpdate,
  safeParseJSON,
  getArtifactContentAndAttributes,
} from '@refly/utils';
import { PrismaService } from '../common/prisma.service';
import {
  QUEUE_SKILL,
  buildSuccessResponse,
  writeSSEResponse,
  pick,
  QUEUE_SYNC_TOKEN_USAGE,
  QUEUE_SKILL_TIMEOUT_CHECK,
  QUEUE_SYNC_REQUEST_USAGE,
  QUEUE_AUTO_NAME_CANVAS,
} from '../../utils';
import { InvokeSkillJobData, SkillTimeoutCheckJobData } from './skill.dto';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { documentPO2DTO, resourcePO2DTO, referencePO2DTO } from '../knowledge/knowledge.dto';
import { ConfigService } from '@nestjs/config';
import { SearchService } from '../search/search.service';
import { RAGService } from '../rag/rag.service';
import { LabelService } from '../label/label.service';
import { labelClassPO2DTO, labelPO2DTO } from '../label/label.dto';
import { SyncRequestUsageJobData, SyncTokenUsageJobData } from '../subscription/subscription.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  ModelUsageQuotaExceeded,
  ParamsError,
  ProjectNotFoundError,
  ProviderItemNotFoundError,
  SkillNotFoundError,
} from '@refly/errors';
import { genBaseRespDataFromError } from '../../utils/exception';
import { CanvasService } from '../canvas/canvas.service';
import { canvasPO2DTO } from '../canvas/canvas.dto';
import { actionResultPO2DTO } from '../action/action.dto';
import { CollabService } from '../collab/collab.service';
import { throttle } from 'lodash';
import { ResultAggregator } from '../../utils/result';
import { CollabContext } from '../collab/collab.dto';
import { DirectConnection } from '@hocuspocus/server';
import { MiscService } from '../misc/misc.service';
import { AutoNameCanvasJobData } from '../canvas/canvas.dto';
import { ParserFactory } from '../knowledge/parsers/factory';
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { projectPO2DTO } from '@/modules/project/project.dto';
import { ProviderService } from '@/modules/provider/provider.service';
import { providerPO2DTO } from '@/modules/provider/provider.dto';
import { codeArtifactPO2DTO } from '@/modules/code-artifact/code-artifact.dto';
import { McpServerService } from '@/modules/mcp-server/mcp-server.service';
import { mcpServerPO2DTO } from '@/modules/mcp-server/mcp-server.dto';
import { HKGAIAdapter } from './hkgai-adapter';

function validateSkillTriggerCreateParam(param: SkillTriggerCreateParam) {
  if (param.triggerType === 'simpleEvent') {
    if (!param.simpleEventName) {
      throw new ParamsError('invalid event trigger config');
    }
  } else if (param.triggerType === 'timer') {
    if (!param.timerConfig) {
      throw new ParamsError('invalid timer trigger config');
    }
  }
}

@Injectable()
export class SkillService {
  private logger = new Logger(SkillService.name);
  private skillEngine: SkillEngine;
  private skillInventory: BaseSkill[];

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private label: LabelService,
    private search: SearchService,
    private knowledge: KnowledgeService,
    private rag: RAGService,
    private canvas: CanvasService,
    private subscription: SubscriptionService,
    private collabService: CollabService,
    private misc: MiscService,
    private codeArtifact: CodeArtifactService,
    private providerService: ProviderService,
    private mcpServerService: McpServerService,

    @InjectQueue(QUEUE_SKILL) private skillQueue: Queue<InvokeSkillJobData>,
    @InjectQueue(QUEUE_SKILL_TIMEOUT_CHECK)
    private timeoutCheckQueue: Queue<SkillTimeoutCheckJobData>,
    @InjectQueue(QUEUE_SYNC_TOKEN_USAGE) private usageReportQueue: Queue<SyncTokenUsageJobData>,
    @InjectQueue(QUEUE_SYNC_REQUEST_USAGE)
    private requestUsageQueue: Queue<SyncRequestUsageJobData>,
    @InjectQueue(QUEUE_AUTO_NAME_CANVAS)
    private autoNameCanvasQueue: Queue<AutoNameCanvasJobData>,
  ) {
    this.skillEngine = new SkillEngine(this.logger, this.buildReflyService());
    this.skillInventory = createSkillInventory(this.skillEngine);
  }

  buildReflyService = (): ReflyService => {
    return {
      listMcpServers: async (user, req) => {
        const servers = await this.mcpServerService.listMcpServers(user, req);
        return buildSuccessResponse(servers.map(mcpServerPO2DTO));
      },
      createCanvas: async (user, req) => {
        const canvas = await this.canvas.createCanvas(user, req);
        return buildSuccessResponse(canvasPO2DTO(canvas));
      },
      listCanvases: async (user, param) => {
        const canvasList = await this.canvas.listCanvases(user, param);
        return buildSuccessResponse(canvasList.map((canvas) => canvasPO2DTO(canvas)));
      },
      deleteCanvas: async (user, param) => {
        await this.canvas.deleteCanvas(user, param);
        return buildSuccessResponse({});
      },
      getDocumentDetail: async (user, param) => {
        const canvas = await this.knowledge.getDocumentDetail(user, param);
        return buildSuccessResponse(documentPO2DTO(canvas));
      },
      createDocument: async (user, req) => {
        const canvas = await this.knowledge.createDocument(user, req);
        return buildSuccessResponse(documentPO2DTO(canvas));
      },
      listDocuments: async (user, param) => {
        const canvasList = await this.knowledge.listDocuments(user, param);
        return buildSuccessResponse(canvasList.map((canvas) => documentPO2DTO(canvas)));
      },
      deleteDocument: async (user, param) => {
        await this.knowledge.deleteDocument(user, param);
        return buildSuccessResponse({});
      },
      getResourceDetail: async (user, req) => {
        const resource = await this.knowledge.getResourceDetail(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      createResource: async (user, req) => {
        const resource = await this.knowledge.createResource(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      batchCreateResource: async (user, req) => {
        const resources = await this.knowledge.batchCreateResource(user, req);
        return buildSuccessResponse(resources.map(resourcePO2DTO));
      },
      updateResource: async (user, req) => {
        const resource = await this.knowledge.updateResource(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      createLabelClass: async (user, req) => {
        const labelClass = await this.label.createLabelClass(user, req);
        return buildSuccessResponse(labelClassPO2DTO(labelClass));
      },
      createLabelInstance: async (user, req) => {
        const labels = await this.label.createLabelInstance(user, req);
        return buildSuccessResponse(labels.map((label) => labelPO2DTO(label)));
      },
      webSearch: async (user, req) => {
        const result = await this.search.webSearch(user, req);
        return buildSuccessResponse(result);
      },
      rerank: async (user, query, results, options) => {
        const result = await this.rag.rerank(user, query, results, options);
        return buildSuccessResponse(result);
      },
      search: async (user, req, options) => {
        const result = await this.search.search(user, req, options);
        return buildSuccessResponse(result);
      },
      addReferences: async (user, req) => {
        const references = await this.knowledge.addReferences(user, req);
        return buildSuccessResponse(references.map(referencePO2DTO));
      },
      deleteReferences: async (user, req) => {
        await this.knowledge.deleteReferences(user, req);
        return buildSuccessResponse({});
      },
      inMemorySearchWithIndexing: async (user, options) => {
        const result = await this.rag.inMemorySearchWithIndexing(user, options);
        return buildSuccessResponse(result);
      },
      crawlUrl: async (user, url) => {
        try {
          const parserFactory = new ParserFactory(this.config, this.providerService);
          const jinaParser = await parserFactory.createWebParser(user, {
            resourceId: `temp-${Date.now()}`,
          });

          const result = await jinaParser.parse(url);

          return {
            title: result.title,
            content: result.content,
            metadata: { ...result.metadata, url },
          };
        } catch (error) {
          this.logger.error(`Failed to crawl URL ${url}: ${error.stack}`);
          return {
            title: '',
            content: '',
            metadata: { url, error: error.message },
          };
        }
      },
    };
  };

  listSkills(): Skill[] {
    const skills = this.skillInventory
      .map((skill) => ({
        name: skill.name,
        icon: skill.icon,
        description: skill.description,
        configSchema: skill.configSchema,
      }))
      // TODO: figure out a better way to filter applicable skills
      .filter((skill) => !['commonQnA', 'editDoc'].includes(skill.name));

    return skills;
  }

  async listSkillInstances(user: User, param: ListSkillInstancesData['query']) {
    const { skillId, sortByPin, page, pageSize } = param;

    const orderBy: Prisma.SkillInstanceOrderByWithRelationInput[] = [{ updatedAt: 'desc' }];
    if (sortByPin) {
      orderBy.unshift({ pinnedAt: { sort: 'desc', nulls: 'last' } });
    }

    return this.prisma.skillInstance.findMany({
      where: { skillId, uid: user.uid, deletedAt: null },
      orderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
  }

  async createSkillInstance(user: User, param: CreateSkillInstanceRequest) {
    const { uid } = user;
    const { instanceList } = param;
    const tplConfigMap = new Map<string, BaseSkill>();

    for (const instance of instanceList) {
      if (!instance.displayName) {
        throw new ParamsError('skill display name is required');
      }
      let tpl = this.skillInventory.find((tpl) => tpl.name === instance.tplName);
      if (!tpl) {
        console.log(`skill ${instance.tplName} not found`);
        tpl = this.skillInventory?.[0];
      }
      tplConfigMap.set(instance.tplName, tpl);
    }

    const instances = await this.prisma.skillInstance.createManyAndReturn({
      data: instanceList.map((instance) => ({
        skillId: genSkillID(),
        uid,
        ...pick(instance, ['tplName', 'displayName', 'description']),
        icon: JSON.stringify(instance.icon ?? tplConfigMap.get(instance.tplName)?.icon),
        ...{
          tplConfig: instance.tplConfig ? JSON.stringify(instance.tplConfig) : undefined,
          configSchema: tplConfigMap.get(instance.tplName)?.configSchema
            ? JSON.stringify(tplConfigMap.get(instance.tplName)?.configSchema)
            : undefined,
          invocationConfig: tplConfigMap.get(instance.tplName)?.invocationConfig
            ? JSON.stringify(tplConfigMap.get(instance.tplName)?.invocationConfig)
            : undefined,
        },
      })),
    });

    return instances;
  }

  async updateSkillInstance(user: User, param: UpdateSkillInstanceRequest) {
    const { uid } = user;
    const { skillId } = param;

    if (!skillId) {
      throw new ParamsError('skill id is required');
    }

    return this.prisma.skillInstance.update({
      where: { skillId, uid, deletedAt: null },
      data: {
        ...pick(param, ['displayName', 'description']),
        tplConfig: param.tplConfig ? JSON.stringify(param.tplConfig) : undefined,
      },
    });
  }

  async pinSkillInstance(user: User, param: PinSkillInstanceRequest) {
    const { uid } = user;
    const { skillId } = param;

    if (!skillId) {
      throw new ParamsError('skill id is required');
    }

    return this.prisma.skillInstance.update({
      where: { skillId, uid, deletedAt: null },
      data: { pinnedAt: new Date() },
    });
  }

  async unpinSkillInstance(user: User, param: UnpinSkillInstanceRequest) {
    const { uid } = user;
    const { skillId } = param;

    if (!skillId) {
      throw new ParamsError('skill id is required');
    }

    return this.prisma.skillInstance.update({
      where: { skillId, uid, deletedAt: null },
      data: { pinnedAt: null },
    });
  }

  async deleteSkillInstance(user: User, param: DeleteSkillInstanceRequest) {
    const { skillId } = param;
    if (!skillId) {
      throw new ParamsError('skill id is required');
    }
    const skill = await this.prisma.skillInstance.findUnique({
      where: { skillId, uid: user.uid, deletedAt: null },
    });
    if (!skill) {
      throw new SkillNotFoundError('skill not found');
    }

    // delete skill and triggers
    const deletedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.skillTrigger.updateMany({
        where: { skillId, uid: user.uid },
        data: { deletedAt },
      }),
      this.prisma.skillInstance.update({
        where: { skillId, uid: user.uid },
        data: { deletedAt },
      }),
    ]);
  }

  async skillInvokePreCheck(user: User, param: InvokeSkillRequest): Promise<InvokeSkillJobData> {
    const { uid } = user;

    const resultId = param.resultId || genActionResultID();

    // Check if the result already exists
    const existingResult = await this.prisma.actionResult.findFirst({
      where: { resultId },
      orderBy: { version: 'desc' },
    });
    if (existingResult) {
      if (existingResult.uid !== uid) {
        throw new ParamsError(`action result ${resultId} already exists for another user`);
      }

      param.input ??= existingResult.input
        ? safeParseJSON(existingResult.input)
        : { query: existingResult.title };

      param.modelName ??= existingResult.modelName;
      param.modelItemId ??= existingResult.providerItemId;
      param.skillName ??= safeParseJSON(existingResult.actionMeta).name;
      param.context ??= safeParseJSON(existingResult.context);
      param.resultHistory ??= safeParseJSON(existingResult.history);
      param.tplConfig ??= safeParseJSON(existingResult.tplConfig);
      param.runtimeConfig ??= safeParseJSON(existingResult.runtimeConfig);
      param.projectId ??= existingResult.projectId;
    }

    param.input ||= { query: '' };
    param.skillName ||= 'commonQnA';

    const defaultModel = await this.providerService.findDefaultProviderItem(user, 'chat');
    param.modelItemId ||= defaultModel?.itemId;

    const modelItemId = param.modelItemId;

    // 检查是否是HKGAI模型，如果是则使用简化流程
    const isHKGAIModelItem = modelItemId && modelItemId.includes('hkgai');

    let providerItem: any;
    let modelProviderMap: any;

    if (isHKGAIModelItem) {
      this.logger.log(`[SkillService] 检测到HKGAI模型，使用简化流程: ${modelItemId}`);

      // 为HKGAI模型创建虚拟的provider item和config
      const hkgaiModelName = modelItemId.replace('-item', '').replace('hkgai-', 'hkgai/');

      providerItem = {
        itemId: modelItemId,
        name: 'HKGAI Model',
        category: 'llm' as const,
        enabled: true,
        tier: 't2' as const,
        providerId: 'hkgai-global',
        provider: {
          providerId: 'hkgai-global',
          providerKey: 'hkgai',
          name: 'HKGAI',
          apiKey: '', // 将使用环境变量
          baseUrl: 'https://dify.hkgai.net',
        },
      };

      const hkgaiConfig = {
        modelId: hkgaiModelName,
        contextLimit: 16384,
        maxOutput: 4096,
        capabilities: {},
      };

      const hkgaiProviderItem = {
        ...providerItem,
        config: JSON.stringify(hkgaiConfig),
      };

      modelProviderMap = {
        chat: hkgaiProviderItem,
        titleGeneration: hkgaiProviderItem,
        queryAnalysis: hkgaiProviderItem,
      };
    } else {
      // 原有的provider查询逻辑
      providerItem = await this.providerService.findProviderItemById(user, modelItemId);

      if (!providerItem || providerItem.category !== 'llm' || !providerItem.enabled) {
        throw new ProviderItemNotFoundError(`provider item ${modelItemId} not valid`);
      }

      modelProviderMap = await this.providerService.prepareModelProviderMap(user, modelItemId);
    }
    param.modelItemId = modelProviderMap.chat.itemId;

    const tiers = [];
    for (const providerItem of Object.values(modelProviderMap)) {
      if ((providerItem as any)?.tier) {
        tiers.push((providerItem as any).tier);
      }
    }

    if (tiers.length > 0) {
      // Check for usage quota
      const usageResult = await this.subscription.checkRequestUsage(user);

      for (const tier of tiers) {
        if (!usageResult[tier]) {
          throw new ModelUsageQuotaExceeded(
            `model provider (${tier}) not available for current plan`,
          );
        }
      }
    }

    const modelConfigMap: Record<ModelScene, LLMModelConfig> = {
      chat: JSON.parse(modelProviderMap.chat.config) as LLMModelConfig,
      titleGeneration: JSON.parse(modelProviderMap.titleGeneration.config) as LLMModelConfig,
      queryAnalysis: JSON.parse(modelProviderMap.queryAnalysis.config) as LLMModelConfig,
    };

    // 检查是否是HKGAI模型
    const isHKGAIModel = HKGAIAdapter.isHKGAIModel(modelConfigMap.chat.modelId || param.modelName);
    if (isHKGAIModel) {
      this.logger.log(`Using HKGAI model: ${modelConfigMap.chat.modelId || param.modelName}`);
      // HKGAI模型的特殊处理逻辑可以在这里添加
    }

    if (param.context) {
      param.context = await this.populateSkillContext(user, param.context);
    }
    if (param.resultHistory) {
      param.resultHistory = await this.populateSkillResultHistory(user, param.resultHistory);
    }
    if (param.projectId) {
      const project = await this.prisma.project.findUnique({
        where: {
          projectId: param.projectId,
          uid: user.uid,
          deletedAt: null,
        },
      });
      if (!project) {
        throw new ProjectNotFoundError(`project ${param.projectId} not found`);
      }
    }

    param.skillName ||= 'commonQnA';
    let skill = this.skillInventory.find((s) => s.name === param.skillName);
    if (!skill) {
      // throw new SkillNotFoundError(`skill ${param.skillName} not found`);
      param.skillName = 'commonQnA';
      skill = this.skillInventory.find((s) => s.name === param.skillName);
    }

    const purgeContext = (context: SkillContext) => {
      // remove actual content from context to save storage
      const contextCopy: SkillContext = safeParseJSON(JSON.stringify(context ?? {}));
      if (contextCopy.resources) {
        for (const { resource } of contextCopy.resources) {
          resource.content = '';
        }
      }
      if (contextCopy.documents) {
        for (const { document } of contextCopy.documents) {
          document.content = '';
        }
      }

      if (contextCopy.codeArtifacts) {
        for (const { codeArtifact } of contextCopy.codeArtifacts) {
          codeArtifact.content = '';
        }
      }

      return contextCopy;
    };

    const purgeResultHistory = (resultHistory: ActionResult[] = []) => {
      // remove extra unnecessary fields from result history to save storage
      return resultHistory?.map((r) => pick(r, ['resultId', 'title']));
    };

    const data: InvokeSkillJobData = {
      ...param,
      uid,
      rawParam: JSON.stringify(param),
      modelConfigMap,
      provider: {
        ...providerPO2DTO(providerItem?.provider),
        apiKey: providerItem?.provider?.apiKey,
      },
    };

    if (existingResult) {
      const [result] = await this.prisma.$transaction([
        this.prisma.actionResult.create({
          data: {
            resultId,
            uid,
            version: (existingResult.version ?? 0) + 1,
            type: 'skill',
            tier: providerItem.tier ?? '',
            status: 'executing',
            title: param.input.query,
            targetId: param.target?.entityId,
            targetType: param.target?.entityType,
            modelName: modelConfigMap.chat.modelId,
            projectId: param.projectId ?? null,
            actionMeta: JSON.stringify({
              type: 'skill',
              name: param.skillName,
              icon: skill.icon,
            } as ActionMeta),
            errors: JSON.stringify([]),
            input: JSON.stringify(param.input),
            context: JSON.stringify(purgeContext(param.context)),
            tplConfig: JSON.stringify(param.tplConfig),
            runtimeConfig: JSON.stringify(param.runtimeConfig),
            history: JSON.stringify(purgeResultHistory(param.resultHistory)),
            providerItemId: providerItem.itemId,
          },
        }),
        // Delete existing step data
        this.prisma.actionStep.updateMany({
          where: { resultId },
          data: { deletedAt: new Date() },
        }),
      ]);
      data.result = actionResultPO2DTO(result);
    } else {
      const result = await this.prisma.actionResult.create({
        data: {
          resultId,
          uid,
          version: 0,
          tier: providerItem.tier,
          targetId: param.target?.entityId,
          targetType: param.target?.entityType,
          title: param.input?.query,
          modelName: modelConfigMap.chat.modelId,
          type: 'skill',
          status: 'executing',
          actionMeta: JSON.stringify({
            type: 'skill',
            name: param.skillName,
            icon: skill.icon,
          } as ActionMeta),
          projectId: param.projectId,
          input: JSON.stringify(param.input),
          context: JSON.stringify(purgeContext(param.context)),
          tplConfig: JSON.stringify(param.tplConfig),
          runtimeConfig: JSON.stringify(param.runtimeConfig),
          history: JSON.stringify(purgeResultHistory(param.resultHistory)),
          providerItemId: providerItem.itemId,
        },
      });
      data.result = actionResultPO2DTO(result);
    }

    return data;
  }

  /**
   * Populate skill context with actual resources and documents.
   * These data can be used in skill invocation.
   */
  async populateSkillContext(user: User, context: SkillContext): Promise<SkillContext> {
    // Populate resources
    if (context.resources?.length > 0) {
      const resourceIds = [
        ...new Set(context.resources.map((item) => item.resourceId).filter((id) => id)),
      ];
      const limit = pLimit(5);
      const resources = await Promise.all(
        resourceIds.map((id) =>
          limit(() => this.knowledge.getResourceDetail(user, { resourceId: id })),
        ),
      );
      const resourceMap = new Map<string, Resource>();
      for (const r of resources) {
        resourceMap.set(r.resourceId, resourcePO2DTO(r));
      }

      for (const item of context.resources) {
        item.resource = resourceMap.get(item.resourceId);
      }
    }

    // Populate documents
    if (context.documents?.length > 0) {
      const docIds = [...new Set(context.documents.map((item) => item.docId).filter((id) => id))];
      const limit = pLimit(5);
      const docs = await Promise.all(
        docIds.map((id) => limit(() => this.knowledge.getDocumentDetail(user, { docId: id }))),
      );
      const docMap = new Map<string, Document>();
      for (const d of docs) {
        docMap.set(d.docId, documentPO2DTO(d));
      }

      for (const item of context.documents) {
        item.document = docMap.get(item.docId);
      }
    }

    // Populate code artifacts
    if (context.codeArtifacts?.length > 0) {
      const artifactIds = [
        ...new Set(context.codeArtifacts.map((item) => item.artifactId).filter((id) => id)),
      ];
      const limit = pLimit(5);
      const artifacts = await Promise.all(
        artifactIds.map((id) => limit(() => this.codeArtifact.getCodeArtifactDetail(user, id))),
      );
      const artifactMap = new Map<string, CodeArtifact>();
      for (const a of artifacts) {
        artifactMap.set(a.artifactId, codeArtifactPO2DTO(a));
      }

      for (const item of context.codeArtifacts) {
        item.codeArtifact = artifactMap.get(item.artifactId);
      }

      // Process code artifacts and add them to contentList
      if (!context.contentList) {
        context.contentList = [];
      }

      const codeArtifactContentList = context.codeArtifacts
        .filter((item) => item.codeArtifact?.content)
        .map((item) => {
          const codeArtifact = item.codeArtifact;
          // For long code content, preserve beginning and end
          const MAX_CONTENT_LENGTH = 10000;
          const PRESERVED_SECTION_LENGTH = 2000;

          let processedContent = codeArtifact.content;

          if (codeArtifact.content.length > MAX_CONTENT_LENGTH) {
            const startContent = codeArtifact.content.substring(0, PRESERVED_SECTION_LENGTH);
            const endContent = codeArtifact.content.substring(
              codeArtifact.content.length - PRESERVED_SECTION_LENGTH,
              codeArtifact.content.length,
            );
            processedContent = `${startContent}\n\n... (content truncated) ...\n\n${endContent}`;
          }

          return {
            title: codeArtifact.title ?? 'Code',
            content: processedContent,
            metadata: {
              domain: 'codeArtifact',
              entityId: item.artifactId,
              title: codeArtifact.title ?? 'Code',
              language: codeArtifact.language,
              artifactType: codeArtifact.type,
            },
          };
        });

      context.contentList.push(...codeArtifactContentList);
    }

    return context;
  }

  /**
   * Populate skill result history with actual result detail and steps.
   */
  async populateSkillResultHistory(user: User, resultHistory: ActionResult[]) {
    // Fetch all results for the given resultIds
    const results = await this.prisma.actionResult.findMany({
      where: { resultId: { in: resultHistory.map((r) => r.resultId) }, uid: user.uid },
    });

    // Group results by resultId and pick the one with the highest version
    const latestResultsMap = new Map<string, ActionResultModel>();
    for (const r of results) {
      const latestResult = latestResultsMap.get(r.resultId);
      if (!latestResult || r.version > latestResult.version) {
        latestResultsMap.set(r.resultId, r);
      }
    }

    const finalResults: ActionResult[] = await Promise.all(
      Array.from(latestResultsMap.entries()).map(async ([resultId, result]) => {
        const steps = await this.prisma.actionStep.findMany({
          where: { resultId, version: result.version },
          orderBy: { order: 'asc' },
        });
        return actionResultPO2DTO({ ...result, steps });
      }),
    );

    // Sort the results by createdAt ascending
    finalResults.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return finalResults;
  }

  async sendInvokeSkillTask(user: User, param: InvokeSkillRequest) {
    const data = await this.skillInvokePreCheck(user, param);
    await this.skillQueue.add('invokeSkill', data);

    return data.result;
  }

  async invokeSkillFromQueue(jobData: InvokeSkillJobData) {
    const { uid } = jobData;
    const user = await this.prisma.user.findFirst({ where: { uid } });
    if (!user) {
      this.logger.warn(`user not found for uid ${uid} when invoking skill: ${uid}`);
      return;
    }

    await this.streamInvokeSkill(user, jobData);
  }

  async invokeSkillFromApi(user: User, param: InvokeSkillRequest, res: Response) {
    const jobData = await this.skillInvokePreCheck(user, param);

    return this.streamInvokeSkill(user, jobData, res);
  }

  async buildLangchainMessages(
    user: User,
    result: ActionResult,
    steps: ActionStep[],
  ): Promise<BaseMessage[]> {
    const query = result.input?.query || result.title;

    // Only create content array if images exist
    let messageContent: string | MessageContentComplex[] = query;
    if (result.input?.images?.length > 0) {
      const imageUrls = await this.misc.generateImageUrls(user, result.input.images);
      messageContent = [
        { type: 'text', text: query },
        ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
      ];
    }

    return [
      new HumanMessage({ content: messageContent }),
      ...(steps?.length > 0
        ? steps.map(
            (step) =>
              new AIMessage({
                content: getWholeParsedContent(step.reasoningContent, step.content),
                additional_kwargs: {
                  skillMeta: result.actionMeta,
                  structuredData: step.structuredData,
                  type: result.type,
                  tplConfig:
                    typeof result.tplConfig === 'string'
                      ? safeParseJSON(result.tplConfig)
                      : result.tplConfig,
                },
              }),
          )
        : []),
    ];
  }

  async buildInvokeConfig(
    user: User,
    data: InvokeSkillJobData & {
      eventListener?: (data: SkillEvent) => void;
    },
  ): Promise<SkillRunnableConfig> {
    const {
      context,
      tplConfig,
      runtimeConfig,
      modelConfigMap,
      provider,
      resultHistory,
      projectId,
      eventListener,
      selectedMcpServers,
    } = data;
    const userPo = await this.prisma.user.findUnique({
      select: { uiLocale: true, outputLocale: true },
      where: { uid: user.uid },
    });
    const outputLocale = data?.locale || userPo?.outputLocale;

    const displayLocale =
      (outputLocale === 'auto' ? await detectLanguage(data?.input?.query) : outputLocale) ||
      userPo.uiLocale ||
      'en';

    // Merge the current context with contexts from result history
    // Current context items have priority, and duplicates are removed

    const config: SkillRunnableConfig = {
      configurable: {
        ...context,
        user,
        modelConfigMap,
        provider,
        locale: displayLocale,
        uiLocale: userPo.uiLocale,
        tplConfig,
        runtimeConfig,
        resultId: data.result?.resultId,
        selectedMcpServers,
      },
    };

    // Add project info if projectId is provided
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { projectId, uid: user.uid, deletedAt: null },
      });
      if (!project) {
        throw new ProjectNotFoundError(`project ${projectId} not found`);
      }
      config.configurable.project = projectPO2DTO(project);
    }

    if (resultHistory?.length > 0) {
      config.configurable.chatHistory = await Promise.all(
        resultHistory.map((r) => this.buildLangchainMessages(user, r, r.steps)),
      ).then((messages) => messages.flat());
    }

    if (eventListener) {
      const emitter = new EventEmitter<SkillEventMap>();

      emitter.on('start', eventListener);
      emitter.on('end', eventListener);
      emitter.on('log', eventListener);
      emitter.on('error', eventListener);
      emitter.on('create_node', eventListener);
      emitter.on('artifact', eventListener);
      emitter.on('structured_data', eventListener);

      config.configurable.emitter = emitter;
    }

    return config;
  }

  async streamInvokeSkill(user: User, data: InvokeSkillJobData, res?: Response) {
    if (res) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.status(200);
    }

    const { resultId, version } = data.result;

    const defaultModel = await this.providerService.findDefaultProviderItem(user, 'chat');
    this.skillEngine.setOptions({ defaultModel: defaultModel?.name });

    try {
      // await this.timeoutCheckQueue.add(
      //   `execution_timeout_check:${resultId}`,
      //   {
      //     uid: user.uid,
      //     resultId,
      //     version,
      //     type: 'execution',
      //   },
      //   { delay: this.config.get('skill.executionTimeout') },
      // );

      await this._invokeSkill(user, data, res);
    } catch (err) {
      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          resultId,
          version,
          content: JSON.stringify(genBaseRespDataFromError(err)),
        });
      }
      this.logger.error(`invoke skill error: ${err.stack}`);
    } finally {
      if (res) {
        res.end('');
      }
    }
  }

  async checkSkillTimeout(param: SkillTimeoutCheckJobData) {
    const { uid, resultId, type, version } = param;

    const timeout: number =
      type === 'idle'
        ? this.config.get('skill.idleTimeout')
        : this.config.get('skill.executionTimeout');

    const result = await this.prisma.actionResult.findFirst({
      where: { uid, resultId, version },
      orderBy: { version: 'desc' },
    });
    if (!result) {
      this.logger.warn(`result not found for resultId: ${resultId}`);
      return;
    }

    if (result.status === 'executing' && result.updatedAt < new Date(Date.now() - timeout)) {
      this.logger.warn(`skill invocation ${type} timeout for resultId: ${resultId}`);
      await this.prisma.actionResult.update({
        where: { pk: result.pk, status: 'executing' },
        data: { status: 'failed', errors: JSON.stringify(['Execution timeout']) },
      });
    } else {
      this.logger.log(`skill invocation settled for resultId: ${resultId}`);
    }
  }

  private async _invokeSkill(user: User, data: InvokeSkillJobData, res?: Response) {
    const { input, result } = data;
    const { resultId, version, actionMeta, tier } = result;

    if (input.images?.length > 0) {
      input.images = await this.misc.generateImageUrls(user, input.images);
    }

    if (tier) {
      await this.requestUsageQueue.add('syncRequestUsage', {
        uid: user.uid,
        tier,
        timestamp: new Date(),
      });
    }

    let aborted = false;

    if (res) {
      res.on('close', () => {
        aborted = true;
      });
    }

    // const job = await this.timeoutCheckQueue.add(
    //   `idle_timeout_check:${resultId}`,
    //   {
    //     uid: user.uid,
    //     resultId,
    //     version,
    //     type: 'idle',
    //   },
    //   { delay: Number.parseInt(this.config.get('skill.idleTimeout')) },
    // );

    // const throttledResetIdleTimeout = throttle(
    //   async () => {
    //     try {
    //       // Get current job state
    //       const jobState = await job.getState();

    //       // Only attempt to change delay if job is in delayed state
    //       if (jobState === 'delayed') {
    //         await job.changeDelay(this.config.get('skill.idleTimeout'));
    //       }
    //     } catch (err) {
    //       this.logger.warn(`Failed to reset idle timeout: ${err.message}`);
    //     }
    //   },
    //   100,
    //   { leading: true, trailing: true },
    // );

    const resultAggregator = new ResultAggregator();

    type ArtifactOutput = Artifact & {
      nodeCreated: boolean; // Whether the canvas node is created
      content: string; // Accumulated content
      connection?: DirectConnection & { document: Y.Doc };
    };
    const artifactMap: Record<string, ArtifactOutput> = {};

    const config = await this.buildInvokeConfig(user, {
      ...data,
      eventListener: async (data: SkillEvent) => {
        if (aborted) {
          this.logger.warn(`skill invocation aborted, ignore event: ${JSON.stringify(data)}`);
          return;
        }

        // await throttledResetIdleTimeout();

        if (res) {
          writeSSEResponse(res, { ...data, resultId, version });
        }

        const { event, structuredData, artifact, log } = data;
        switch (event) {
          case 'log':
            if (log) {
              resultAggregator.addSkillEvent(data);
            }
            return;
          case 'structured_data':
            if (structuredData) {
              resultAggregator.addSkillEvent(data);
            }
            return;
          case 'artifact':
            if (artifact) {
              resultAggregator.addSkillEvent(data);

              const { entityId, type, status } = artifact;
              if (!artifactMap[entityId]) {
                artifactMap[entityId] = { ...artifact, content: '', nodeCreated: false };
              } else {
                // Only update artifact status
                artifactMap[entityId].status = status;
              }

              // Open direct connection to yjs doc if artifact type is document
              if (type === 'document' && !artifactMap[entityId].connection) {
                const doc = await this.prisma.document.findFirst({
                  where: { docId: entityId },
                });
                const collabContext: CollabContext = {
                  user,
                  entity: doc,
                  entityType: 'document',
                };
                const connection = await this.collabService.openDirectConnection(
                  entityId,
                  collabContext,
                );

                this.logger.log(
                  `open direct connection to document ${entityId}, doc: ${JSON.stringify(
                    connection.document?.toJSON(),
                  )}`,
                );
                artifactMap[entityId].connection = connection;
              }
            }
            return;
          case 'error':
            result.errors.push(data.content);
            return;
        }
      },
    });

    const skill = this.skillInventory.find((s) => s.name === data.skillName);

    let runMeta: SkillRunnableMeta | null = null;
    const basicUsageData = {
      uid: user.uid,
      resultId,
      actionMeta,
    };

    const throttledMarkdownUpdate = throttle(
      ({ connection, content }: ArtifactOutput) => {
        incrementalMarkdownUpdate(connection.document, content);
      },
      20,
      {
        leading: true,
        trailing: true,
      },
    );

    const throttledCodeArtifactUpdate = throttle(
      async ({ entityId, content }: ArtifactOutput) => {
        // Extract code content and attributes from content string
        const {
          content: codeContent,
          language,
          type,
          title,
        } = getArtifactContentAndAttributes(content);

        await this.codeArtifact.updateCodeArtifact(user, {
          artifactId: entityId,
          title,
          type,
          language,
          content: codeContent,
          createIfNotExists: true,
        });
      },
      1000,
      { leading: true, trailing: true },
    );

    writeSSEResponse(res, { event: 'start', resultId, version });

    try {
      for await (const event of skill.streamEvents(input, { ...config, version: 'v2' })) {
        if (aborted) {
          if (runMeta) {
            result.errors.push('AbortError');
          }
          throw new Error('AbortError');
        }

        // reset idle timeout check when events are received
        // await throttledResetIdleTimeout();

        runMeta = event.metadata as SkillRunnableMeta;
        const chunk: AIMessageChunk = event.data?.chunk ?? event.data?.output;

        switch (event.event) {
          case 'on_tool_end':
          case 'on_tool_start': {
            // Extract tool_call_chunks from AIMessageChunk
            if (event.metadata.langgraph_node === 'tools' && event.data?.output) {
              // Update result content and forward stream events to client

              const [, , eventName] = event.name?.split('__') ?? event.name;

              const content = event.data?.output
                ? `
<tool_use>
<name>${`${eventName}`}</name>
<arguments>
${event.data?.input ? JSON.stringify({ params: event.data?.input?.input }) : ''}
</arguments>
<result>
${event.data?.output ? JSON.stringify({ response: event.data?.output?.content ?? '' }) : ''}
</result>
</tool_use>
`
                : `
<tool_use>
<name>${`${eventName}`}</name>
<arguments>
${event.data?.input ? JSON.stringify(event.data?.input?.input) : ''}
</arguments>
</tool_use>
`;
              resultAggregator.handleStreamContent(runMeta, content, '');

              writeSSEResponse(res, {
                event: 'stream',
                resultId,
                content,
                step: runMeta?.step,
                structuredData: {
                  toolCallId: event.run_id,
                  name: event.name,
                },
              });
            }
            break;
          }
          case 'on_chat_model_stream': {
            const content = chunk.content.toString();
            const reasoningContent = chunk?.additional_kwargs?.reasoning_content?.toString() || '';

            if ((content || reasoningContent) && res && !runMeta?.suppressOutput) {
              if (runMeta?.artifact) {
                const { entityId } = runMeta.artifact;
                const artifact = artifactMap[entityId];

                // Send create_node event to client if not created
                if (!artifact.nodeCreated) {
                  writeSSEResponse(res, {
                    event: 'create_node',
                    resultId,
                    node: {
                      type: artifact.type,
                      data: { entityId, title: artifact.title },
                    },
                  });
                  artifact.nodeCreated = true;
                }

                // Update artifact content based on type
                artifact.content += content;

                if (artifact.type === 'document' && artifact.connection) {
                  // For document artifacts, update the yjs document
                  throttledMarkdownUpdate(artifact);
                } else if (artifact.type === 'codeArtifact') {
                  // For code artifacts, save to MinIO and database
                  throttledCodeArtifactUpdate(artifact);

                  // Send stream and stream_artifact event to client
                  resultAggregator.handleStreamContent(runMeta, content, reasoningContent);
                  writeSSEResponse(res, {
                    event: 'stream',
                    resultId,
                    content,
                    reasoningContent: reasoningContent || undefined,
                    step: runMeta?.step,
                    artifact: {
                      entityId: artifact.entityId,
                      type: artifact.type,
                      title: artifact.title,
                      status: 'generating',
                    },
                  });
                }
              } else {
                // Update result content and forward stream events to client
                resultAggregator.handleStreamContent(runMeta, content, reasoningContent);
                writeSSEResponse(res, {
                  event: 'stream',
                  resultId,
                  content,
                  reasoningContent,
                  step: runMeta?.step,
                });
              }
            }
            break;
          }
          case 'on_chat_model_end':
            if (runMeta && chunk) {
              // 获取模型名称，优先使用runMeta中的信息
              const modelName = String(runMeta.ls_model_name || runMeta.model_name || 'unknown');

              let providerItem = await this.providerService.findLLMProviderItemByModelID(
                user,
                modelName,
              );

              // 如果找不到provider item，检查是否是HKGAI模型
              if (!providerItem && HKGAIAdapter.isHKGAIModel(modelName)) {
                this.logger.log(`Creating virtual provider item for HKGAI model: ${modelName}`);
                // 为HKGAI模型创建虚拟的provider item
                providerItem = {
                  itemId: `${modelName}-item`,
                  name: 'HKGAI Model',
                  category: 'llm' as const,
                  enabled: true,
                  tier: 't2' as const,
                  provider: {
                    providerId: 'hkgai-provider',
                    name: 'HKGAI',
                    category: 'llm' as const,
                    enabled: true,
                  },
                  modelInfo: {
                    name: modelName,
                    label: `HKGAI ${modelName}`,
                    provider: 'hkgai',
                    tier: 't2' as const,
                    enabled: true,
                    isDefault: false,
                    contextLimit: 16384,
                    maxOutput: 4096,
                    capabilities: {},
                  },
                } as any;
              }

              if (providerItem) {
                // 从chunk中提取token使用信息，chunk可能是不同类型的对象
                const chunkData = chunk as any;
                const usage =
                  chunkData.usage || chunkData.llmOutput?.usage || chunkData.usage_metadata || {};
                const inputTokens =
                  usage.prompt_tokens || usage.promptTokens || usage.input_tokens || 0;
                const outputTokens =
                  usage.completion_tokens || usage.completionTokens || usage.output_tokens || 0;

                this.logger.log(
                  `Token usage for model ${modelName}: Input ${inputTokens}, Output ${outputTokens}`,
                );

                // 创建符合TokenUsageItem接口的使用数据
                const tokenUsageItem: TokenUsageItem = {
                  tier: providerItem.tier || 't2',
                  modelProvider: providerItem.provider?.name || 'hkgai',
                  modelName: modelName,
                  inputTokens: inputTokens,
                  outputTokens: outputTokens,
                };

                // 添加到结果聚合器
                resultAggregator.addUsageItem(runMeta, tokenUsageItem);

                // 发送SSE响应
                if (res) {
                  writeSSEResponse(res, {
                    event: 'token_usage',
                    resultId,
                    tokenUsage: tokenUsageItem,
                    step: runMeta?.step,
                  });
                }

                // 创建token使用同步任务
                const tokenUsage: SyncTokenUsageJobData = {
                  ...basicUsageData,
                  usage: tokenUsageItem,
                  timestamp: new Date(),
                };
                await this.usageReportQueue.add(`usage_report:${resultId}`, tokenUsage);
              } else {
                this.logger.warn(`Provider item not found for model: ${modelName}`);
              }
            }
            break;
        }
      }
    } catch (err) {
      this.logger.error(`invoke skill error: ${err.stack}`);
      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          resultId,
          version,
          error: genBaseRespDataFromError(err.message),
          originError: err.message,
        });
      }
      result.errors.push(err.message);
    } finally {
      for (const artifact of Object.values(artifactMap)) {
        artifact.connection?.disconnect();
      }

      const steps = resultAggregator.getSteps({ resultId, version });

      await this.prisma.$transaction([
        this.prisma.actionResult.updateMany({
          where: { resultId, version },
          data: {
            status: result.errors.length > 0 ? 'failed' : 'finish',
            errors: JSON.stringify(result.errors),
          },
        }),
        this.prisma.actionStep.createMany({ data: steps }),
      ]);

      writeSSEResponse(res, { event: 'end', resultId, version });

      // Check if we need to auto-name the target canvas
      if (data.target?.entityType === 'canvas' && !result.errors.length) {
        const canvas = await this.prisma.canvas.findFirst({
          where: { canvasId: data.target.entityId, uid: user.uid },
        });
        if (canvas && !canvas.title) {
          await this.autoNameCanvasQueue.add('autoNameCanvas', {
            uid: user.uid,
            canvasId: canvas.canvasId,
          });
        }
      }

      if (tier) {
        await this.requestUsageQueue.add('syncRequestUsage', {
          uid: user.uid,
          tier,
          timestamp: new Date(),
        });
      }
    }
  }

  async listSkillTriggers(user: User, param: ListSkillTriggersData['query']) {
    const { skillId, page = 1, pageSize = 10 } = param;

    return this.prisma.skillTrigger.findMany({
      where: { uid: user.uid, skillId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
  }

  async startTimerTrigger(user: User, trigger: SkillTriggerModel) {
    if (!trigger.timerConfig) {
      this.logger.warn(`No timer config found for trigger: ${trigger.triggerId}, cannot start it`);
      return;
    }

    if (trigger.bullJobId) {
      this.logger.warn(`Trigger already bind to a bull job: ${trigger.triggerId}, skip start it`);
      return;
    }

    const timerConfig: TimerTriggerConfig = safeParseJSON(trigger.timerConfig || '{}');
    const { datetime, repeatInterval } = timerConfig;

    const repeatIntervalToMillis: Record<TimerInterval, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    const param: InvokeSkillRequest = {
      input: safeParseJSON(trigger.input || '{}'),
      target: {},
      context: safeParseJSON(trigger.context || '{}'),
      tplConfig: safeParseJSON(trigger.tplConfig || '{}'),
      runtimeConfig: {}, // TODO: add runtime config when trigger is ready
      skillId: trigger.skillId,
      triggerId: trigger.triggerId,
    };

    const job = await this.skillQueue.add(
      'invokeSkill',
      {
        ...param,
        uid: user.uid,
        rawParam: JSON.stringify(param),
      },
      {
        delay: new Date(datetime).getTime() - new Date().getTime(),
        repeat: repeatInterval ? { every: repeatIntervalToMillis[repeatInterval] } : undefined,
      },
    );

    return this.prisma.skillTrigger.update({
      where: { triggerId: trigger.triggerId },
      data: { bullJobId: String(job.id) },
    });
  }

  async stopTimerTrigger(_user: User, trigger: SkillTriggerModel) {
    if (!trigger.bullJobId) {
      this.logger.warn(`No bull job found for trigger: ${trigger.triggerId}, cannot stop it`);
      return;
    }

    const jobToRemove = await this.skillQueue.getJob(trigger.bullJobId);
    if (jobToRemove) {
      await jobToRemove.remove();
    }

    await this.prisma.skillTrigger.update({
      where: { triggerId: trigger.triggerId },
      data: { bullJobId: null },
    });
  }

  async createSkillTrigger(user: User, param: CreateSkillTriggerRequest) {
    const { uid } = user;

    if (param.triggerList.length === 0) {
      throw new ParamsError('trigger list is empty');
    }

    for (const trigger of param.triggerList) {
      validateSkillTriggerCreateParam(trigger);
    }

    const triggers = await this.prisma.skillTrigger.createManyAndReturn({
      data: param.triggerList.map((trigger) => ({
        uid,
        triggerId: genSkillTriggerID(),
        displayName: trigger.displayName,
        ...pick(trigger, ['skillId', 'triggerType', 'simpleEventName']),
        ...{
          timerConfig: trigger.timerConfig ? JSON.stringify(trigger.timerConfig) : undefined,
          input: trigger.input ? JSON.stringify(trigger.input) : undefined,
          context: trigger.context ? JSON.stringify(trigger.context) : undefined,
          tplConfig: trigger.tplConfig ? JSON.stringify(trigger.tplConfig) : undefined,
        },
        enabled: !!trigger.enabled,
      })),
    });

    for (const trigger of triggers) {
      if (trigger.triggerType === 'timer' && trigger.enabled) {
        await this.startTimerTrigger(user, trigger);
      }
    }

    return triggers;
  }

  async updateSkillTrigger(user: User, param: UpdateSkillTriggerRequest) {
    const { uid } = user;
    const { triggerId } = param;
    if (!triggerId) {
      throw new ParamsError('trigger id is required');
    }

    const trigger = await this.prisma.skillTrigger.update({
      where: { triggerId, uid, deletedAt: null },
      data: {
        ...pick(param, ['triggerType', 'displayName', 'enabled', 'simpleEventName']),
        ...{
          timerConfig: param.timerConfig ? JSON.stringify(param.timerConfig) : undefined,
          input: param.input ? JSON.stringify(param.input) : undefined,
          context: param.context ? JSON.stringify(param.context) : undefined,
          tplConfig: param.tplConfig ? JSON.stringify(param.tplConfig) : undefined,
        },
      },
    });

    if (trigger.triggerType === 'timer') {
      if (trigger.enabled && !trigger.bullJobId) {
        await this.startTimerTrigger(user, trigger);
      } else if (!trigger.enabled && trigger.bullJobId) {
        await this.stopTimerTrigger(user, trigger);
      }
    }

    return trigger;
  }

  async deleteSkillTrigger(user: User, param: DeleteSkillTriggerRequest) {
    const { uid } = user;
    const { triggerId } = param;
    if (!triggerId) {
      throw new ParamsError('skill id and trigger id are required');
    }
    const trigger = await this.prisma.skillTrigger.findFirst({
      where: { triggerId, uid, deletedAt: null },
    });
    if (!trigger) {
      throw new ParamsError('trigger not found');
    }

    if (trigger.bullJobId) {
      await this.stopTimerTrigger(user, trigger);
    }

    await this.prisma.skillTrigger.update({
      where: { triggerId: trigger.triggerId, uid: user.uid },
      data: { deletedAt: new Date() },
    });
  }
}
