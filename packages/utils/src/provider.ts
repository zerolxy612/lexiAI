import { ProviderCategory } from '@refly/openapi-schema';

export enum ProviderKey {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OPENROUTER = 'openrouter',
  JINA = 'jina',
  FIREWORKS = 'fireworks',
  SILICON_FLOW = 'siliconflow',
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
    key: ProviderKey.ANTHROPIC,
    name: 'Anthropic',
    categories: ['llm'],
  },
  {
    key: ProviderKey.OPENROUTER,
    name: 'Groq',
    categories: ['llm'],
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
    key: ProviderKey.FIREWORKS,
    name: 'Fireworks',
    categories: ['llm', 'embedding'],
  },
];
