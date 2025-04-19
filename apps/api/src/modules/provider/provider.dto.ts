import { ProviderItem as ProviderItemModel, Provider as ProviderModel } from '@/generated/client';
import { pick } from '@/utils';
import {
  Provider,
  ProviderItem,
  ProviderCategory,
  ModelInfo,
  LLMModelConfig,
} from '@refly/openapi-schema';

export const providerPO2DTO = (provider: ProviderModel): Provider => {
  return {
    ...pick(provider, [
      'providerId',
      'providerKey',
      'name',
      'apiKey',
      'baseUrl',
      'enabled',
      'isGlobal',
    ]),
  };
};

export const providerItemPO2DTO = (
  providerItem: ProviderItemModel & { provider?: ProviderModel },
): ProviderItem => {
  return {
    ...pick(providerItem, ['providerId', 'itemId', 'name', 'enabled']),
    category: providerItem.category as ProviderCategory,
    provider: providerItem.provider ? providerPO2DTO(providerItem.provider) : undefined,
    config: JSON.parse(providerItem.config || '{}'),
  };
};

export const providerItem2ModelInfo = (
  providerItem: ProviderItemModel & { provider?: ProviderModel },
): ModelInfo => {
  const config: LLMModelConfig = JSON.parse(providerItem.config || '{}');
  return {
    name: providerItem.name,
    label: providerItem.name,
    provider: providerItem.provider?.name ?? '',
    // tier: config.tier as ModelTier,
    contextLimit: config.contextLimit ?? 0,
    maxOutput: config?.maxOutput ?? 0,
    capabilities: config?.capabilities ?? {},
    isDefault: false,
  };
};
