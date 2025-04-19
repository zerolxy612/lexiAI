import { ProviderCategory } from '@refly/openapi-schema';

export enum ProviderKey {
  OPENAI = 'openai',
  OLLAMA = 'ollama',
  JINA = 'jina',
  FIREWORKS = 'fireworks',
  SERPER = 'serper',
  TAVILY = 'tavily',
}

export interface ProviderInfo {
  key: ProviderKey;
  name: string;
  categories: ProviderCategory[];
}

export const providerInfoList: ProviderInfo[] = [
  {
    key: ProviderKey.OPENAI,
    name: 'OpenAI',
    categories: ['llm', 'embedding'],
  },
  {
    key: ProviderKey.OLLAMA,
    name: 'Ollama',
    categories: ['llm', 'embedding'],
  },
  {
    key: ProviderKey.JINA,
    name: 'Jina',
    categories: ['embedding', 'reranker', 'parser'],
  },
  {
    key: ProviderKey.FIREWORKS,
    name: 'Fireworks',
    categories: ['llm', 'embedding'],
  },
  {
    key: ProviderKey.SERPER,
    name: 'Serper',
    categories: ['webSearch'],
  },
  {
    key: ProviderKey.TAVILY,
    name: 'Tavily',
    categories: ['webSearch'],
  },
];
