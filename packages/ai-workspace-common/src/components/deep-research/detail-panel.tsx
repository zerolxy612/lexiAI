import React, { memo } from 'react';
import { useDeepResearch } from './provider';
import type { StageData, SearchResult } from './types';

// Search result item component
const SearchResultItem = memo(({ result, index }: { result: SearchResult; index: number }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{result.title}</h4>
        <span className="text-xs text-gray-500 ml-2">#{index + 1}</span>
      </div>

      <p className="text-xs text-gray-600 mb-2 line-clamp-3">{result.snippet}</p>

      <a
        href={result.link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:text-blue-800 truncate block"
      >
        {result.link}
      </a>
    </div>
  );
});

SearchResultItem.displayName = 'SearchResultItem';

// Stage detail component
const StageDetail = memo(({ stage, index }: { stage: StageData; index: number }) => {
  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
          {stage.stage + 1}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{stage.stageName}</h3>
          <p className="text-sm text-gray-500">{stage.timestamp.toLocaleString()}</p>
        </div>
      </div>

      {/* Search query */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">搜索查询</h4>
        <div className="bg-gray-100 rounded-lg p-3">
          <code className="text-sm text-gray-800">{stage.searchQuery}</code>
        </div>
      </div>

      {/* Search results */}
      {stage.searchResults?.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            搜索结果 ({stage.searchResults.length} 条)
          </h4>
          <div className="space-y-3">
            {stage.searchResults.map((result, idx) => (
              <SearchResultItem key={`${stage.stage}-${idx}`} result={result} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* AI content */}
      {stage.aiContent && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">AI 分析结果</h4>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
              {stage.aiContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
});

StageDetail.displayName = 'StageDetail';

// Main detail panel component
export const DeepResearchDetailPanel = memo(() => {
  const { state, toggleDetailPanel } = useDeepResearch();

  if (!state.showDetailPanel) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={toggleDetailPanel}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-2/3 max-w-4xl bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">三段检索详情</h2>
            <p className="text-sm text-gray-600 mt-1">查看完整的搜索过程和AI分析结果</p>
          </div>

          <button
            onClick={toggleDetailPanel}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {state.stages.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">暂无检索数据</p>
            </div>
          ) : (
            <div>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{state.stages.length}</div>
                  <div className="text-sm text-blue-700">完成阶段</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {state.stages.reduce(
                      (sum, stage) => sum + (stage.searchResults?.length || 0),
                      0,
                    )}
                  </div>
                  <div className="text-sm text-green-700">搜索结果</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {state.stages.filter((stage) => stage.aiContent).length}
                  </div>
                  <div className="text-sm text-purple-700">AI分析</div>
                </div>
              </div>

              {/* Stage details */}
              <div>
                {state.stages.map((stage, index) => (
                  <StageDetail
                    key={`detail-${stage.stage}-${stage.timestamp.getTime()}`}
                    stage={stage}
                    index={index}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              检索完成时间: {state.stages[state.stages.length - 1]?.timestamp?.toLocaleString?.()}
            </p>
            <button
              onClick={toggleDetailPanel}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
});

DeepResearchDetailPanel.displayName = 'DeepResearchDetailPanel';
