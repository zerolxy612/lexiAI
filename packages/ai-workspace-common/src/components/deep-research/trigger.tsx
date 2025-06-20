import { useCallback } from 'react';
import { useDeepResearch } from './provider';

interface DeepResearchTriggerProps {
  query: string;
  onTrigger?: () => void;
  disabled?: boolean;
}

// Hook for deep research trigger functionality
export const useDeepResearchTrigger = ({
  query,
  onTrigger,
  disabled = false,
}: DeepResearchTriggerProps) => {
  const { state, startMockResearch, reset } = useDeepResearch();

  const handleTrigger = useCallback(() => {
    if (disabled || !query?.trim()) return;

    // Call external trigger callback if provided
    onTrigger?.();

    // Reset any previous state and start new research
    if (state.isActive || state.isCompleted) {
      reset();

      // Small delay to ensure state is reset
      setTimeout(() => {
        startMockResearch(query.trim());
      }, 100);
    } else {
      startMockResearch(query.trim());
    }
  }, [query, disabled, onTrigger, state.isActive, state.isCompleted, startMockResearch, reset]);

  return {
    handleTrigger,
    isActive: state.isActive,
    isLoading: state.isLoading,
    isCompleted: state.isCompleted,
  };
};

// Alias for backward compatibility
export const DeepResearchTrigger = useDeepResearchTrigger;
