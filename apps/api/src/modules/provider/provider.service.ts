import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/common/prisma.service';
import {
  BatchUpsertProviderItemsRequest,
  DeleteProviderItemRequest,
  DeleteProviderRequest,
  ListProviderItemOptionsData,
  ListProviderItemsData,
  ListProvidersData,
  LLMModelConfig,
  ModelTier,
  ProviderCategory,
  ProviderItemOption,
  UpsertProviderItemRequest,
  UpsertProviderRequest,
  User,
  UserPreferences,
} from '@refly/openapi-schema';
import { Provider, ProviderItem } from '@/generated/client';
import { genProviderItemID, genProviderID, providerInfoList, pick } from '@refly/utils';
import { ProviderNotFoundError, ProviderItemNotFoundError, ParamsError } from '@refly/errors';
import { SingleFlightCache } from '@/utils/cache';
import { EncryptionService } from '@/modules/common/encryption.service';
import pLimit from 'p-limit';

interface GlobalProviderConfig {
  providers: Provider[];
  items: (ProviderItem & { provider: Provider })[];
}

const PROVIDER_ITEMS_BATCH_LIMIT = 50;

@Injectable()
export class ProviderService {
  private logger = new Logger(ProviderService.name);
  private globalProviderCache: SingleFlightCache<GlobalProviderConfig>;

  constructor(
    private readonly prisma: PrismaService,
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
        uid: user.uid,
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
        uid: user.uid,
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

    // Fetch user's provider items
    return this.prisma.providerItem.findMany({
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
        })),
    });
  }

  async findProviderItemsByCategory(user: User, category: ProviderCategory) {
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
        where: { providerId, uid: user.uid, deletedAt: null },
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
    const { providerId, name, category, enabled, config, order } = param;

    if (!providerId || !category || !name) {
      throw new ParamsError('Invalid model item parameters');
    }

    const provider = await this.prisma.provider.findUnique({
      where: {
        providerId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }

    // Validate config if provider is global
    let finalConfig = config;
    if (provider.isGlobal) {
      const options = await this.listProviderItemOptions(user, { providerId, category });
      const option = options.find((option) => option.name === name);
      if (!option) {
        throw new ParamsError(`Unknown provider item name: ${name}`);
      }
      finalConfig = option.config;
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
        uid: user.uid,
        config: JSON.stringify(finalConfig),
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
        uid: user.uid,
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
        uid: user.uid,
        config: JSON.stringify(item.config),
      })),
    });
  }

  async updateProviderItem(user: User, param: UpsertProviderItemRequest) {
    const { itemId, name, enabled, config, providerId, order } = param;

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
        name,
        enabled,
        providerId,
        order,
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

    try {
      const res = await fetch(`${provider.baseUrl}/models`, {
        headers: {
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
      });

      const data = await res.json();

      return data.data.map(
        (model) =>
          ({
            name: model.name || model.id,
            category,
            config: { modelId: model.id, modelName: model.name || model.id },
          }) as ProviderItemOption,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to list provider item options for provider ${providerId}: ${error.stack}`,
      );
      return [];
    }
  }
}
