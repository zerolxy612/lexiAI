/**
 * Test script to verify HKGAI streaming functionality
 * This script tests the real-time streaming response from HKGAI models
 */

const fetch = require('node-fetch');

const TEST_CONFIG = {
  baseUrl: 'http://localhost:5800',
  credentials: {
    email: 'admin@refly.ai',
    password: 'admin123',
  },
  testQuery: '请简单介绍一下人工智能的发展历史',
  models: ['hkgai-general', 'hkgai-searchentry', 'hkgai-missinginfo'],
};

async function login() {
  console.log('🔐 Logging in...');

  const response = await fetch(`${TEST_CONFIG.baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(TEST_CONFIG.credentials),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ Login successful');
  return data.data.accessToken;
}

async function testStreamingResponse(token, modelName) {
  console.log(`\n🧪 Testing streaming for model: ${modelName}`);
  console.log('─'.repeat(50));

  const startTime = Date.now();
  let chunkCount = 0;
  let totalContent = '';
  let firstChunkTime = null;

  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/skill/stream-invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        skillName: 'commonQnA',
        modelItemId: modelName,
        inputs: {
          query: TEST_CONFIG.testQuery,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    console.log('📡 Started receiving stream...');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('🏁 Stream completed');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.substring(6));

          if (data.event === 'stream' && data.content) {
            chunkCount++;
            totalContent += data.content;

            if (!firstChunkTime) {
              firstChunkTime = Date.now();
              console.log(`⚡ First chunk received after ${firstChunkTime - startTime}ms`);
            }

            // Show streaming progress
            const contentPreview = data.content.substring(0, 30).replace(/\n/g, '\\n');
            console.log(
              `📄 Chunk ${chunkCount}: "${contentPreview}..." (${data.content.length} chars)`,
            );
          }

          if (data.event === 'end' || data.event === 'done') {
            console.log('✅ Stream ended successfully');
            break;
          }
        } catch (parseError) {
          console.warn('⚠️  Parse error:', parseError.message);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const timeToFirstChunk = firstChunkTime ? firstChunkTime - startTime : null;

    console.log('\n📊 Streaming Statistics:');
    console.log(`   Total chunks: ${chunkCount}`);
    console.log(`   Total content: ${totalContent.length} characters`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Time to first chunk: ${timeToFirstChunk}ms`);
    console.log(
      `   Average chunk size: ${chunkCount > 0 ? Math.round(totalContent.length / chunkCount) : 0} chars`,
    );

    if (chunkCount > 0) {
      console.log('✅ Streaming test PASSED - received real-time chunks');
    } else {
      console.log('❌ Streaming test FAILED - no chunks received');
    }

    return {
      success: chunkCount > 0,
      chunkCount,
      totalContent: totalContent.length,
      totalTime,
      timeToFirstChunk,
    };
  } catch (error) {
    console.error('❌ Streaming test ERROR:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runAllTests() {
  console.log('🚀 Starting HKGAI Streaming Tests');
  console.log('=' + '='.repeat(50));

  try {
    const token = await login();
    const results = [];

    for (const model of TEST_CONFIG.models) {
      const result = await testStreamingResponse(token, model);
      results.push({ model, ...result });

      // Wait between tests to avoid rate limiting
      if (model !== TEST_CONFIG.models[TEST_CONFIG.models.length - 1]) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log('\n🎯 TEST SUMMARY');
    console.log('=' + '='.repeat(50));

    const passedTests = results.filter((r) => r.success).length;
    const totalTests = results.length;

    console.log(`Overall: ${passedTests}/${totalTests} tests passed\n`);

    results.forEach((result) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.model}`);
      if (result.success) {
        console.log(
          `      ${result.chunkCount} chunks, ${result.timeToFirstChunk}ms to first chunk`,
        );
      } else {
        console.log(`      Error: ${result.error || 'No chunks received'}`);
      }
    });

    if (passedTests === totalTests) {
      console.log('\n🎉 All HKGAI streaming tests passed! Real-time streaming is working.');
    } else {
      console.log('\n⚠️  Some streaming tests failed. Check the logs above for details.');
    }
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(console.error);
