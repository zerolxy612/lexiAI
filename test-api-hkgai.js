// 测试API服务器的HKGAI调用
// 使用Node.js内置的fetch (Node 18+)

async function testAPIHKGAI() {
  console.log('=== 测试API服务器的HKGAI调用 ===');

  // 测试API服务器健康状态
  try {
    const healthResponse = await fetch('http://localhost:5800/');
    if (healthResponse.ok) {
      console.log('✅ API服务器运行正常');
    } else {
      console.log('❌ API服务器健康检查失败');
      return;
    }
  } catch (error) {
    console.log('❌ 无法连接到API服务器:', error.message);
    return;
  }

  // 测试技能调用
  const testPayload = {
    input: {
      query: '你好，请介绍一下你自己',
      images: [],
    },
    target: {},
    context: {
      resources: [],
      documents: [],
      codeArtifacts: [],
    },
    tplConfig: {},
    runtimeConfig: {},
    skillId: 'commonQnA',
    modelItemId: 'hkgai-missinginfo-item', // 使用HKGAI模型
  };

  try {
    console.log('\n--- 发送技能调用请求 ---');
    console.log('请求负载:', JSON.stringify(testPayload, null, 2));

    const response = await fetch('http://localhost:5800/v1/skill/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 注意：这里需要实际的认证token，可能需要先登录获取
        // 'Authorization': 'Bearer your-token-here',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('\n--- 响应状态 ---');
    console.log('状态码:', response.status);
    console.log('状态文本:', response.statusText);

    const responseText = await response.text();
    console.log('\n--- 响应内容 ---');
    console.log('响应:', responseText);

    if (response.ok) {
      console.log('\n✅ 技能调用成功');
    } else {
      console.log('\n❌ 技能调用失败');
    }
  } catch (error) {
    console.error('\n❌ 技能调用出错:', error.message);
  }
}

// 运行测试
testAPIHKGAI();
