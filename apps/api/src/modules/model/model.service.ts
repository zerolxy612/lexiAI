import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/common/prisma.service';
import {
  DeleteModelItemRequest,
  DeleteModelProviderRequest,
  ListModelItemsData,
  ListModelProvidersData,
  UpsertModelItemRequest,
  UpsertModelProviderRequest,
  User,
} from '@refly/openapi-schema';
import { genModelItemID, genModelProviderID } from '@refly/utils';
import { ModelItemNotFoundError, ModelProviderNotFoundError, ParamsError } from '@refly/errors';

@Injectable()
export class ModelService {
  constructor(private readonly prisma: PrismaService) {}

  async listModelProviders(user: User, param: ListModelProvidersData['query']) {
    const { enabled, providerKey } = param;
    return this.prisma.modelProvider.findMany({
      where: {
        uid: user.uid,
        enabled,
        providerKey,
        deletedAt: null,
      },
    });
  }

  async createModelProvider(user: User, param: UpsertModelProviderRequest) {
    const { providerKey, name, apiKey, baseUrl, enabled } = param;

    if (!providerKey) {
      throw new ParamsError('Provider key is required');
    }

    if (!name) {
      throw new ParamsError('Provider name is required');
    }

    if (!apiKey) {
      throw new ParamsError('API key is required');
    }

    const providerId = genModelProviderID();

    return this.prisma.modelProvider.create({
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

  async updateModelProvider(user: User, param: UpsertModelProviderRequest) {
    const { providerId, providerKey, name, apiKey, baseUrl, enabled } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.modelProvider.findUnique({
      where: {
        providerId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ModelProviderNotFoundError();
    }

    return this.prisma.modelProvider.update({
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

  async deleteModelProvider(user: User, param: DeleteModelProviderRequest) {
    const { providerId } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.modelProvider.findUnique({
      where: {
        providerId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ModelProviderNotFoundError();
    }

    return this.prisma.modelProvider.update({
      where: {
        pk: provider.pk,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async listModelItems(user: User, param: ListModelItemsData['query']) {
    const { providerId, modelType, enabled } = param;

    return this.prisma.modelItem.findMany({
      where: {
        uid: user.uid,
        providerId,
        modelType,
        enabled,
        deletedAt: null,
      },
    });
  }

  async createModelItem(user: User, param: UpsertModelItemRequest) {
    const { providerId, modelId, modelType, name } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    if (!modelId) {
      throw new ParamsError('Model ID is required');
    }

    const provider = await this.prisma.modelProvider.findUnique({
      where: {
        providerId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ModelProviderNotFoundError();
    }

    const itemId = genModelItemID();

    return this.prisma.modelItem.create({
      data: {
        itemId,
        modelId,
        modelType,
        name,
        providerId,
        uid: user.uid,
      },
    });
  }

  async updateModelItem(user: User, param: UpsertModelItemRequest) {
    const { itemId, modelId, modelType, name } = param;

    if (!itemId) {
      throw new ParamsError('Item ID is required');
    }

    const item = await this.prisma.modelItem.findUnique({
      where: {
        itemId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ModelItemNotFoundError();
    }

    return this.prisma.modelItem.update({
      where: {
        pk: item.pk,
      },
      data: {
        modelId,
        modelType,
        name,
      },
    });
  }

  async deleteModelItem(user: User, param: DeleteModelItemRequest) {
    const { itemId } = param;

    if (!itemId) {
      throw new ParamsError('Item ID is required');
    }

    const item = await this.prisma.modelItem.findUnique({
      where: {
        itemId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ModelItemNotFoundError();
    }

    return this.prisma.modelItem.update({
      where: {
        pk: item.pk,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
