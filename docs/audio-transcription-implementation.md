# 语音转文字功能实施方案

## 📋 方案概述

在音频上传后自动进行语音转文字，在画布节点中展示转录内容，支持文本搜索和AI问答。

## 🔧 技术方案对比

### 方案1: OpenAI Whisper API (推荐)
```typescript
// 后端API调用示例
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-1",
  language: "zh", // 自动检测或指定语言
  response_format: "verbose_json", // 包含时间戳信息
  timestamp_granularities: ["word"] // 词级别时间戳
});
```

**优势**：
- ✅ 准确度高 (90%+)
- ✅ 中英文支持优秀
- ✅ 与现有OpenAI集成一致
- ✅ 支持时间戳输出
- ✅ API简单稳定

**成本**: $0.006/分钟

### 方案2: Azure Speech Services
```typescript
// Azure配置示例
const speechConfig = SpeechConfig.fromSubscription(key, region);
speechConfig.speechRecognitionLanguage = "zh-CN";
const recognizer = SpeechRecognizer.FromConfig(speechConfig);
```

**优势**：
- ✅ 企业级可靠性
- ✅ 支持实时转录
- ✅ 详细的置信度分数

**劣势**：
- ❌ 集成复杂度较高
- ❌ 成本相对较高

### 方案3: 本地Whisper模型
```python
# 本地部署示例
import whisper
model = whisper.load_model("large-v3")
result = model.transcribe("audio.mp3", language="zh")
```

**优势**：
- ✅ 数据隐私最佳
- ✅ 长期成本低

**劣势**：
- ❌ 需要GPU资源
- ❌ 部署运维复杂

## 🏗️ 系统架构设计

### 整体流程
```
用户上传音频 → 文件存储 → 后台转录任务 → 存储转录结果 → 前端实时更新
```

### 后端实现

#### 1. 添加转录服务
```typescript
// apps/api/src/modules/transcription/transcription.service.ts
@Injectable()
export class TranscriptionService {
  async transcribeAudio(resourceId: string, audioFile: Buffer): Promise<TranscriptionResult> {
    try {
      // 调用Whisper API
      const transcription = await this.openai.audio.transcriptions.create({
        file: new File([audioFile], 'audio.mp3'),
        model: 'whisper-1',
        language: 'zh',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });

      // 保存转录结果
      return await this.saveTranscription(resourceId, transcription);
    } catch (error) {
      // 错误处理和重试机制
      throw new TranscriptionError(`转录失败: ${error.message}`);
    }
  }
}
```

