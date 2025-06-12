// 添加 ReadableStream polyfill
const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

// 简单测试 HKGAI 集成
require('dotenv').config();
const { DifyChatModel } = require('./dist/utils/models/hkgai-client');
const { HumanMessage } = require('@langchain/core/messages');

// 创建模型实例
const difyModel = new DifyChatModel({
  modelName: 'gpt-3.5-turbo',
  apiKey: process.env.HKGAI_MISSINGINFO_API_KEY || 'app-cWHko7usG7aP8ZsAnSeglYc3',
  baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
  temperature: 0.7,
});

// 测试查询
const messages = [new HumanMessage('测试一下 HKGAI 集成，请告诉我当前日期')];

async function runTest() {
  try {
    console.log('正在测试 HKGAI 集成...');
    console.log(`使用 API Key: ${difyModel.apiKey}`);
    console.log(`Base URL: ${difyModel.baseUrl}`);

    const result = await difyModel._generate(messages);

    console.log('测试成功! 返回结果:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('测试失败!');
    console.error(`错误信息: ${error.message}`);
    console.error(error);
  }
}

runTest();
