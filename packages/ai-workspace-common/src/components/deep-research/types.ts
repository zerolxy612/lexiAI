// Three-stage deep research types
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface StageData {
  stage: number;
  stageName: string;
  searchQuery: string;
  searchResults: SearchResult[];
  aiContent: string;
  timestamp: Date;
}

export interface DeepResearchProgress {
  currentStage: number;
  totalStages: number;
  percentage: number;
}

export interface DeepResearchEvent {
  type: 'stage_start' | 'search_complete' | 'ai_response' | 'stage_complete' | 'complete' | 'error';
  progress?: DeepResearchProgress;
  stageData?: StageData;
  content?: string;
  error?: string;
}

export interface DeepResearchState {
  isActive: boolean;
  isLoading: boolean;
  currentStage: number;
  stages: StageData[];
  isCompleted: boolean;
  showDetailPanel: boolean;
  error?: string;
}

export interface DeepResearchRequest {
  query: string;
  search?: boolean;
  messages?: Array<{ role: string; content: string }>;
}

// Mock data for development
export const MOCK_STAGE_DATA: StageData[] = [
  {
    stage: 0,
    stageName: '基础分析',
    searchQuery: 'AI人工智能发展现状',
    searchResults: [
      {
        title: 'AI技术发展趋势报告2024',
        link: 'https://example.com/ai-trends-2024',
        snippet:
          '人工智能技术在2024年呈现出快速发展态势，特别在大语言模型、计算机视觉等领域取得重要突破...',
      },
      {
        title: '全球AI产业发展现状分析',
        link: 'https://example.com/global-ai-industry',
        snippet: '据统计，全球AI市场规模预计将在2024年突破5000亿美元，年增长率达到35%以上...',
      },
    ],
    aiContent:
      '<think>用户询问AI人工智能发展现状，我需要基于搜索结果提供一个综合分析。从搜索结果来看，AI在2024年确实在快速发展，特别是大语言模型领域。</think>\n\n# AI人工智能发展现状分析\n\n## 技术发展趋势\n基于最新的行业报告，AI技术在2024年呈现出以下特点：\n- 大语言模型技术突破性进展\n- 计算机视觉应用更加广泛\n- 多模态AI能力显著提升\n\n## 市场规模\n全球AI市场规模预计突破5000亿美元，年增长率超过35%，显示出强劲的发展势头。',
    timestamp: new Date(),
  },
  {
    stage: 1,
    stageName: '拓展分析',
    searchQuery: 'AI人工智能发展现状，拓展',
    searchResults: [
      {
        title: 'AI在各行业的应用深度分析',
        link: 'https://example.com/ai-applications',
        snippet:
          'AI技术已广泛应用于医疗、教育、金融、制造业等多个领域，其中医疗AI诊断准确率已达到95%以上...',
      },
      {
        title: 'AI伦理与法规发展现状',
        link: 'https://example.com/ai-ethics',
        snippet:
          '随着AI技术快速发展，各国纷纷制定相关法规，欧盟AI法案、中国AI治理框架等相继出台...',
      },
    ],
    aiContent:
      '<think>在拓展分析阶段，我需要从更广的角度来分析AI发展现状，包括应用领域和监管环境。</think>\n\n# AI发展现状 - 拓展视角\n\n## 行业应用现状\n- **医疗领域**: AI诊断准确率达95%以上\n- **教育领域**: 个性化学习系统普及\n- **金融领域**: 智能风控、算法交易\n- **制造业**: 工业4.0智能制造\n\n## 监管环境\n- 欧盟AI法案率先出台\n- 中国发布AI治理框架\n- 全球AI伦理标准逐步建立',
    timestamp: new Date(),
  },
  {
    stage: 2,
    stageName: '深度剖析',
    searchQuery: 'AI人工智能发展现状，深度剖析',
    searchResults: [
      {
        title: 'AI技术发展面临的挑战与机遇',
        link: 'https://example.com/ai-challenges',
        snippet:
          'AI发展面临数据安全、算法偏见、就业冲击等挑战，同时在科研、创新等方面带来巨大机遇...',
      },
      {
        title: '未来AI发展路径预测',
        link: 'https://example.com/ai-future',
        snippet:
          '专家预测，通用人工智能(AGI)有望在2030年前实现重大突破，量子计算将为AI提供新的计算能力...',
      },
    ],
    aiContent:
      '<think>深度剖析阶段需要从更深层次分析AI发展，包括技术挑战、社会影响、未来趋势等多个维度。</think>\n\n# AI发展现状 - 深度剖析\n\n## 核心挑战\n1. **技术挑战**\n   - 算法可解释性不足\n   - 数据隐私与安全\n   - 计算资源需求巨大\n\n2. **社会挑战**\n   - 就业结构变化\n   - 算法偏见问题\n   - 技术鸿沟扩大\n\n## 发展机遇\n- 科研效率大幅提升\n- 新兴产业快速发展\n- 社会治理智能化\n\n## 未来展望\n- AGI突破预期在2030年前\n- 量子计算赋能AI\n- 人机协作新模式',
    timestamp: new Date(),
  },
];
