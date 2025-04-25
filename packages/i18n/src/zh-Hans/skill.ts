const translations = {
  commonQnA: {
    name: '通用问答',
    description: '基于上下文回答问题',
    placeholder: '向 AI 提问，输入 Ctrl + / 选择技能...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      answerQuestion: {
        name: '问题回答',
      },
    },
  },
  customPrompt: {
    name: '自定义提示',
    description: '基于自定义系统提示和上下文回答问题',
    placeholder: '让 AI 基于自定义系统提示回答问题...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      answerQuestion: {
        name: '问题回答',
      },
    },
  },
  codeArtifacts: {
    name: '小组件生成',
    description: '根据需求和上下文生成小组件',
    placeholder: '让 AI 帮您生成一个小组件...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      generateCodeArtifact: {
        name: '生成小组件',
      },
    },
  },
  generateDoc: {
    name: '文档写作',
    description: '根据需求和上下文进行写作',
    placeholder: '让 AI 帮您生成一篇文档...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      generateTitle: {
        name: '生成标题',
      },
      generateDocument: {
        name: '生成文档',
      },
    },
  },
  editDoc: {
    name: '编辑文档',
    placeholder: '让 AI 帮您编辑文档...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
    },
  },
  rewriteDoc: {
    name: '重写文档',
    steps: {},
  },
  webSearch: {
    name: '网络搜索',
    description: '搜索网络并获取答案',
    placeholder: '搜索网络并获取答案...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      webSearch: {
        name: '网络搜索',
      },
      answerQuestion: {
        name: '生成答案',
      },
    },
  },
  librarySearch: {
    name: '知识库搜索',
    description: '搜索知识库并获取答案',
    placeholder: '搜索知识库并获取答案...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      librarySearch: {
        name: '知识库搜索',
      },
      answerQuestion: {
        name: '生成答案',
      },
    },
  },
  recommendQuestions: {
    name: '推荐问题',
    description: '基于上下文脑暴问题',
    placeholder: '让 AI 为您生成推荐问题...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      recommendQuestions: {
        name: '生成推荐问题',
      },
    },
  },
};

export default translations;
