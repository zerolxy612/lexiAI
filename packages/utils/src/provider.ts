import { ProviderCategory } from '@refly/openapi-schema';

export interface ProviderInfo {
  key: string;
  name: string;
  categories: ProviderCategory[];
}

export const providerInfoList: ProviderInfo[] = [
  {
    key: 'openai',
    name: 'OpenAI',
    categories: ['llm', 'embedding'],
  },
  {
    key: 'ollama',
    name: 'Ollama',
    categories: ['llm', 'embedding'],
  },
  {
    key: 'jina',
    name: 'Jina',
    categories: ['embedding', 'reranker', 'urlParsing'],
  },
  {
    key: 'fireworks',
    name: 'Fireworks',
    categories: ['llm', 'embedding'],
  },
  {
    key: 'serper',
    name: 'Serper',
    categories: ['webSearch'],
  },
  {
    key: 'tavily',
    name: 'Tavily',
    categories: ['webSearch'],
  },
  {
    key: 'marker',
    name: 'Marker',
    categories: ['pdfParsing'],
  },
];
