export interface ModelConfig {
  modelId: string;
  providerKey: string;
  // API configuration
  baseUrl: string;
  endpoint: string;
  // Streaming configuration
  supportsStreaming: boolean;
  requiresStreaming: boolean; // Some models like RAG require streaming
  // Request format configuration
  requestFormat: 'openai' | 'dify' | 'hkgai';
  // Response format configuration
  responseFormat: 'openai' | 'dify' | 'hkgai';
  // Special handling flags
  isRagModel: boolean;
  isContractModel: boolean;
  // Default parameters
  defaultTemperature: number;
  // Environment variable for API key
  apiKeyEnvVar: string;
}

// Model configurations registry
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // RAG Models
  'hkgai/rag': {
    modelId: 'hkgai/rag',
    providerKey: 'hkgai',
    baseUrl: process.env.HKGAI_RAG_BASE_URL || 'https://ragpipeline.hkgai.asia',
    endpoint: '/v1/chat/completions',
    supportsStreaming: true,
    requiresStreaming: true, // RAG models must use streaming
    requestFormat: 'openai',
    responseFormat: 'openai',
    isRagModel: true,
    isContractModel: false,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_RAG_API_KEY',
  },

  // Contract Models
  'hkgai/contract': {
    modelId: 'hkgai/contract',
    providerKey: 'hkgai',
    baseUrl: 'https://api.dify.ai',
    endpoint: '/v1/chat-messages',
    supportsStreaming: true,
    requiresStreaming: false,
    requestFormat: 'dify',
    responseFormat: 'dify',
    isRagModel: false,
    isContractModel: true,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_CONTRACT_API_KEY',
  },

  // General HKGAI Models
  'hkgai/general': {
    modelId: 'hkgai/general',
    providerKey: 'hkgai',
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
    endpoint: '/v1/chat-messages',
    supportsStreaming: true,
    requiresStreaming: false,
    requestFormat: 'hkgai',
    responseFormat: 'hkgai',
    isRagModel: false,
    isContractModel: false,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_GENERAL_API_KEY',
  },

  'hkgai/searchentry': {
    modelId: 'hkgai/searchentry',
    providerKey: 'hkgai',
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
    endpoint: '/v1/chat-messages',
    supportsStreaming: true,
    requiresStreaming: false,
    requestFormat: 'hkgai',
    responseFormat: 'hkgai',
    isRagModel: false,
    isContractModel: false,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_SEARCHENTRY_API_KEY',
  },

  'hkgai/missinginfo': {
    modelId: 'hkgai/missinginfo',
    providerKey: 'hkgai',
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
    endpoint: '/v1/chat-messages',
    supportsStreaming: true,
    requiresStreaming: false,
    requestFormat: 'hkgai',
    responseFormat: 'hkgai',
    isRagModel: false,
    isContractModel: false,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_MISSINGINFO_API_KEY',
  },

  'hkgai/timeline': {
    modelId: 'hkgai/timeline',
    providerKey: 'hkgai',
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
    endpoint: '/v1/chat-messages',
    supportsStreaming: true,
    requiresStreaming: false,
    requestFormat: 'hkgai',
    responseFormat: 'hkgai',
    isRagModel: false,
    isContractModel: false,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_TIMELINE_API_KEY',
  },

  'hkgai/case-search': {
    modelId: 'hkgai/case-search',
    providerKey: 'hkgai',
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
    endpoint: '/v1/chat-messages',
    supportsStreaming: true,
    requiresStreaming: false,
    requestFormat: 'hkgai',
    responseFormat: 'hkgai',
    isRagModel: false,
    isContractModel: false,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_CASE_SEARCH_API_KEY',
  },

  'hkgai/code-search': {
    modelId: 'hkgai/code-search',
    providerKey: 'hkgai',
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
    endpoint: '/v1/chat-messages',
    supportsStreaming: true,
    requiresStreaming: false,
    requestFormat: 'hkgai',
    responseFormat: 'hkgai',
    isRagModel: false,
    isContractModel: false,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_CODE_SEARCH_API_KEY',
  },
};

/**
 * Get model configuration by model ID
 */
export function getModelConfig(modelId: string): ModelConfig | null {
  return MODEL_CONFIGS[modelId] || null;
}

/**
 * Check if a model requires streaming
 */
export function modelRequiresStreaming(modelId: string): boolean {
  const config = getModelConfig(modelId);
  return config?.requiresStreaming ?? false;
}

/**
 * Check if a model supports streaming
 */
export function modelSupportsStreaming(modelId: string): boolean {
  const config = getModelConfig(modelId);
  return config?.supportsStreaming ?? true;
}

/**
 * Get API key for a model from environment variables
 */
export function getModelApiKey(modelId: string): string | null {
  const config = getModelConfig(modelId);
  if (!config) return null;

  return process.env[config.apiKeyEnvVar] || process.env.HKGAI_API_KEY || null;
}

/**
 * Validate that all required environment variables are set
 */
export function validateModelEnvironment(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const [modelId, config] of Object.entries(MODEL_CONFIGS)) {
    const apiKey = process.env[config.apiKeyEnvVar];
    if (!apiKey && !process.env.HKGAI_API_KEY) {
      missing.push(`${config.apiKeyEnvVar} (for ${modelId})`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
