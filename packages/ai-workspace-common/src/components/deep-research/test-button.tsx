import React from 'react';
import { Button } from 'antd';
import { useDeepResearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/deep-research';

interface TestButtonProps {
  resultId?: string;
}

export const TestButton: React.FC<TestButtonProps> = ({ resultId = 'test-result' }) => {
  const { setDeepAnalysisSelected, isDeepAnalysisSelected, clearDeepAnalysisSelection } =
    useDeepResearchStoreShallow((state) => ({
      setDeepAnalysisSelected: state.setDeepAnalysisSelected,
      isDeepAnalysisSelected: state.isDeepAnalysisSelected,
      clearDeepAnalysisSelection: state.clearDeepAnalysisSelection,
    }));

  const isSelected = isDeepAnalysisSelected(resultId);

  const handleToggle = () => {
    if (isSelected) {
      clearDeepAnalysisSelection(resultId);
    } else {
      setDeepAnalysisSelected(resultId, true);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-2">Deep Research Test</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        Current status: {isSelected ? 'Selected' : 'Not selected'}
      </p>
      <Button
        type={isSelected ? 'default' : 'primary'}
        onClick={handleToggle}
        className={isSelected ? 'bg-red-500 hover:bg-red-600 text-white border-red-500' : ''}
      >
        {isSelected ? 'Clear Selection' : 'Select Deep Analysis'}
      </Button>
    </div>
  );
};
