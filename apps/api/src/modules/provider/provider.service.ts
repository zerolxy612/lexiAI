import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/common/prisma.service';
import {
  BatchUpsertProviderItemsRequest,
  DeleteProviderItemRequest,
  DeleteProviderRequest,
  EmbeddingModelConfig,
  ListProviderItemOptionsData,
  ListProviderItemsData,
  ListProvidersData,
  LLMModelConfig,
  ModelScene,
  ModelTier,
  ProviderCategory,
  ProviderItemOption,
  RerankerModelConfig,
  UpsertProviderItemRequest,
  UpsertProviderRequest,
  User,
  UserPreferences,
} from '@refly/openapi-schema';
import { Provider as ProviderModel, ProviderItem as ProviderItemModel } from '@/generated/client';
import { genProviderItemID, genProviderID, providerInfoList, pick } from '@refly/utils';
import {
  ProviderNotFoundError,
  ProviderItemNotFoundError,
  ParamsError,
  EmbeddingNotAllowedToChangeError,
  EmbeddingNotConfiguredError,
  ChatModelNotConfiguredError,
} from '@refly/errors';
import { SingleFlightCache } from '@/utils/cache';
import { EncryptionService } from '@/modules/common/encryption.service';
import pLimit from 'p-limit';
import {
  getEmbeddings,
  Embeddings,
  FallbackReranker,
  getReranker,
  getChatModel,
} from '@refly/providers';
import { ConfigService } from '@nestjs/config';
import { QdrantService } from '@/modules/common/qdrant.service';

interface GlobalProviderConfig {
  providers: ProviderModel[];
  items: (ProviderItemModel & { provider: ProviderModel })[];
}

const PROVIDER_ITEMS_BATCH_LIMIT = 50;

