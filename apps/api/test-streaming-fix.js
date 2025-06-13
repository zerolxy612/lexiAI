async function testStreamingResponse() {
  console.log('测试修改后的HKGAI流式响应...');

  const loginResponse = await fetch('http://localhost:5800/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'admin@refly.ai',
      password: 'admin123',
    }),
  });

  if (!loginResponse.ok) {
    console.error('登录失败:', await loginResponse.text());
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.data.accessToken;
  console.log('登录成功，获取到token');

  // 调用技能API
  const skillResponse = await fetch('http://localhost:5800/skill/stream-invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      skillName: 'commonQnA',
      modelItemId: 'hkgai-missinginfo',
      inputs: {
        query: '测试流式响应',
      },
    }),
  });

  if (!skillResponse.ok) {
    console.error('技能调用失败:', await skillResponse.text());
    return;
  }

  console.log('开始接收流式响应...');

  const reader = skillResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let stepCount = 0;
  let contentReceived = false;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('流式响应结束');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.event === 'stream' && data.content) {
              console.log(`[流式内容] ${data.content}`);
              contentReceived = true;
            } else if (data.step) {
              stepCount++;
              console.log(`[步骤 ${stepCount}] ${data.step.name || 'Unknown'}`);
            } else if (data.event === 'start') {
              console.log('[开始] 技能执行开始');
            } else if (data.event === 'end') {
              console.log('[结束] 技能执行完成');
            }
          } catch (e) {
            console.log(`[原始数据] ${line}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('读取流式响应时出错:', error);
  }

  console.log(`\n测试结果:`);
  console.log(`- 步骤数量: ${stepCount}`);
  console.log(`- 是否接收到内容: ${contentReceived ? '是' : '否'}`);

  if (!contentReceived) {
    console.log('❌ 问题仍然存在：没有接收到流式内容');
  } else {
    console.log('✅ 修复成功：接收到了流式内容');
  }
}

testStreamingResponse().catch(console.error);
