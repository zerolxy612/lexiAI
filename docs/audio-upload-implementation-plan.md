# 语音文件上传功能实施计划

## 📋 项目概述

在现有的文件/图片上传基础上，扩展支持语音文件上传功能，为后续语音转文字(ASR)和语音内容搜索奠定基础。

## 🎯 实施阶段

### Phase 1: 基础文件上传支持 (当前阶段)
- [x] 扩展支持的音频文件格式
- [x] 修改前端文件上传组件
- [x] 添加音频文件类型验证
- [x] 基础的音频文件展示
- [x] 添加专门的音频上传组件
- [x] 集成到导入资源面板
- [x] 添加国际化支持

**目标**: 用户可以上传音频文件并在资源库中查看 ✅

**完成情况**: 
- ✅ 文件扩展名支持: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.aac`
- ✅ 专门的音频上传组件 `ImportFromAudio`
- ✅ 左侧菜单新增"上传音频"选项
- ✅ 英文/中文翻译支持
- ✅ 与现有上传流程完全兼容

**已知限制**:
- 目前音频文件以 `file` 类型存储，metadata中标记为 `audio`
- 暂无音频预览播放功能 (Phase 2计划)
- 暂无语音转文字功能 (Phase 2计划)

### Phase 2: 语音转文字集成 (下个迭代)
- [ ] 选择并集成ASR服务 (推荐 OpenAI Whisper)
- [ ] 实现音频转录服务
- [ ] 添加转录状态管理
- [ ] 存储转录文本

**目标**: 自动将上传的音频转换为文本内容

### Phase 3: 搜索和索引优化 (后续迭代)
- [ ] 转录文本全文搜索索引
- [ ] 向量数据库集成
- [ ] 语义搜索支持
- [ ] 音频内容预览

**目标**: 支持基于音频内容的智能搜索

### Phase 4: 高级功能 (长期规划)
- [ ] 音频播放控件增强
- [ ] 音频剪辑功能
- [ ] 批量音频处理
- [ ] 音频质量优化
- [ ] 语音识别准确度提升

## 🔧 技术实施详情

### 支持的音频格式
```
.mp3  - MPEG Layer 3 (最常用)
.wav  - 波形音频文件
.m4a  - MPEG-4 Audio
.ogg  - Ogg Vorbis
.flac - 无损音频压缩
.aac  - Advanced Audio Coding
.wma  - Windows Media Audio (可选)
```

### 文件大小限制
- 免费用户: 50MB per file
- 付费用户: 200MB per file
- 考虑音频文件通常较大的特点

### ASR服务选型 (Phase 2)

#### 推荐方案: OpenAI Whisper API
```typescript
// 预期API调用示例
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-1",
  language: "zh", // 支持中文
  response_format: "json"
});
```

**优势**:
- 准确度高，特别是中文识别
- 支持多种语言
- 与现有OpenAI集成一致
- 合理的定价

**成本**: ~$0.006/分钟

#### 备选方案
1. **Azure Speech Services** - 企业级，支持实时转录
2. **Google Speech-to-Text** - 准确度高，价格合理
3. **本地Whisper** - 隐私友好，但需要GPU资源

### 数据库扩展 (Phase 2)

```sql
-- 扩展Resource表
ALTER TABLE resource ADD COLUMN audio_duration INTEGER; -- 音频时长(秒)
ALTER TABLE resource ADD COLUMN transcription_text TEXT; -- 转录文本
ALTER TABLE resource ADD COLUMN transcription_status VARCHAR(20) DEFAULT 'pending'; -- pending/processing/completed/failed
ALTER TABLE resource ADD COLUMN audio_format VARCHAR(10); -- 音频格式
ALTER TABLE resource ADD COLUMN sample_rate INTEGER; -- 采样率
ALTER TABLE resource ADD COLUMN file_size_bytes BIGINT; -- 文件大小

-- 新增AudioTranscription表 (可选，用于详细转录信息)
CREATE TABLE audio_transcription (
  id SERIAL PRIMARY KEY,
  resource_id VARCHAR(255) NOT NULL REFERENCES resource(resourceId),
  transcription_text TEXT NOT NULL,
  confidence_score FLOAT, -- 转录置信度
  language VARCHAR(10), -- 检测到的语言
  segments JSONB, -- 分段转录信息 (时间戳等)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API扩展

```typescript
// 新增音频相关接口
interface AudioResourceMetadata {
  duration: number; // 音频时长
  format: string; // 音频格式
  sampleRate?: number; // 采样率
  bitrate?: number; // 比特率
  transcriptionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionText?: string; // 转录文本
}

// 扩展现有资源类型
type ResourceType = 'weblink' | 'text' | 'file' | 'audio';
```

## 💰 成本估算

### ASR转录成本 (Phase 2)
- Whisper API: $0.006/分钟
- 预估月均使用: 1000分钟 = $6/月
- 可对免费用户设置限制: 10分钟/月

### 存储成本增加
- 音频文件平均大小: 5MB (5分钟)
- 月增存储: 预估1GB = ~$0.20/月

## 🚧 实施风险和注意事项

### 技术风险
1. **大文件上传**: 音频文件较大，需要考虑上传超时和断点续传
2. **格式兼容性**: 不同设备录制的音频格式差异
3. **转录准确度**: 背景噪音、口音等影响转录质量

### 业务风险
1. **隐私问题**: 语音数据敏感性高
2. **成本控制**: ASR服务按量计费，需要使用量监控
3. **用户体验**: 转录处理时间较长，需要合理的等待体验

### 解决方案
1. **分块上传**: 实现大文件分片上传
2. **格式统一**: 后端统一转换为标准格式
3. **隐私保护**: 加密存储，定期清理
4. **成本监控**: 实时监控API调用量

## 📊 成功指标

### Phase 1 指标
- 音频文件上传成功率 > 95%
- 支持格式覆盖率 > 90%
- 用户上传音频文件数量增长

### Phase 2 指标  
- 转录成功率 > 90%
- 转录准确度 > 85% (人工评估)
- 平均转录处理时间 < 2分钟

### Phase 3 指标
- 基于音频内容的搜索准确率 > 80%
- 用户搜索音频内容的使用率
- 音频资源的引用和分享频率

## 🗓️ 时间规划

- **Phase 1**: 1-2周 (基础上传功能)
- **Phase 2**: 2-3周 (ASR集成)
- **Phase 3**: 2-3周 (搜索优化)
- **Phase 4**: 持续迭代

## 📝 后续TODO

- [ ] 调研音频预处理需求 (降噪、格式转换等)
- [ ] 评估实时转录的可行性
- [ ] 考虑音频文件的版权和合规问题
- [ ] 设计音频文件的分享和协作功能
- [ ] 研究语音助手集成的可能性 