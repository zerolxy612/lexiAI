import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/common/prisma.service';
import {
  BatchUpsertProviderItemsRequest,
  DeleteProviderItemRequest,
  DeleteProviderRequest,
  ListProviderItemsData,
  ListProvidersData,
  ProviderCategory,
  UpsertProviderItemRequest,
  UpsertProviderRequest,
  User,
  UserPreferences,
} from '@refly/openapi-schema';
import { Provider, ProviderItem } from '@/generated/client';
import { genProviderItemID, genProviderID, providerInfoList } from '@refly/utils';
import { ProviderNotFoundError, ProviderItemNotFoundError, ParamsError } from '@refly/errors';
import { SingleFlightCache } from '@/utils/cache';
import pLimit from 'p-limit';

interface GlobalProviderConfig {
  providers: Provider[];
  items: (ProviderItem & { provider: Provider })[];
}

const PROVIDER_ITEMS_BATCH_LIMIT = 50;

@Injectable()
export class ProviderService {
  private globalProviderCache: SingleFlightCache<GlobalProviderConfig>;

  constructor(private readonly prisma: PrismaService) {
    this.globalProviderCache = new SingleFlightCache(this.fetchGlobalProviderConfig.bind(this));
  }

  async fetchGlobalProviderConfig(): Promise<GlobalProviderConfig> {
    const providers = await this.prisma.provider.findMany({
      where: {
        isGlobal: true,
        deletedAt: null,
      },
    });

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

    return { providers, items };
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

    return this.prisma.provider.create({
      data: {
        providerId,
        providerKey,
        name,
        apiKey,
        baseUrl: finalBaseUrl,
        enabled,
        categories: categories.join(','),
        uid: user.uid,
      },
    });
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

    return this.prisma.provider.update({
      where: {
        pk: provider.pk,
      },
      data: {
        providerKey,
        name,
        apiKey,
        baseUrl: finalBaseUrl,
        categories: finalCategories.join(','),
        enabled,
      },
    });
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
    });

    // Fetch global provider items
    const { items: globalItems } = await this.globalProviderCache.get();

    // Filter global items based on the same filters applied to user items
    const filteredGlobalItems = globalItems.filter((item) => {
      return (
        (!providerId || item.providerId === providerId) &&
        (!category || item.category === category) &&
        (enabled === undefined || item.enabled === enabled)
      );
    });

    // Create a map of user items by name for fast lookup
    const userItemsByName = new Map();
    for (const item of userItems) {
      if (item?.name) {
        userItemsByName.set(item.name, item);
      }
    }

    // Filter out global items that have a user-specific counterpart with the same name
    const uniqueGlobalItems = filteredGlobalItems.filter(
      (globalItem) => !globalItem?.name || !userItemsByName.has(globalItem.name),
    );

    // Combine user-specific items and unique global items
    return [...userItems, ...uniqueGlobalItems];
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

    return item;
  }

  async findProviderItemByCategory(user: User, category: ProviderCategory) {
    // Prioritize user configured provider item
    const item = await this.prisma.providerItem.findFirst({
      where: { uid: user.uid, category, deletedAt: null },
      include: {
        provider: true,
      },
    });

    if (item) {
      return item;
    }

    // Fallback to global provider item
    const { items: globalItems } = await this.globalProviderCache.get();
    const globalItem = globalItems.find((item) => item.category === category);

    if (globalItem) {
      return globalItem;
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
      return this.prisma.provider.findUnique({
        where: { providerId, uid: user.uid, deletedAt: null },
      });
    }

    const { providers: globalProviders } = await this.globalProviderCache.get();
    const validProviderKeys = providerInfoList
      .filter((info) => info.categories.includes(category))
      .map((info) => info.key);
    const globalProvider = globalProviders.find((provider) =>
      validProviderKeys.includes(provider.providerKey),
    );
    if (globalProvider) {
      return globalProvider;
    }

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
        config: JSON.stringify(config),
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
}
