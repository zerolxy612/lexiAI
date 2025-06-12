const fetch = require('node-fetch');

const apiUrl = 'http://localhost:5000/v1/skill/streamInvoke';
// 从你的前端获取的认证cookie
const cookie = 'your-cookie-here'; // 需要从浏览器复制实际的cookie

const testPayload = {
  input: {
    query: '测试HKGAI模型是否正常工作',
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
  // 使用HKGAI模型的itemId，从数据库配置中可以看到
  modelItemId: 'hkgai-searchentry-item',
};

console.log('正在测试技能调用...');
console.log('请求载荷:', JSON.stringify(testPayload, null, 2));
console.log('API地址:', apiUrl);

async function testSkillInvoke() {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Cookie': cookie, // 需要实际的认证cookie
        'User-Agent': 'Test-Script/1.0',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`HTTP 状态: ${response.status}`);
    console.log('响应头:', Object.fromEntries(response.headers));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('错误响应:', errorText);
      return;
    }

    // 处理SSE流式响应
    console.log('\n--- 开始接收流式响应 ---');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留最后一行未完成的数据

      for (const line of lines) {
        if (line.trim() === '') continue;

        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          try {
            const parsed = JSON.parse(data);
            console.log('SSE事件:', JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.log('SSE数据:', data);
          }
        } else {
          console.log('SSE行:', line);
        }
      }
    }

    console.log('--- 流式响应结束 ---');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 如果没有认证，先测试不需要认证的接口
async function testHealth() {
  try {
    const response = await fetch('http://localhost:5000/health');
    console.log('健康检查状态:', response.status);
    if (response.ok) {
      const data = await response.text();
      console.log('健康检查响应:', data);
    }
  } catch (error) {
    console.error('健康检查失败:', error);
  }
}

async function testProviderList() {
  try {
    const response = await fetch('http://localhost:5000/v1/provider/list');
    console.log('Provider列表状态:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('Provider列表:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('Provider列表错误:', errorText);
    }
  } catch (error) {
    console.error('Provider列表失败:', error);
  }
}

// 运行测试
console.log('=== 开始测试 ===\n');

testHealth()
  .then(() => testProviderList())
  .then(() => {
    console.log('\n=== 如果你有认证cookie，可以取消注释cookie行并测试完整流程 ===');
    // return testSkillInvoke();
  })
  .catch(console.error);
