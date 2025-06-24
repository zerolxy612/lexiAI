#!/usr/bin/env node

import { validateModelEnvironment, MODEL_CONFIGS } from '../config/model-configs';

/**
 * Validate environment configuration for all models
 */
function validateEnvironment() {
  console.log('🔍 Validating model environment configuration...\n');

  const { valid, missing } = validateModelEnvironment();

  if (valid) {
    console.log('✅ All model API keys are properly configured!\n');
  } else {
    console.log('❌ Missing API keys:\n');
    missing.forEach((envVar) => {
      console.log(`   - ${envVar}`);
    });
    console.log('\n');
  }

  // Show current configuration status
  console.log('📋 Current model configuration status:\n');

  for (const [modelId, config] of Object.entries(MODEL_CONFIGS)) {
    const apiKey = process.env[config.apiKeyEnvVar] || process.env.HKGAI_API_KEY;
    const status = apiKey ? '✅' : '❌';
    const keyPreview = apiKey ? `${apiKey.substring(0, 8)}...` : 'Not set';

    console.log(`${status} ${modelId}`);
    console.log(`   API Key: ${keyPreview}`);
    console.log(`   Base URL: ${config.baseUrl}`);
    console.log(`   Endpoint: ${config.endpoint}`);
    console.log(`   Streaming Required: ${config.requiresStreaming ? 'Yes' : 'No'}`);
    console.log(`   Request Format: ${config.requestFormat}`);
    console.log('');
  }

  // Show environment variable template
  console.log('📝 Environment Variable Template:\n');
  console.log('# Add these to your .env file:');

  const envVars = new Set<string>();
  for (const config of Object.values(MODEL_CONFIGS)) {
    envVars.add(config.apiKeyEnvVar);
  }

  for (const envVar of Array.from(envVars).sort()) {
    console.log(`${envVar}=your_api_key_here`);
  }

  console.log('\n# Optional: Fallback API key for all HKGAI models');
  console.log('HKGAI_API_KEY=your_fallback_api_key_here');

  console.log('\n# Optional: Custom base URLs');
  console.log('HKGAI_BASE_URL=https://dify.hkgai.net');
  console.log('HKGAI_RAG_BASE_URL=https://ragpipeline.hkgai.asia');

  return valid;
}

// Run validation if this script is executed directly
if (require.main === module) {
  const isValid = validateEnvironment();
  process.exit(isValid ? 0 : 1);
}

export { validateEnvironment };
