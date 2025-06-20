import React, { memo, useMemo } from 'react';
import { useDeepResearch } from './provider';

// Markdown content renderer (simplified)
const MarkdownContent = memo(({ content }: { content: string }) => {
  // Simple processing to handle <think> tags and basic markdown
  const processedContent = useMemo(() => {
    // Remove <think></think> tags for display (they're for AI reasoning)
    let processed = content.replace(/<think>[\s\S]*?<\/think>/g, '');

    // Convert basic markdown to HTML-like structure
    processed = processed
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br/><br/>');

    return processed;
  }, [content]);

  return (
    <div
      className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
});

MarkdownContent.displayName = 'MarkdownContent';

// Detail button component (shown in bottom right when completed)
const DetailButton = memo(() => {
  const { state, toggleDetailPanel } = useDeepResearch();

  if (!state.isCompleted || state.stages.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={toggleDetailPanel}
        className="
          bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg
          flex items-center gap-2 transition-all duration-200 hover:scale-105
          text-sm font-medium
        "
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        查看详情
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-1" />
      </button>
    </div>
  );
});

DetailButton.displayName = 'DetailButton';

// Stage result component
const StageResult = memo(({ stage, isLatest }: { stage: any; isLatest: boolean }) => {
  return (
    <div
      className={`
      mb-6 p-4 rounded-lg border transition-all duration-300
      ${isLatest ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}
    `}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className={`
          text-sm font-medium
          ${isLatest ? 'text-blue-700' : 'text-gray-700'}
        `}
        >
          {stage.stageName}
        </h3>
        <div className="text-xs text-gray-500">{stage.timestamp?.toLocaleTimeString?.() || ''}</div>
      </div>

      {/* Search query */}
      {stage.searchQuery && (
        <div className="mb-3 p-2 bg-gray-100 rounded text-xs">
          <span className="text-gray-600">搜索查询:</span>
          <span className="ml-2 text-gray-800">{stage.searchQuery}</span>
        </div>
      )}

      {/* Search results count */}
      {stage.searchResults?.length > 0 && (
        <div className="mb-3 text-xs text-gray-600">
          找到 {stage.searchResults.length} 条相关结果
        </div>
      )}

      {/* AI content */}
      {stage.aiContent && (
        <div className="mt-3">
          <MarkdownContent content={stage.aiContent} />
        </div>
      )}
    </div>
  );
});

StageResult.displayName = 'StageResult';

// Main results component
export const DeepResearchResults = memo(() => {
  const { state } = useDeepResearch();

  if (!state.isActive || state.stages.length === 0) {
    return null;
  }

  // Get completed stages with content
  const completedStages = state.stages.filter((stage) => stage.aiContent);

  return (
    <>
      <div className="space-y-4">
        {completedStages.map((stage, index) => (
          <StageResult
            key={`${stage.stage}-${stage.timestamp?.getTime?.() || index}`}
            stage={stage}
            isLatest={index === completedStages.length - 1}
          />
        ))}

        {/* Loading indicator for current stage */}
        {state.isLoading && (
          <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
            <div className="flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
              <span className="text-sm text-gray-600">
                正在处理第 {state.currentStage + 1} 阶段...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Detail button */}
      <DetailButton />
    </>
  );
});

DeepResearchResults.displayName = 'DeepResearchResults';
