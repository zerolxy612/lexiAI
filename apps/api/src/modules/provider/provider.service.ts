import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/common/prisma.service';
import {
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

interface GlobalProviderConfig {
  providers: Provider[];
  items: (ProviderItem & { provider: Provider })[];
}

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
    const { enabled, providerKey } = param;
    const providers = await this.prisma.provider.findMany({
      where: {
        uid: user.uid,
        enabled,
        providerKey,
        deletedAt: null,
      },
    });
    const { providers: globalProviders } = await this.globalProviderCache.get();
    return [...globalProviders, ...providers];
  }

  async createProvider(user: User, param: UpsertProviderRequest) {
    const { providerKey, name, apiKey, baseUrl, enabled } = param;

    if (!providerKey || !name || !apiKey) {
      throw new ParamsError('Invalid provider parameters');
    }

    const providerId = genProviderID();

    return this.prisma.provider.create({
      data: {
        providerId,
        providerKey,
        name,
        apiKey,
        baseUrl,
        enabled,
        uid: user.uid,
      },
    });
  }

  async updateProvider(user: User, param: UpsertProviderRequest) {
    const { providerId, providerKey, name, apiKey, baseUrl, enabled } = param;

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

    return this.prisma.provider.update({
      where: {
        pk: provider.pk,
      },
      data: {
        providerKey,
        name,
        apiKey,
        baseUrl,
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
    const { providerId, name, category, enabled, config } = param;

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
        uid: user.uid,
        config: JSON.stringify(config),
      },
    });
  }

  async updateProviderItem(user: User, param: UpsertProviderItemRequest) {
    const { itemId, name, enabled, config, providerId } = param;

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
        ...(config ? { config: JSON.stringify(config) } : {}),
      },
    });
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