#### 2. 扩展资源模型
```sql
-- 扩展resource表
ALTER TABLE resource ADD COLUMN transcription_text TEXT;
ALTER TABLE resource ADD COLUMN transcription_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE resource ADD COLUMN audio_duration INTEGER;
ALTER TABLE resource ADD COLUMN transcription_confidence FLOAT;

-- 新增转录详情表
CREATE TABLE audio_transcription (
  id SERIAL PRIMARY KEY,
  resource_id VARCHAR(255) NOT NULL,
  transcription_text TEXT NOT NULL,
  segments JSONB, -- 分段信息和时间戳
  language VARCHAR(10),
  confidence_score FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. 异步处理队列
```typescript
// 转录任务队列
@Processor('transcription')
export class TranscriptionProcessor {
  @Process('transcribe-audio')
  async handleTranscription(job: Job<TranscriptionJobData>) {
    const { resourceId, storageKey } = job.data;
    
    // 获取音频文件
    const audioBuffer = await this.oss.getObject(storageKey);
    
    // 执行转录
    const result = await this.transcriptionService.transcribeAudio(resourceId, audioBuffer);
    
    // 更新资源状态
    await this.updateResourceTranscription(resourceId, result);
    
    // 通知前端更新
    this.eventEmitter.emit('transcription.completed', { resourceId, result });
  }
}
```

### 前端实现

#### 1. 音频节点组件增强
```typescript
// packages/ai-workspace-common/src/components/canvas/nodes/audio.tsx
export const AudioNode = ({ data }: AudioNodeProps) => {
  const [transcriptionStatus, setTranscriptionStatus] = useState('pending');
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="audio-node">
      {/* 音频播放控件 */}
      <AudioPlayer src={data.audioUrl} />
      
      {/* 转录状态和结果 */}
      <div className="transcription-section">
        {transcriptionStatus === 'pending' && (
          <div className="flex items-center gap-2">
            <Spin size="small" />
            <span>正在转录中...</span>
          </div>
        )}
        
        {transcriptionStatus === 'completed' && (
          <div className="transcription-content">
            <div 
              className="transcription-preview cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span className="text-sm text-gray-600">转录文本：</span>
              <span className="ml-2">{transcriptionText.slice(0, 50)}...</span>
            </div>
            
            {isExpanded && (
              <div className="transcription-full mt-2 p-3 bg-gray-50 rounded">
                <p className="text-sm whitespace-pre-wrap">{transcriptionText}</p>
                {/* 编辑和复制功能 */}
                <div className="mt-2 flex gap-2">
                  <Button size="small" onClick={handleCopyText}>复制</Button>
                  <Button size="small" onClick={handleEditText}>编辑</Button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {transcriptionStatus === 'failed' && (
          <div className="flex items-center gap-2">
            <span className="text-red-500">转录失败</span>
            <Button size="small" onClick={handleRetryTranscription}>重试</Button>
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 2. 实时状态更新
```typescript
// WebSocket或Server-Sent Events监听转录状态
useEffect(() => {
  const eventSource = new EventSource(`/api/v1/transcription/status/${resourceId}`);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setTranscriptionStatus(data.status);
    if (data.status === 'completed') {
      setTranscriptionText(data.transcriptionText);
    }
  };

  return () => eventSource.close();
}, [resourceId]);
```

## 🎨 UI/UX 设计

### 音频节点布局
```
┌─────────────────────────────────┐
│ 🎵 音频文件名.mp3               │
├─────────────────────────────────┤
│ ▶️ ━━━━━━━━━━ 03:45 🔊        │ ← 播放控件
├─────────────────────────────────┤
│ 📝 转录文本：这是一段关于...      │ ← 可点击展开
│    [展开] [复制] [编辑]          │
└─────────────────────────────────┘
```

### 转录状态指示
- 🔄 转录中 - 显示进度动画
- ✅ 转录完成 - 显示文本预览
- ❌ 转录失败 - 显示重试按钮
- ✏️ 手动编辑 - 允许用户修正文本

## 💰 成本控制策略

### 1. 分层收费
```typescript
const TRANSCRIPTION_LIMITS = {
  free: { minutesPerMonth: 10, maxFileSize: '25MB' },
  pro: { minutesPerMonth: 300, maxFileSize: '100MB' },
  enterprise: { minutesPerMonth: -1, maxFileSize: '500MB' }
};
```

### 2. 智能优化
- 音频预处理（降噪、格式转换）
- 分段转录（减少重复成本）
- 缓存机制（避免重复转录）

### 3. 用户控制
- 手动触发转录选项
- 转录前预估成本提示
- 批量处理优化

## 🔍 搜索集成

### 全文搜索增强
```typescript
// 将转录文本加入搜索索引
await this.fts.upsertDocument(user, 'resource', {
  id: resource.resourceId,
  content: transcriptionText, // 转录文本作为可搜索内容
  metadata: {
    resourceType: 'audio',
    duration: audioDuration,
    language: detectedLanguage
  }
});
```

### 向量搜索支持
```typescript
// 为转录文本生成embedding
const embedding = await this.embeddingService.createEmbedding(transcriptionText);
await this.vectorStore.upsert({
  id: resourceId,
  values: embedding,
  metadata: { type: 'audio-transcription', text: transcriptionText }
});
```

## 📊 监控和分析

### 转录质量监控
- 转录成功率统计
- 平均转录时间
- 用户满意度反馈
- 错误类型分析

### 成本分析
- 每月转录分钟数
- 平均每用户成本
- 转录准确度vs成本对比

## 🚀 实施计划

### Phase 2A: 基础转录 (2周)
- [x] 基础音频上传 (已完成)
- [ ] 集成Whisper API
- [ ] 后端转录服务
- [ ] 基础前端展示

### Phase 2B: 增强功能 (1周)
- [ ] 实时状态更新
- [ ] 转录文本编辑
- [ ] 搜索索引集成

### Phase 2C: 优化和监控 (1周)
- [ ] 成本控制机制
- [ ] 性能优化
- [ ] 监控面板

## 🔒 安全和隐私

### 数据保护
- 音频文件加密存储
- 转录文本访问控制
- 定期数据清理机制

### 合规考虑
- 用户授权确认
- 数据处理透明度
- 符合GDPR等法规要求 