// 测试所有Dify API模型的状态和可用性
// 运行方式: node test-dify-models.js

const models = [
  {
    name: 'hkgai-searchentry',
    apiKey: 'app-mYHumURK2S010ZonuvzeX1Ad',
    description: '搜索入口模型',
  },
  {
    name: 'hkgai-missinginfo',
    apiKey: 'app-cWHko7usG7aP8ZsAnSeglYc3',
    description: '缺失信息补充模型',
  },
  {
    name: 'hkgai-timeline',
    apiKey: 'app-R9k11qz64Cd86NCsw2ojZVLC',
    description: '时间线模型',
  },
  {
    name: 'hkgai-general',
    apiKey: 'app-5PTDowg5Dn2MSEhG5n3FBWXs',
    description: '通用模型 (1-for general)',
  },
];

const DIFY_BASE_URL = 'https://dify.hkgai.net';

async function testDifyModel(model) {
  console.log(`\n🔍 测试模型: ${model.name} (${model.description})`);
  console.log(`   API Key: ${model.apiKey.substring(0, 8)}...`);

  try {
    const response = await fetch(`${DIFY_BASE_URL}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: '你好，请简单介绍一下你的功能',
        response_mode: 'blocking',
        conversation_id: '',
        user: 'test-user',
      }),
    });

    console.log(`   HTTP状态: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ 模型响应正常`);
      console.log(`   📝 响应内容: ${result.answer?.substring(0, 100)}...`);
      return { success: true, model: model.name, response: result };
    } else {
      const errorText = await response.text();
      console.log(`   ❌ 模型响应失败: ${errorText}`);
      return { success: false, model: model.name, error: errorText };
    }
  } catch (error) {
    console.log(`   ❌ 网络错误: ${error.message}`);
    return { success: false, model: model.name, error: error.message };
  }
}

async function testAllModels() {
  console.log('=== Dify API 模型测试 ===');
  console.log(`基础URL: ${DIFY_BASE_URL}`);

  const results = [];

  for (const model of models) {
    const result = await testDifyModel(model);
    results.push(result);

    // 在测试之间稍作延迟，避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // 总结报告
  console.log('\n=== 测试总结 ===');
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ 成功的模型: ${successful.length}/${results.length}`);
  successful.forEach((r) => console.log(`   - ${r.model}`));

  if (failed.length > 0) {
    console.log(`❌ 失败的模型: ${failed.length}/${results.length}`);
    failed.forEach((r) => console.log(`   - ${r.model}: ${r.error}`));
  }

  return results;
}

// 额外的辅助函数：测试单个模型
async function testSpecificModel(modelName, apiKey) {
  console.log(`\n🎯 单独测试模型: ${modelName}`);
  return await testDifyModel({ name: modelName, apiKey, description: '自定义测试' });
}

// 运行测试
if (require.main === module) {
  testAllModels().catch(console.error);
}

// 导出函数供其他脚本使用
module.exports = {
  testAllModels,
  testSpecificModel,
  models,
};
