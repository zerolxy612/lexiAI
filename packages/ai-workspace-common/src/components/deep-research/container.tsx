import React, { memo } from 'react';
import { DeepResearchProgress } from './progress';
import { DeepResearchResults } from './results';
import { DeepResearchDetailPanel } from './detail-panel';
import { DeepResearchTestTrigger } from './test-trigger';

interface DeepResearchContainerProps {
  children?: React.ReactNode;
  showTestTrigger?: boolean;
}

// Main container component that renders all components (expects Provider to be already available)
export const DeepResearchContainer = memo(
  ({ children, showTestTrigger = false }: DeepResearchContainerProps) => {
    return (
      <div className="deep-research-container">
        {/* Test trigger for development */}
        {showTestTrigger && <DeepResearchTestTrigger />}

        {/* Progress indicator */}
        <DeepResearchProgress />

        {/* Main results display */}
        <DeepResearchResults />

        {/* Detail panel (overlay) */}
        <DeepResearchDetailPanel />

        {/* Additional children if needed */}
        {children}
      </div>
    );
  },
);

DeepResearchContainer.displayName = 'DeepResearchContainer';
