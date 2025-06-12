// 简单的数据库查询测试
// 需要先运行数据库migration确保表存在

const { PrismaClient } = require('./src/generated/client');

const prisma = new PrismaClient();

async function testProviderItems() {
  try {
    console.log('正在查询HKGAI provider items...\n');

    // 查询所有HKGAI相关的provider items
    const hkgaiItems = await prisma.providerItem.findMany({
      where: {
        providerId: 'hkgai-global',
      },
      include: {
        provider: true,
      },
    });

    console.log('找到的HKGAI provider items:');
    hkgaiItems.forEach((item, index) => {
      console.log(`${index + 1}. Item ID: ${item.itemId}`);
      console.log(`   名称: ${item.name}`);
      console.log(`   类别: ${item.category}`);
      console.log(`   启用: ${item.enabled}`);
      console.log(`   Tier: ${item.tier}`);
      console.log(`   配置: ${item.config}`);
      console.log(`   Provider: ${item.provider?.name} (${item.provider?.providerKey})`);
      console.log(
        `   API Key: ${item.provider?.apiKey ? item.provider.apiKey.substring(0, 10) + '...' : 'N/A'}`,
      );
      console.log(`   Base URL: ${item.provider?.baseUrl || 'N/A'}`);
      console.log('');
    });

    if (hkgaiItems.length === 0) {
      console.log('❌ 没有找到HKGAI provider items，请检查数据库migration是否运行');
      return;
    }

    console.log('✅ 找到 ' + hkgaiItems.length + ' 个HKGAI provider items');

    // 测试查找特定的item
    const searchEntryItem = await prisma.providerItem.findUnique({
      where: {
        itemId: 'hkgai-searchentry-item',
      },
      include: {
        provider: true,
      },
    });

    if (searchEntryItem) {
      console.log('\n✅ 找到 hkgai-searchentry-item:');
      console.log('   配置:', JSON.parse(searchEntryItem.config));
    } else {
      console.log('\n❌ 没有找到 hkgai-searchentry-item');
    }

    // 查询用户的默认模型配置
    console.log('\n--- 查询用户默认模型配置 ---');
    const users = await prisma.user.findMany({
      select: {
        uid: true,
        name: true,
        preferences: true,
      },
      take: 3,
    });

    users.forEach((user) => {
      console.log(`用户: ${user.name} (${user.uid})`);
      if (user.preferences) {
        try {
          const prefs = JSON.parse(user.preferences);
          console.log('  默认模型配置:', JSON.stringify(prefs.defaultModel, null, 2));
        } catch (e) {
          console.log('  偏好设置解析错误:', e.message);
        }
      } else {
        console.log('  没有偏好设置');
      }
      console.log('');
    });
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testProviderItems();
