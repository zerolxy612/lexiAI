const fs = require('fs');

// Read the compiled JavaScript file
const filePath = '/app/apps/api/dist/modules/provider/provider.service.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the findProviderItemById method
const oldPattern =
  /async findProviderItemById\(user, itemId\) \{[\s\S]*?const item = await this\.prisma\.providerItem\.findUnique\(\{[\s\S]*?\}\);[\s\S]*?if \(!item\) \{[\s\S]*?return null;[\s\S]*?\}/;

const newMethod = `async findProviderItemById(user, itemId) {
        // First, try to find user-specific provider item
        let item = await this.prisma.providerItem.findUnique({
            where: { itemId, uid: user.uid, deletedAt: null },
            include: {
                provider: true,
            },
        });
        
        // If not found, fallback to global provider item (uid = null)
        if (!item) {
            item = await this.prisma.providerItem.findUnique({
                where: { itemId, uid: null, deletedAt: null },
                include: {
                    provider: true,
                },
            });
        }
        
        if (!item) {
            return null;
        }
        // Decrypt API key
        return {
            ...item,
            provider: {
                ...item.provider,
                apiKey: this.encryptionService.decrypt(item.provider.apiKey),
            },
        };
    }`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newMethod);
  fs.writeFileSync(filePath, content);
  console.log('Successfully patched findProviderItemById method');
} else {
  console.log('Pattern not found, trying alternative approach...');

  // Alternative: find the specific line and replace
  const lines = content.split('\n');
  let inMethod = false;
  let methodStart = -1;
  let methodEnd = -1;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('async findProviderItemById(user, itemId)')) {
      inMethod = true;
      methodStart = i;
      braceCount = 0;
    }

    if (inMethod) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (braceCount === 0 && i > methodStart) {
        methodEnd = i;
        break;
      }
    }
  }

  if (methodStart !== -1 && methodEnd !== -1) {
    const newLines = [
      '    async findProviderItemById(user, itemId) {',
      '        // First, try to find user-specific provider item',
      '        let item = await this.prisma.providerItem.findUnique({',
      '            where: { itemId, uid: user.uid, deletedAt: null },',
      '            include: {',
      '                provider: true,',
      '            },',
      '        });',
      '        ',
      '        // If not found, fallback to global provider item (uid = null)',
      '        if (!item) {',
      '            item = await this.prisma.providerItem.findUnique({',
      '                where: { itemId, uid: null, deletedAt: null },',
      '                include: {',
      '                    provider: true,',
      '                },',
      '            });',
      '        }',
      '        ',
      '        if (!item) {',
      '            return null;',
      '        }',
      '        // Decrypt API key',
      '        return {',
      '            ...item,',
      '            provider: {',
      '                ...item.provider,',
      '                apiKey: this.encryptionService.decrypt(item.provider.apiKey),',
      '            },',
      '        };',
      '    }',
    ];

    lines.splice(methodStart, methodEnd - methodStart + 1, ...newLines);
    content = lines.join('\n');
    fs.writeFileSync(filePath, content);
    console.log('Successfully patched using line replacement method');
  } else {
    console.log('Could not find method boundaries');
  }
}
