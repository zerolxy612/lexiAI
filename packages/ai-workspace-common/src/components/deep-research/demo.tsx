import React, { useState } from 'react';
import { DeepResearchContainer, useDeepResearchTrigger } from './index';

// Demo component for testing Deep Research functionality
export const DeepResearchDemo = () => {
  const [query, setQuery] = useState('AI人工智能发展现状');

  return (
    <DeepResearchContainer>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">三段检索功能演示</h1>
          <p className="text-gray-600 mb-4">
            这是三段检索功能的演示界面。点击下方按钮开始体验完整的三段检索流程。
          </p>

          {/* Query input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">搜索查询</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入你想要深度分析的问题..."
            />
          </div>

          {/* Trigger button */}
          <TriggerButton query={query} />
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-800 mb-2">使用说明：</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. 输入你想要深度分析的问题</li>
            <li>2. 点击"开始三段检索"按钮</li>
            <li>3. 观察三个阶段的分析过程：基础分析 → 拓展分析 → 深度剖析</li>
            <li>4. 分析完成后，点击右下角"查看详情"按钮</li>
            <li>5. 在右侧面板中查看完整的搜索结果和AI分析</li>
          </ul>
        </div>
      </div>
    </DeepResearchContainer>
  );
};

// Trigger button component that uses the hook
const TriggerButton = ({ query }: { query: string }) => {
  const { handleTrigger, isActive, isLoading, isCompleted } = useDeepResearchTrigger({
    query,
    onTrigger: () => {
      console.log('Deep research triggered for:', query);
    },
  });

  const getButtonText = () => {
    if (isLoading) return '检索中...';
    if (isCompleted) return '重新开始';
    if (isActive) return '进行中';
    return '开始三段检索';
  };

  const getButtonStyle = () => {
    if (isLoading) return 'bg-yellow-500 hover:bg-yellow-600';
    if (isCompleted) return 'bg-green-500 hover:bg-green-600';
    if (isActive) return 'bg-blue-500 hover:bg-blue-600';
    return 'bg-blue-500 hover:bg-blue-600';
  };

  return (
    <button
      onClick={handleTrigger}
      disabled={!query.trim() || isLoading}
      className={`
        ${getButtonStyle()} 
        disabled:bg-gray-300 disabled:cursor-not-allowed
        text-white px-6 py-3 rounded-lg font-medium transition-all duration-200
        flex items-center gap-2 min-w-40 justify-center
      `}
    >
      {isLoading && (
        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
      )}
      {getButtonText()}
    </button>
  );
};
