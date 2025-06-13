// 测试右键菜单AskAI和Search使用的模型配置
// 运行方式: node test-context-menu-models.js

const models = {
  askAI: {
    name: 'hkgai-general',
    apiKey: 'app-5PTDowg5Dn2MSEhG5n3FBWXs',
    description: 'AskAI使用的通用模型',
    itemId: 'hkgai-general-item',
  },
  search: {
    name: 'hkgai-searchentry',
    apiKey: 'app-mYHumURK2S010ZonuvzeX1Ad',
    description: 'Search使用的搜索入口模型',
    itemId: 'hkgai-searchentry-item',
  },
};

const DIFY_BASE_URL = 'https://dify.hkgai.net';

async function testContextMenuModel(type, modelConfig) {
  console.log(`\n🎯 测试${type}功能使用的模型: ${modelConfig.name}`);
  console.log(`   描述: ${modelConfig.description}`);
  console.log(`   API Key: ${modelConfig.apiKey.substring(0, 8)}...`);
  console.log(`   Item ID: ${modelConfig.itemId}`);

  try {
    const response = await fetch(`${DIFY_BASE_URL}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${modelConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: `你好，我是通过${type}功能调用的，请确认你是${modelConfig.name}模型`,
        response_mode: 'blocking',
        conversation_id: '',
        user: 'test-user',
      }),
    });

    console.log(`   HTTP状态: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ ${type}功能模型响应正常`);
      console.log(`   📝 响应内容: ${result.answer?.substring(0, 100)}...`);
      return { success: true, type, model: modelConfig.name, response: result };
    } else {
      const errorText = await response.text();
      console.log(`   ❌ ${type}功能模型响应失败: ${errorText}`);
      return { success: false, type, model: modelConfig.name, error: errorText };
    }
  } catch (error) {
    console.log(`   ❌ ${type}功能网络错误: ${error.message}`);
    return { success: false, type, model: modelConfig.name, error: error.message };
  }
}

async function testBothModels() {
  console.log('=== 右键菜单模型配置测试 ===');
  console.log('本测试验证AskAI和Search功能使用不同的HKGAI模型');
  console.log(`基础URL: ${DIFY_BASE_URL}`);

  const results = [];

  // 测试AskAI使用的general模型
  const askAIResult = await testContextMenuModel('AskAI', models.askAI);
  results.push(askAIResult);

  // 稍作延迟
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 测试Search使用的searchentry模型
  const searchResult = await testContextMenuModel('Search', models.search);
  results.push(searchResult);

  // 总结报告
  console.log('\n=== 测试总结 ===');
  console.log('✅ 配置验证结果:');
  console.log(`   AskAI → ${models.askAI.name} (${askAIResult.success ? '成功' : '失败'})`);
  console.log(`   Search → ${models.search.name} (${searchResult.success ? '成功' : '失败'})`);

  if (askAIResult.success && searchResult.success) {
    console.log('\n🎉 所有模型配置正确！');
    console.log('   - 右键菜单的AskAI功能将使用hkgai-general模型');
    console.log('   - 右键菜单的Search功能将使用hkgai-searchentry模型');
  } else {
    console.log('\n⚠️  存在配置问题，请检查API密钥和网络连接');
  }

  return results;
}

// 导出模型配置供其他脚本使用
function getModelConfig() {
  return {
    askAI: {
      modelName: models.askAI.name,
      providerItemId: models.askAI.itemId,
      description: models.askAI.description,
    },
    search: {
      modelName: models.search.name,
      providerItemId: models.search.itemId,
      description: models.search.description,
    },
  };
}

// 运行测试
if (require.main === module) {
  testBothModels().catch(console.error);
}

// 导出函数供其他脚本使用
module.exports = {
  testBothModels,
  getModelConfig,
  models,
};
