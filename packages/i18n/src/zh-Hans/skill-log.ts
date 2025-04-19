const translations = {
  generateTitle: {
    title: '生成标题',
    description: '成功生成标题：{{title}}, 耗时 {{duration}} 毫秒',
  },
  generateTitleFailed: {
    title: '生成标题',
    description: '由于模型能力不足，无法生成标题，使用提问作为默认标题',
  },
  rewriteQuery: {
    title: '分解问题',
    description: '子查询：{{rewrittenQueries}}, 耗时 {{duration}} 毫秒',
  },
  translateQuery: {
    title: '翻译查询',
    description: '翻译后的查询：{{translatedQueries}}, 耗时 {{duration}} 毫秒',
  },
  webSearchCompleted: {
    title: '网页搜索完成',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  librarySearchCompleted: {
    title: '知识库搜索完成',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  translateResults: {
    title: '翻译结果',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  rerankResults: {
    title: '选择关联结果',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  generateAnswer: {
    title: '生成答案',
    description: '开始生成答案...',
  },
  extractUrls: {
    title: '提取网页链接',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  crawlUrls: {
    title: '阅读网页链接',
    description: '总共 {{totalResults}} 个结果, 耗时 {{duration}} 毫秒',
  },
  analyzeQuery: {
    title: '分析需求',
    description: '分析需求完成，耗时 {{duration}} 毫秒',
  },
  generatingCodeArtifact: {
    title: '生成小组件',
    description: '小组件生成中，耗时 {{duration}} 毫秒',
  },
  codeArtifactGenerated: {
    title: '组件生成完成',
    description: '组件生成完成，耗时 {{duration}} 毫秒',
  },
};

export default translations;
