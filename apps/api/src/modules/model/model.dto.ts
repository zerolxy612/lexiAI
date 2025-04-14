import {
  ModelItem as ModelItemModel,
  ModelProvider as ModelProviderModel,
} from '@/generated/client';
import { pick } from '@/utils';
import { ModelItem, ModelProvider, ModelType } from '@refly/openapi-schema';

export const modelProviderPO2DTO = (modelProvider: ModelProviderModel): ModelProvider => {
  return {
    ...pick(modelProvider, [
      'providerId',
      'providerKey',
      'name',
      'uid',
      'apiKey',
      'baseUrl',
      'enabled',
    ]),
    createdAt: modelProvider.createdAt.toJSON(),
    updatedAt: modelProvider.updatedAt.toJSON(),
  };
};

export const modelItemPO2DTO = (
  modelItem: ModelItemModel & { provider?: ModelProviderModel },
): ModelItem => {
  return {
    ...pick(modelItem, ['providerId', 'itemId', 'modelId', 'name', 'enabled']),
    modelType: modelItem.modelType as ModelType,
    provider: modelItem.provider ? modelProviderPO2DTO(modelItem.provider) : undefined,
    createdAt: modelItem.createdAt.toJSON(),
    updatedAt: modelItem.updatedAt.toJSON(),
  };
};
