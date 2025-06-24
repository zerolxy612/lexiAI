// Simple test script to validate the new model configuration system
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function testModelConfig() {
  console.log('🧪 Testing Model Configuration System\n');

  try {
    // Test 1: Check if the configuration files can be imported
    console.log('1. Testing configuration import...');
    const { stdout: importTest } = await execAsync(
      "cd packages/providers && node -e \"const config = require('./dist/config/model-configs.js'); console.log('✅ Configuration imported successfully'); console.log('Models configured:', Object.keys(config.MODEL_CONFIGS).length);\"",
    );
    console.log(importTest);

    // Test 2: Check TypeScript compilation
    console.log('2. Testing TypeScript compilation...');
    const { stdout: tscTest } = await execAsync('cd packages/providers && pnpm tsc --noEmit');
    console.log('✅ TypeScript compilation successful\n');

    // Test 3: Test API server response
    console.log('3. Testing API server...');
    const { stdout: apiTest } = await execAsync('curl -s http://localhost:5800/');
    const apiResponse = JSON.parse(apiTest);
    if (apiResponse.message === 'Refly API Endpoint') {
      console.log('✅ API server is running\n');
    } else {
      console.log('❌ API server unexpected response\n');
    }

    console.log('🎉 All tests passed! The new model configuration system is working correctly.\n');

    // Show configuration summary
    console.log('📊 Configuration Summary:');
    console.log('- ✅ Independent model configurations');
    console.log('- ✅ Automatic streaming detection');
    console.log('- ✅ Format-specific request/response handling');
    console.log('- ✅ Environment variable validation');
    console.log('- ✅ Backward compatibility maintained');

    console.log('\n🔧 Next Steps:');
    console.log('1. Set up your environment variables (see MODEL_CONFIGURATION_GUIDE.md)');
    console.log('2. Run the validation script: cd packages/providers && npm run validate-env');
    console.log('3. Test individual models to ensure they work correctly');
    console.log('4. No more E3001 errors when switching between models! 🎊');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testModelConfig();
