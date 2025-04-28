const translations = {
  commonQnA: {
    name: 'Question Answering',
    description: 'Answer questions based on the context',
    placeholder: 'Ask AI a question, press Ctrl + / to select skill...',
    placeholderMac: 'Ask AI a question, press Cmd + / to select skill...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      answerQuestion: {
        name: 'Question Answering',
      },
    },
  },
  customPrompt: {
    name: 'Custom Prompt',
    description: 'Answer questions based on the custom system prompt and context',
    placeholder: 'Let AI help you answer questions with a custom system prompt...',
    placeholderMac: 'Let AI help you answer questions with a custom system prompt...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      answerQuestion: {
        name: 'Question Answering',
      },
    },
  },
  codeArtifacts: {
    name: 'Code Artifacts',
    description: 'Generate React/TypeScript components based on the question and context',
    placeholder: 'Let AI help you generate a React/TypeScript component...',
    placeholderMac: 'Let AI help you generate a React/TypeScript component...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      generateCodeArtifact: {
        name: 'Generate Code Artifact',
      },
    },
  },
  generateDoc: {
    name: 'Document Writing',
    description: 'Generate documents based on the question and context',
    placeholder: 'Let AI help you generate a document...',
    placeholderMac: 'Let AI help you generate a document...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      generateTitle: {
        name: 'Generate Title',
      },
      generateDocument: {
        name: 'Generate Document',
      },
    },
  },
  editDoc: {
    name: 'Edit Document',
    placeholder: 'Let AI help you edit the document...',
    placeholderMac: 'Let AI help you edit the document...',
    steps: {},
  },
  rewriteDoc: {
    name: 'Rewrite Document',
    steps: {},
  },
  webSearch: {
    name: 'Web Search',
    description: 'Search the web and get answers',
    placeholder: 'Search the web and get answers...',
    placeholderMac: 'Search the web and get answers...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      webSearch: {
        name: 'Web Search',
      },
      answerQuestion: {
        name: 'Answer Generation',
      },
    },
  },
  librarySearch: {
    name: 'Library Search',
    description: 'Search the library and get answers',
    placeholder: 'Search the library and get answers...',
    placeholderMac: 'Search the library and get answers...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      librarySearch: {
        name: 'Library Search',
      },
      answerQuestion: {
        name: 'Answer Generation',
      },
    },
  },
  recommendQuestions: {
    name: 'Recommend Questions',
    description: 'Brainstorm questions based on the context',
    placeholder: 'Let AI recommend questions for you...',
    placeholderMac: 'Let AI recommend questions for you...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      recommendQuestions: {
        name: 'Generate Recommended Questions',
      },
    },
  },
};

export default translations;
