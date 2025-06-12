// 直接测试 Dify API
require('dotenv').config();
const axios = require('axios');

// API 配置
const apiKey = process.env.HKGAI_API_KEY || 'app-cWHko7usG7aP8ZsAnSeglYc3';
const baseUrl = process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net';

// 测试查询
const query = '测试一下 HKGAI 集成，请告诉我当前日期';

async function testDifyAPI() {
  try {
    console.log('正在测试 Dify API 集成...');
    console.log(`使用 API Key: ${apiKey.substring(0, 8)}...`);
    console.log(`Base URL: ${baseUrl}`);
    console.log(`查询: ${query}`);

    const response = await axios.post(
      `${baseUrl}/v1/chat-messages`,
      {
        inputs: {},
        query,
        response_mode: 'blocking',
        conversation_id: '',
        user: 'user-test',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://lexihk.com',
          'X-Title': 'LexiHK',
        },
      },
    );

    console.log('API 调用成功! HTTP 状态: ' + response.status);
    console.log('返回数据:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('API 调用失败!');

    if (error.response) {
      // 服务器响应了错误状态码
      console.error(`HTTP 状态: ${error.response.status}`);
      console.error('返回数据:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // 请求已发送但未收到响应
      console.error('未收到响应');
      console.error(error.request);
    } else {
      // 请求设置时出错
      console.error('错误信息:', error.message);
    }

    console.error('完整错误:', error);
  }
}

testDifyAPI();
