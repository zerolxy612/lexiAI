import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/common/prisma.service';
import {
  DeleteProviderItemRequest,
  DeleteProviderRequest,
  ListProviderItemsData,
  ListProvidersData,
  UpsertProviderItemRequest,
  UpsertProviderRequest,
  User,
} from '@refly/openapi-schema';
import { Provider, ProviderItem } from '@/generated/client';
import { genProviderItemID, genProviderID } from '@refly/utils';
import { ProviderNotFoundError, ProviderItemNotFoundError, ParamsError } from '@refly/errors';
import { SingleFlightCache } from '@/utils/cache';

interface GlobalProviderConfig {
  providers: Provider[];
  items: ProviderItem[];
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

    const items = await this.prisma.providerItem.findMany({
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

    const { items: globalItems } = await this.globalProviderCache.get();
    return [...globalItems, ...items];
  }

  async findProviderItem(user: User, itemId: string) {
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
    const { itemId, name, enabled, config } = param;

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