@Injectable()
export class ProviderService {
  private logger = new Logger(ProviderService.name);
  private globalProviderCache: SingleFlightCache<GlobalProviderConfig>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrantService: QdrantService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.globalProviderCache = new SingleFlightCache(this.fetchGlobalProviderConfig.bind(this));
  }

  async fetchGlobalProviderConfig(): Promise<GlobalProviderConfig> {
    const providers = await this.prisma.provider.findMany({
      where: {
        isGlobal: true,
        deletedAt: null,
      },
    });

    // Initialize searxng global provider if SEARXNG_BASE_URL is set
    if (process.env.SEARXNG_BASE_URL) {
      const searXngProvider = providers.find((provider) => provider.providerKey === 'searxng');
      if (!searXngProvider) {
        const provider = await this.prisma.provider.create({
          data: {
            providerId: genProviderID(),
            providerKey: 'searxng',
            name: 'SearXNG',
            baseUrl: process.env.SEARXNG_BASE_URL,
            enabled: true,
            categories: 'webSearch',
            isGlobal: true,
          },
        });
        this.logger.log(`Initialized global searxng provider ${provider.providerId}`);

        providers.push(provider);
      }
    }

    // Decrypt API keys for all providers
    const decryptedProviders = providers.map((provider) => ({
      ...provider,
      apiKey: this.encryptionService.decrypt(provider.apiKey),
    }));

    const items = await this.prisma.providerItem.findMany({
      where: {
        providerId: {
          in: providers.map((provider) => provider.providerId),
        },
        uid: null,
        deletedAt: null,
      },
      include: {
        provider: true,
      },
    });

    // Decrypt API keys for all providers included in items
    const decryptedItems = items.map((item) => ({
      ...item,
      provider: {
        ...item.provider,
        apiKey: this.encryptionService.decrypt(item.provider.apiKey),
      },
    }));

    return { providers: decryptedProviders, items: decryptedItems };
  }

  async listProviders(user: User, param: ListProvidersData['query']) {
    const { enabled, providerKey, category } = param;
    const providers = await this.prisma.provider.findMany({
      where: {
        uid: user.uid,
        enabled,
        providerKey,
        deletedAt: null,
        ...(category ? { categories: { contains: category } } : {}),
      },
    });

    const { providers: globalProviders } = await this.globalProviderCache.get();
    return [...globalProviders, ...providers];
  }

  async createProvider(user: User, param: UpsertProviderRequest) {
    const { providerKey, name, apiKey, baseUrl, enabled, categories = [] } = param;

    if (!providerKey || !name) {
      throw new ParamsError('Provider key and name are required');
    }

    // Find the provider info from providerInfoList
    const providerInfo = providerInfoList.find((info) => info.key === providerKey);
    if (!providerInfo) {
      throw new ParamsError(`Unknown provider key: ${providerKey}`);
    }

    // Validate fields based on fieldConfig
    const fieldErrors: string[] = [];

    // Check apiKey requirement
    if (providerInfo.fieldConfig.apiKey.presence === 'required' && !apiKey) {
      fieldErrors.push(`API key is required for ${providerInfo.name} provider`);
    }

    // Check baseUrl requirement
    if (providerInfo.fieldConfig.baseUrl.presence === 'required' && !baseUrl) {
      fieldErrors.push(`Base URL is required for ${providerInfo.name} provider`);
    }

    // Throw error if validation fails
    if (fieldErrors.length > 0) {
      throw new ParamsError(fieldErrors.join('; '));
    }

    const providerId = genProviderID();

    // Use default baseUrl if available and not provided
    const finalBaseUrl = baseUrl || providerInfo.fieldConfig.baseUrl?.defaultValue;

    // Encrypt API key before storing
    const encryptedApiKey = this.encryptionService.encrypt(apiKey);

    const provider = await this.prisma.provider.create({
      data: {
        providerId,
        providerKey,
        name,
        apiKey: encryptedApiKey,
        baseUrl: finalBaseUrl,
        enabled,
        categories: categories.join(','),
        uid: user.uid,
      },
    });

    // Return provider with decrypted API key
    return {
      ...provider,
      apiKey: this.encryptionService.decrypt(provider.apiKey),
    };
  }

  async updateProvider(user: User, param: UpsertProviderRequest) {
    const { providerId, providerKey, name, apiKey, baseUrl, enabled, categories } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.provider.findUnique({
      where: {
        providerId,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }
    if (provider.isGlobal) {
      throw new ParamsError('Global model provider cannot be updated');
    }

    // Only validate if providerKey is being updated
    if (providerKey) {
      // Find the provider info from providerInfoList
      const providerInfo = providerInfoList.find((info) => info.key === providerKey);
      if (!providerInfo) {
        throw new ParamsError(`Unknown provider key: ${providerKey}`);
      }

      // Validate fields based on fieldConfig
      const fieldErrors: string[] = [];

      // Check apiKey requirement
      if (providerInfo.fieldConfig.apiKey.presence === 'required' && apiKey === '') {
        fieldErrors.push(`API key is required for ${providerInfo.name} provider`);
      }

      // Check baseUrl requirement
      if (providerInfo.fieldConfig.baseUrl.presence === 'required' && baseUrl === '') {
        fieldErrors.push(`Base URL is required for ${providerInfo.name} provider`);
      }

      // Throw error if validation fails
      if (fieldErrors.length > 0) {
        throw new ParamsError(fieldErrors.join('; '));
      }
    }

    // Get the provider info for the current or updated provider key
    const providerInfo = providerInfoList.find(
      (info) => info.key === (providerKey || provider.providerKey),
    );
    // Use default baseUrl if available and not provided but required
    const finalBaseUrl =
      baseUrl !== undefined
        ? baseUrl
        : providerInfo?.fieldConfig.baseUrl?.defaultValue || provider.baseUrl;

    const finalCategories = categories || provider.categories.split(',');

    // Encrypt API key if provided
    const encryptedApiKey =
      apiKey !== undefined ? this.encryptionService.encrypt(apiKey) : undefined;

    const updatedProvider = await this.prisma.provider.update({
      where: {
        pk: provider.pk,
      },
      data: {
        providerKey,
        name,
        apiKey: encryptedApiKey,
        baseUrl: finalBaseUrl,
        categories: finalCategories.join(','),
        enabled,
      },
    });

    // Return provider with decrypted API key
    return {
      ...updatedProvider,
      apiKey: this.encryptionService.decrypt(updatedProvider.apiKey),
    };
  }

  async deleteProvider(user: User, param: DeleteProviderRequest) {
    const { providerId } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.provider.findUnique({
      where: {
        providerId,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }
    if (provider.isGlobal) {
      throw new ParamsError('Global model provider cannot be deleted');
    }

    return this.prisma.provider.update({
      where: {
        pk: provider.pk,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async listProviderItems(user: User, param: ListProviderItemsData['query']) {
    const { providerId, category, enabled } = param;

    // First, try to fetch user's provider items
    const userItems = await this.prisma.providerItem.findMany({
      where: {
        uid: user.uid,
        providerId,
        category,
        enabled,
        deletedAt: null,
      },
      include: {
        provider: true,
      },
      orderBy: {
        order: 'asc',
      },
    });

    // If user has their own items, decrypt API keys and return them
    if (userItems.length > 0) {
      return userItems.map((item) => ({
        ...item,
        provider: {
          ...item.provider,
          apiKey: this.encryptionService.decrypt(item.provider.apiKey),
        },
      }));
    }

    // Fallback to global provider items
    const { items: globalItems } = await this.globalProviderCache.get();
    const filteredGlobalItems = globalItems.filter((item) => {
      const matchesProviderId = !providerId || item.providerId === providerId;
      const matchesCategory = !category || item.category === category;
      const matchesEnabled = enabled === undefined || item.enabled === enabled;
      return matchesProviderId && matchesCategory && matchesEnabled;
    });

    return filteredGlobalItems;
  }

  async findProviderItemById(user: User, itemId: string) {
    const item = await this.prisma.providerItem.findUnique({
      where: { itemId, uid: user.uid, deletedAt: null },
      include: {
        provider: true,
      },
    });

    if (!item) {
      return null;
    }

    // Decrypt API key
    return {
      ...item,
      provider: {
        ...item.provider,
        apiKey: this.encryptionService.decrypt(item.provider.apiKey),
      },
    };
  }

  async prepareGlobalProviderItemsForUser(user: User) {
    const { items } = await this.globalProviderCache.get();

    await this.prisma.providerItem.createMany({
      data: items
        .filter((item) => item.enabled)
        .map((item) => ({
          itemId: genProviderItemID(),
          uid: user.uid,
          ...pick(item, ['providerId', 'category', 'name', 'enabled', 'config', 'tier']),
          ...(item.tier ? { groupName: item.tier.toUpperCase() } : {}),
        })),
    });
  }

  private async findProviderItemsByCategory(user: User, category: ProviderCategory) {
    // Prioritize user configured provider item
    const items = await this.prisma.providerItem.findMany({
      where: { uid: user.uid, category, deletedAt: null },
      include: {
        provider: true,
      },
    });

    if (items.length > 0) {
      // Decrypt API key and return
      return items.map((item) => ({
        ...item,
        provider: {
          ...item.provider,
          apiKey: this.encryptionService.decrypt(item.provider.apiKey),
        },
      }));
    }

    // Fallback to global provider items
    const { items: globalItems } = await this.globalProviderCache.get();
    return globalItems.filter((item) => item.category === category);
  }

  async findLLMProviderItemByModelID(user: User, modelId: string) {
    const items = await this.findProviderItemsByCategory(user, 'llm');

    for (const item of items) {
      const config: LLMModelConfig = JSON.parse(item.config);
      if (config.modelId === modelId) {
        return item;
      }
    }

    return null;
  }

  async prepareChatModel(user: User, modelId: string) {
    const item = await this.findLLMProviderItemByModelID(user, modelId);
    if (!item) {
      throw new ChatModelNotConfiguredError();
    }

    const { provider, config } = item;
    const chatConfig: LLMModelConfig = JSON.parse(config);

    return getChatModel(provider, chatConfig);
  }

  /**
   * Prepare embeddings to use according to provider configuration
   * @param user The user to prepare embeddings for
   * @returns The embeddings
   */
  async prepareEmbeddings(user: User): Promise<Embeddings> {
    const providerItems = await this.findProviderItemsByCategory(user, 'embedding');

    // If no provider items found in database, try to use environment variables as fallback
    if (!providerItems?.length) {
      const embeddingsProvider = process.env.EMBEDDINGS_PROVIDER;
      const jinaApiKey = process.env.JINA_API_KEY;

      this.logger.log(
        `Checking environment variables: EMBEDDINGS_PROVIDER=${embeddingsProvider}, JINA_API_KEY=${jinaApiKey ? jinaApiKey.substring(0, 10) + '...' : 'undefined'}`,
      );

      // Check if we have Jina configuration in environment variables
      if (embeddingsProvider === 'jina' && jinaApiKey) {
        this.logger.log(
          'No embedding provider found in database, using Jina from environment variables',
        );

        // Create a mock provider and config for Jina
        const mockProvider = {
          providerKey: 'jina',
          apiKey: jinaApiKey,
          baseUrl: 'https://api.jina.ai',
        };

        const embeddingConfig: EmbeddingModelConfig = {
          modelId: 'jina-embeddings-v3',
          modelName: 'jina-embeddings-v3',
          dimensions: 1024,
          batchSize: 32,
        };

        this.logger.log(
          `Creating Jina embeddings with config: modelId=${embeddingConfig.modelId}, dimensions=${embeddingConfig.dimensions}, batchSize=${embeddingConfig.batchSize}`,
        );
        this.logger.log(
          `Mock provider: providerKey=${mockProvider.providerKey}, baseUrl=${mockProvider.baseUrl}, apiKey=${mockProvider.apiKey.substring(0, 10)}...`,
        );

        return getEmbeddings(mockProvider, embeddingConfig);
      }

      this.logger.warn(
        `Environment variables not configured properly: embeddingsProvider=${embeddingsProvider}, jinaApiKey=${jinaApiKey ? 'present' : 'missing'}`,
      );
      throw new EmbeddingNotConfiguredError();
    }

    const providerItem = providerItems[0];
    const { provider, config } = providerItem;
    const embeddingConfig: EmbeddingModelConfig = JSON.parse(config);

    this.logger.log(
      `Using database embedding provider: ${provider.providerKey}, modelId: ${embeddingConfig.modelId}`,
    );
    return getEmbeddings(provider, embeddingConfig);
  }

  /**
   * Prepare reranker to use according to provider configuration
   * @param user The user to prepare reranker for
   * @returns The reranker
   */
  async prepareReranker(user: User) {
    const providerItems = await this.findProviderItemsByCategory(user, 'reranker');

    // Rerankers are optional, so return null if no provider item is found
    if (!providerItems?.length) {
      return new FallbackReranker();
    }

    const providerItem = providerItems[0];
    const { provider, config } = providerItem;
    const rerankerConfig: RerankerModelConfig = JSON.parse(config);

    return getReranker(provider, rerankerConfig);
  }

  /**
   * Prepare the model provider map for the skill invocation
   * @param user The user to prepare the model provider map for
   * @param modelItemId The modelItemId passed in the skill invocation params
   * @returns The model provider map
   */
  async prepareModelProviderMap(
    user: User,
    modelItemId: string,
  ): Promise<Record<ModelScene, ProviderItemModel>> {
    const userPo = await this.prisma.user.findUnique({
      where: { uid: user.uid },
      select: {
        preferences: true,
      },
    });
    const defaultChatItem = await this.findDefaultProviderItem(user, 'chat', userPo);
    const chatItem = modelItemId
      ? await this.findProviderItemById(user, modelItemId)
      : defaultChatItem;

    if (!chatItem) {
      throw new ProviderItemNotFoundError('chat model not configured');
    }

    if (chatItem.category !== 'llm' || !chatItem.enabled) {
      throw new ProviderItemNotFoundError(`provider item ${modelItemId} not valid`);
    }

    const titleGenerationItem = await this.findDefaultProviderItem(user, 'titleGeneration', userPo);
    const queryAnalysisItem = await this.findDefaultProviderItem(user, 'queryAnalysis', userPo);

    const modelConfigMap: Record<ModelScene, ProviderItemModel> = {
      chat: chatItem,
      titleGeneration: titleGenerationItem,
      queryAnalysis: queryAnalysisItem,
    };

    return modelConfigMap;
  }

  async findDefaultProviderItem(
    user: User,
    scene: ModelScene,
    userPo?: { preferences: string },
  ): Promise<ProviderItemModel> {
    const { preferences } =
      userPo ||
      (await this.prisma.user.findUnique({
        where: { uid: user.uid },
        select: {
          preferences: true,
        },
      }));

    const userPreferences: UserPreferences = JSON.parse(preferences || '{}');
    const { defaultModel } = userPreferences;

    let itemId: string | null = null;
    if (scene === 'chat' && defaultModel?.chat) {
      itemId = defaultModel.chat.itemId;
    }
    if (scene === 'titleGeneration' && defaultModel?.titleGeneration) {
      itemId = defaultModel.titleGeneration.itemId || defaultModel.chat.itemId;
    }
    if (scene === 'queryAnalysis' && defaultModel?.queryAnalysis) {
      itemId = defaultModel.queryAnalysis.itemId || defaultModel.chat.itemId;
    }

    if (itemId) {
      const providerItem = await this.prisma.providerItem.findUnique({
        where: { itemId, uid: user.uid, deletedAt: null },
      });
      if (providerItem) {
        return providerItem;
      }
    }

    // Fallback to the first available item
    this.logger.log(
      `Default provider item for scene ${scene} not found, fallback to the first available model`,
    );
    const availableItems = await this.findProviderItemsByCategory(user, 'llm');
    if (availableItems.length > 0) {
      return availableItems[0];
    }

    return null;
  }

  async findProviderByCategory(user: User, category: ProviderCategory) {
    const { preferences } = await this.prisma.user.findUnique({
      where: { uid: user.uid },
      select: {
        preferences: true,
      },
    });
    const userPreferences: UserPreferences = JSON.parse(preferences || '{}');

    let providerId: string | null = null;
    if (category === 'webSearch' && userPreferences.webSearch) {
      providerId = userPreferences.webSearch?.providerId;
    } else if (category === 'urlParsing' && userPreferences.urlParsing) {
      providerId = userPreferences.urlParsing?.providerId;
    } else if (category === 'pdfParsing' && userPreferences.pdfParsing) {
      providerId = userPreferences.pdfParsing?.providerId;
    }

    if (providerId) {
      const provider = await this.prisma.provider.findUnique({
        where: { providerId, OR: [{ uid: user.uid }, { isGlobal: true }], deletedAt: null },
      });
      if (provider?.enabled) {
        // Decrypt API key and return
        return {
          ...provider,
          apiKey: this.encryptionService.decrypt(provider.apiKey),
        };
      }
      this.logger.warn(`Provider ${providerId} not valid, fallback to search for global provider`);
    }

    const { providers: globalProviders } = await this.globalProviderCache.get();
    const globalProvider = globalProviders.find((provider) =>
      provider.categories.includes(category),
    );
    if (globalProvider) {
      return globalProvider; // Already decrypted by the global provider cache
    }

    this.logger.warn(`No valid provider found for category ${category}`);
    return null;
  }

  async createProviderItem(user: User, param: UpsertProviderItemRequest) {
    const { providerId, name, category, enabled, config, order, group } = param;

    if (!providerId || !category || !name) {
      throw new ParamsError('Invalid model item parameters');
    }

    const provider = await this.prisma.provider.findUnique({
      where: {
        providerId,
        deletedAt: null,
        OR: [{ uid: user.uid }, { isGlobal: true }],
      },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }

    // Validate config if provider is global
    let option: ProviderItemOption | null = null;
    if (provider.isGlobal) {
      const options = await this.listProviderItemOptions(user, { providerId, category });
      option = options.find((option) => option.config?.modelId === config?.modelId);
      if (!option) {
        throw new ParamsError(`Unknown provider item modelId: ${config?.modelId}`);
      }
    }

    const itemId = genProviderItemID();

    return this.prisma.providerItem.create({
      data: {
        itemId,
        category,
        name,
        providerId,
        enabled,
        order,
        groupName: group,
        uid: user.uid,
        tier: option?.tier,
        config: JSON.stringify(option?.config ?? config),
      },
    });
  }

  async batchCreateProviderItems(user: User, param: BatchUpsertProviderItemsRequest) {
    const { items } = param;

    if (!items || items.length === 0) {
      throw new ParamsError('Items are required');
    }

    if (items.length > PROVIDER_ITEMS_BATCH_LIMIT) {
      throw new ParamsError('Too many items to create');
    }

    const providerIds = new Set<string>();

    for (const item of items) {
      if (!item.providerId || !item.category || !item.name) {
        throw new ParamsError('Invalid model item parameters');
      }
      providerIds.add(item.providerId);
    }

    const providerCnt = await this.prisma.provider.count({
      where: {
        providerId: { in: Array.from(providerIds) },
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });
    if (providerCnt !== providerIds.size) {
      throw new ParamsError('Invalid provider IDs');
    }

    return this.prisma.providerItem.createManyAndReturn({
      data: items.map((item) => ({
        itemId: genProviderItemID(),
        category: item.category,
        name: item.name,
        providerId: item.providerId,
        enabled: item.enabled,
        order: item.order,
        group: item.group,
        uid: user.uid,
        config: JSON.stringify(item.config),
      })),
    });
  }

  async updateProviderItem(user: User, param: UpsertProviderItemRequest) {
    const { itemId, name, enabled, config, providerId, order, group } = param;

    if (!itemId) {
      throw new ParamsError('Item ID is required');
    }

    const item = await this.prisma.providerItem.findUnique({
      where: {
        itemId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ProviderItemNotFoundError();
    }

    if (item.category === 'embedding') {
      if (!(await this.qdrantService.isCollectionEmpty())) {
        throw new EmbeddingNotAllowedToChangeError();
      }
    }

    return this.prisma.providerItem.update({
      where: {
        pk: item.pk,
      },
      data: {
        name,
        enabled,
        providerId,
        order,
        groupName: group,
        ...(config ? { config: JSON.stringify(config) } : {}),
      },
    });
  }

  async batchUpdateProviderItems(user: User, param: BatchUpsertProviderItemsRequest) {
    const { items } = param;

    if (!items || items.length === 0) {
      throw new ParamsError('Items are required');
    }

    if (items.length > PROVIDER_ITEMS_BATCH_LIMIT) {
      throw new ParamsError('Too many items to update');
    }

    // Validate all items have an itemId
    for (const item of items) {
      if (!item.itemId) {
        throw new ParamsError('Item ID is required for all items');
      }
    }

    // Find all items to update
    const itemIds = items.map((item) => item.itemId);
    const existingItems = await this.prisma.providerItem.findMany({
      where: {
        itemId: { in: itemIds },
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Verify all requested items exist
    if (existingItems.length !== itemIds.length) {
      throw new ProviderItemNotFoundError('One or more items not found');
    }

    // Create a map of existing items for easy lookup
    const itemMap = new Map();
    for (const item of existingItems) {
      itemMap.set(item.itemId, item);
    }

    // Process updates in parallel
    const limit = pLimit(10);
    const updatePromises = items.map((item) =>
      limit(() => {
        const existingItem = itemMap.get(item.itemId);

        return this.prisma.providerItem.update({
          where: {
            pk: existingItem.pk,
          },
          data: {
            name: item.name,
            enabled: item.enabled,
            providerId: item.providerId,
            order: item.order,
            groupName: item.group,
            ...(item.config ? { config: JSON.stringify(item.config) } : {}),
          },
        });
      }),
    );

    return Promise.all(updatePromises);
  }

  async deleteProviderItem(user: User, param: DeleteProviderItemRequest) {
    const { itemId } = param;

    if (!itemId) {
      throw new ParamsError('Item ID is required');
    }

    const item = await this.prisma.providerItem.findUnique({
      where: {
        itemId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ProviderItemNotFoundError();
    }

    return this.prisma.providerItem.update({
      where: {
        pk: item.pk,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async listProviderItemOptions(
    user: User,
    param: ListProviderItemOptionsData['query'],
  ): Promise<ProviderItemOption[]> {
    const { providerId, category } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.provider.findUnique({
      where: { providerId, deletedAt: null, OR: [{ uid: user.uid }, { isGlobal: true }] },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }

    if (provider.isGlobal) {
      const { items: globalItems } = await this.globalProviderCache.get();
      return globalItems
        .filter(
          (item) => item.providerId === providerId && (!category || item.category === category),
        )
        .map((item) => ({
          name: item.name,
          category: item.category as ProviderCategory,
          tier: item.tier as ModelTier,
          config: JSON.parse(item.config || '{}'),
        }));
    }

    const apiKey = provider.apiKey ? this.encryptionService.decrypt(provider.apiKey) : null;

    try {
      const res = await fetch(`${provider.baseUrl}/models`, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      const data = await res.json();

      return (
        data?.data?.map(
          (model) =>
            ({
              name: model.name || model.id,
              category,
              config: { modelId: model.id, modelName: model.name || model.id },
            }) as ProviderItemOption,
        ) ?? []
      );
    } catch (error) {
      this.logger.warn(
        `Failed to list provider item options for provider ${providerId}: ${error.stack}`,
      );
      return [];
    }
  }
}
