# 语音转文字 MVP 实施方案

## 🎯 MVP 目标
在现有音频上传功能基础上，快速添加手动转录功能，让用户可以在音频节点中看到转录文本。

## 🚀 快速实施步骤 (3-5天)

### Day 1: 后端API集成
```typescript
// apps/api/src/modules/transcription/transcription.service.ts
import OpenAI from 'openai';

@Injectable()
export class TranscriptionService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: configService.get('OPENAI_API_KEY'),
    });
  }

  async transcribeAudio(audioFile: Buffer, filename: string): Promise<string> {
    try {
      const file = new File([audioFile], filename);
      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'zh', // 中文优先，也可以设为自动检测
        response_format: 'text'
      });
      
      return transcription;
    } catch (error) {
      throw new Error(`转录失败: ${error.message}`);
    }
  }
}
```

### Day 2: 添加转录接口
```typescript
// apps/api/src/modules/knowledge/knowledge.controller.ts
@Post('resource/:resourceId/transcribe')
@UseGuards(JwtAuthGuard)
async transcribeAudio(
  @Param('resourceId') resourceId: string,
  @LoginedUser() user: User,
): Promise<{ success: boolean; transcription?: string }> {
  try {
    // 获取音频资源
    const resource = await this.knowledgeService.getResource(user, resourceId);
    if (!resource?.rawFileKey) {
      throw new Error('音频文件不存在');
    }

    // 获取音频文件
    const audioBuffer = await this.ossService.getObject(resource.rawFileKey);
    
    // 执行转录
    const transcription = await this.transcriptionService.transcribeAudio(
      audioBuffer, 
      resource.title
    );

    // 保存转录结果
    await this.knowledgeService.updateResourceTranscription(resourceId, transcription);

    return { success: true, transcription };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Day 3: 前端音频节点增强
```typescript
// packages/ai-workspace-common/src/components/canvas/nodes/audio.tsx
import { useState } from 'react';
import { Button, message, Spin } from 'antd';
import { AudioPlayer } from '../../common/audio-player';

export const AudioNode = ({ data, entityId }: AudioNodeProps) => {
  const [transcription, setTranscription] = useState(data.transcription || '');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const response = await getClient().transcribeAudio({ resourceId: entityId });
      if (response.data?.success) {
        setTranscription(response.data.transcription);
        message.success('转录完成！');
      } else {
        message.error('转录失败：' + response.data?.error);
      }
    } catch (error) {
      message.error('转录出错：' + error.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 min-w-[300px]">
      {/* 音频标题 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎵</span>
        <span className="font-medium">{data.title}</span>
      </div>

      {/* 音频播放器 */}
      <AudioPlayer src={data.audioUrl} />

      {/* 转录部分 */}
      <div className="mt-4 border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">转录文本</span>
          {!transcription && (
            <Button 
              size="small" 
              type="primary"
              loading={isTranscribing}
              onClick={handleTranscribe}
            >
              {isTranscribing ? '转录中...' : '开始转录'}
            </Button>
          )}
        </div>

        {transcription && (
          <div className="space-y-2">
            <div className="text-sm text-gray-700">
              {showFullText ? (
                <div className="whitespace-pre-wrap">{transcription}</div>
              ) : (
                <div>
                  {transcription.slice(0, 100)}
                  {transcription.length > 100 && '...'}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              {transcription.length > 100 && (
                <Button 
                  size="small" 
                  type="text"
                  onClick={() => setShowFullText(!showFullText)}
                >
                  {showFullText ? '收起' : '展开'}
                </Button>
              )}
              <Button 
                size="small" 
                type="text"
                onClick={() => navigator.clipboard.writeText(transcription)}
              >
                复制
              </Button>
              <Button 
                size="small" 
                type="text"
                onClick={handleTranscribe}
                loading={isTranscribing}
              >
                重新转录
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

### Day 4-5: 数据库和优化
```sql
-- 快速扩展现有resource表
ALTER TABLE resource ADD COLUMN transcription_text TEXT DEFAULT NULL;
ALTER TABLE resource ADD COLUMN transcription_status VARCHAR(20) DEFAULT NULL;
```

```typescript
// 更新resource服务
async updateResourceTranscription(resourceId: string, transcription: string) {
  return await this.prisma.resource.update({
    where: { resourceId },
    data: {
      transcription_text: transcription,
      transcription_status: 'completed'
    }
  });
}
```

## 🎛️ 用户操作流程

1. **上传音频** → 音频节点出现在画布
2. **点击"开始转录"** → 显示转录进度
3. **转录完成** → 文本显示在节点下方
4. **查看/编辑/复制** → 用户可以操作转录文本

## 💡 进阶功能规划

### 短期优化 (1-2周后)
- 自动转录选项（上传时可选）
- 转录质量评分和置信度
- 支持多语言检测

### 中期增强 (1个月后)  
- 时间戳同步播放
- 转录文本编辑和保存
- 全文搜索集成

### 长期规划 (3个月后)
- 实时转录（流式处理）
- 说话人识别
- 情感分析

## 💰 成本控制建议

### 免费用户限制
- 每月10分钟转录时长
- 最大文件15MB
- 仅支持常见格式

### 付费用户增强
- 每月300分钟
- 最大文件100MB  
- 支持所有音频格式
- 自动转录选项

## 🔧 技术细节

### 环境变量配置
```env
OPENAI_API_KEY=your_openai_api_key
TRANSCRIPTION_ENABLED=true
MAX_TRANSCRIPTION_MINUTES_FREE=10
MAX_TRANSCRIPTION_MINUTES_PRO=300
```

### 错误处理
```typescript
// 常见错误处理
const TRANSCRIPTION_ERRORS = {
  FILE_TOO_LARGE: '音频文件过大，请选择较小的文件',
  UNSUPPORTED_FORMAT: '不支持的音频格式',
  QUOTA_EXCEEDED: '本月转录额度已用完',
  API_ERROR: '转录服务暂时不可用，请稍后重试'
};
```

这个MVP方案可以在一周内实现，为用户提供基础的语音转文字功能，然后根据用户反馈逐步迭代优化。 