import React, { memo } from 'react';
import { useDeepResearch } from './provider';

// Progress step component
const ProgressStep = memo(
  ({
    stage,
    name,
    isActive,
    isCompleted,
    isLast,
  }: {
    stage: number;
    name: string;
    isActive: boolean;
    isCompleted: boolean;
    isLast?: boolean;
  }) => {
    return (
      <div className="flex items-center">
        <div className="flex flex-col items-center">
          {/* Step indicator */}
          <div
            className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300
            ${
              isCompleted
                ? 'bg-green-500 text-white'
                : isActive
                  ? 'bg-blue-500 text-white animate-pulse'
                  : 'bg-gray-200 text-gray-500'
            }
          `}
          >
            {isCompleted ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              stage + 1
            )}
          </div>

          {/* Step name */}
          <div
            className={`
          mt-2 text-xs text-center max-w-20 leading-tight
          ${isActive ? 'text-blue-600 font-medium' : 'text-gray-500'}
        `}
          >
            {name}
          </div>
        </div>

        {/* Connector line */}
        {!isLast && (
          <div
            className={`
          flex-1 h-0.5 mx-4 transition-all duration-300
          ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
        `}
          />
        )}
      </div>
    );
  },
);

ProgressStep.displayName = 'ProgressStep';

// Main progress component
export const DeepResearchProgress = memo(() => {
  const { state } = useDeepResearch();

  const stages = [
    { name: '基础分析', stage: 0 },
    { name: '拓展分析', stage: 1 },
    { name: '深度剖析', stage: 2 },
  ];

  if (!state.isActive && !state.isCompleted) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">三段检索进度</h3>
        <div className="text-xs text-gray-500">
          {state.isCompleted ? '已完成' : `${state.currentStage}/3 阶段`}
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => (
          <ProgressStep
            key={stage.stage}
            stage={stage.stage}
            name={stage.name}
            isActive={state.currentStage === stage.stage && state.isLoading}
            isCompleted={state.currentStage > stage.stage}
            isLast={index === stages.length - 1}
          />
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>整体进度</span>
          <span>{Math.round((state.currentStage / 3) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(state.currentStage / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Current stage info */}
      {state.isLoading && state.currentStage < 3 && (
        <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
          <div className="flex items-center">
            <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full mr-2" />
            正在进行 {stages[state.currentStage]?.name}...
          </div>
        </div>
      )}

      {/* Error state */}
      {state.error && (
        <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
          <div className="flex items-center">
            <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            错误: {state.error}
          </div>
        </div>
      )}
    </div>
  );
});

DeepResearchProgress.displayName = 'DeepResearchProgress';
