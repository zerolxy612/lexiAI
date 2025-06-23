import { ModelConfigManager } from './packages/providers/src/config/model-config-manager';

async function testModelConfig() {
  console.log('🧪 Testing model configuration...');

  try {
    const manager = new ModelConfigManager();

    console.log('\n🔍 Getting all model configurations...');
    const allConfigs = await manager.getAllModelConfigs();

    console.log(`\n📊 Found ${allConfigs.length} total model configurations:`);
    allConfigs.forEach((config) => {
      console.log(`  - ${config.modelName} (${config.provider}) -> ${config.baseUrl}`);
    });

    console.log('\n🎯 Testing specific new models...');

    // Test case-search model
    const caseSearchConfig = await manager.getModelConfig('hkgai/case-search');
    if (caseSearchConfig) {
      console.log('✅ Case Search Model found:', {
        name: caseSearchConfig.modelName,
        provider: caseSearchConfig.provider,
        baseUrl: caseSearchConfig.baseUrl,
        hasApiKey: !!caseSearchConfig.apiKey,
      });
    } else {
      console.log('❌ Case Search Model NOT found');
    }

    // Test code-search model
    const codeSearchConfig = await manager.getModelConfig('hkgai/code-search');
    if (codeSearchConfig) {
      console.log('✅ Code Search Model found:', {
        name: codeSearchConfig.modelName,
        provider: codeSearchConfig.provider,
        baseUrl: codeSearchConfig.baseUrl,
        hasApiKey: !!codeSearchConfig.apiKey,
      });
    } else {
      console.log('❌ Code Search Model NOT found');
    }

    console.log('\n🔧 Environment variables check:');
    console.log(
      '  - HKGAI_CASE_SEARCH_API_KEY:',
      process.env.HKGAI_CASE_SEARCH_API_KEY ? 'SET' : 'NOT SET',
    );
    console.log(
      '  - HKGAI_CODE_SEARCH_API_KEY:',
      process.env.HKGAI_CODE_SEARCH_API_KEY ? 'SET' : 'NOT SET',
    );
    console.log(
      '  - HKGAI_DIFY_BASE_URL:',
      process.env.HKGAI_DIFY_BASE_URL || 'https://dify.hkgai.net (default)',
    );
  } catch (error) {
    console.error('❌ Error testing model config:', error);
  }
}

testModelConfig();
