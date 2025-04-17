import { ProviderItem as ProviderItemModel, Provider as ProviderModel } from '@/generated/client';
import { pick } from '@/utils';
import { Provider, ProviderItem, ProviderCategory } from '@refly/openapi-schema';

export const providerPO2DTO = (provider: ProviderModel): Provider => {
  return {
    ...pick(provider, ['providerId', 'providerKey', 'name', 'uid', 'apiKey', 'baseUrl', 'enabled']),
    category: provider.category as ProviderCategory,
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
