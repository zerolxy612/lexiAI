import { RerankerModelConfig } from '@refly/openapi-schema';
import { BaseReranker } from './base';
import { JinaReranker } from './jina';
import { BaseProvider } from '../types';

export const getReranker = (provider: BaseProvider, config: RerankerModelConfig): BaseReranker => {
  switch (provider.providerKey) {
    case 'jina':
      return new JinaReranker({
        ...config,
        apiKey: provider.apiKey,
      });
    default:
      throw new Error(`Unsupported reranker provider: ${provider.providerKey}`);
  }
};

export * from './base';
export * from './fallback';
export * from './jina';
