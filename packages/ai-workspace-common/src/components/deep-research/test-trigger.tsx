import React, { memo, useCallback } from 'react';
import { Button } from 'antd';
import { useDeepResearch } from './provider';

// Simple test trigger component to verify deep research functionality
export const DeepResearchTestTrigger = memo(() => {
  const { state, startMockResearch, reset } = useDeepResearch();

  const handleStartTest = useCallback(() => {
    startMockResearch('测试：人工智能的发展历程');
  }, [startMockResearch]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">🧪 深度检索测试</h3>
      <div className="flex gap-2">
        <Button
          type="primary"
          size="small"
          onClick={handleStartTest}
          disabled={state.isLoading}
          loading={state.isLoading}
        >
          {state.isLoading ? '检索中...' : '开始测试'}
        </Button>
        <Button size="small" onClick={handleReset} disabled={state.isLoading}>
          重置
        </Button>
        <div className="text-xs text-gray-600 flex items-center">
          状态: {state.isActive ? '活跃' : '未激活'} | 阶段: {state.currentStage}/3 |
          {state.isCompleted ? '已完成' : '进行中'}
        </div>
      </div>
    </div>
  );
});

DeepResearchTestTrigger.displayName = 'DeepResearchTestTrigger';
