import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import {
  DeepResearchState,
  DeepResearchEvent,
  DeepResearchRequest,
  StageData,
  MOCK_STAGE_DATA,
} from './types';

// Action types for reducer
type DeepResearchAction =
  | { type: 'START_RESEARCH'; query: string }
  | { type: 'UPDATE_STAGE'; event: DeepResearchEvent }
  | { type: 'COMPLETE_RESEARCH' }
  | { type: 'TOGGLE_DETAIL_PANEL' }
  | { type: 'RESET' }
  | { type: 'SET_ERROR'; error: string };

// Initial state
const initialState: DeepResearchState = {
  isActive: false,
  isLoading: false,
  currentStage: 0,
  stages: [],
  isCompleted: false,
  showDetailPanel: false,
  error: undefined,
};

// Context type
interface DeepResearchContextType {
  state: DeepResearchState;
  startResearch: (query: string) => void;
  toggleDetailPanel: () => void;
  reset: () => void;
  // Mock function for development
  startMockResearch: (query: string) => void;
}

// Context
const DeepResearchContext = createContext<DeepResearchContextType | undefined>(undefined);

// Reducer
function deepResearchReducer(
  state: DeepResearchState,
  action: DeepResearchAction,
): DeepResearchState {
  switch (action.type) {
    case 'START_RESEARCH':
      return {
        ...state,
        isActive: true,
        isLoading: true,
        currentStage: 0,
        stages: [],
        isCompleted: false,
        error: undefined,
      };

    case 'UPDATE_STAGE':
      const { event } = action;
      let newStages = [...state.stages];

      if (event.stageData) {
        const existingIndex = newStages.findIndex((s) => s.stage === event.stageData!.stage);
        if (existingIndex >= 0) {
          newStages[existingIndex] = event.stageData;
        } else {
          newStages.push(event.stageData);
        }
      }

      return {
        ...state,
        currentStage: event.progress?.currentStage ?? state.currentStage,
        stages: newStages,
        isLoading: event.type !== 'complete' && event.type !== 'error',
        isCompleted: event.type === 'complete',
        error: event.error,
      };

    case 'COMPLETE_RESEARCH':
      return {
        ...state,
        isLoading: false,
        isCompleted: true,
      };

    case 'TOGGLE_DETAIL_PANEL':
      return {
        ...state,
        showDetailPanel: !state.showDetailPanel,
      };

    case 'RESET':
      return initialState;

    case 'SET_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.error,
      };

    default:
      return state;
  }
}

// Provider component
interface DeepResearchProviderProps {
  children: ReactNode;
}

export function DeepResearchProvider({ children }: DeepResearchProviderProps) {
  const [state, dispatch] = useReducer(deepResearchReducer, initialState);

  const startResearch = useCallback((query: string) => {
    dispatch({ type: 'START_RESEARCH', query });

    // TODO: Implement actual API call
    // For now, we'll use mock data
    console.log('Starting deep research for:', query);
  }, []);

  // Mock function for development and testing
  const startMockResearch = useCallback((query: string) => {
    dispatch({ type: 'START_RESEARCH', query });

    // Simulate the three-stage process with mock data
    let currentStage = 0;

    const processStage = (stageIndex: number) => {
      if (stageIndex >= MOCK_STAGE_DATA.length) {
        dispatch({ type: 'COMPLETE_RESEARCH' });
        return;
      }

      const stageData = {
        ...MOCK_STAGE_DATA[stageIndex],
        timestamp: new Date(),
      };

      // Stage start
      dispatch({
        type: 'UPDATE_STAGE',
        event: {
          type: 'stage_start',
          progress: {
            currentStage: stageIndex,
            totalStages: 3,
            percentage: (stageIndex / 3) * 100,
          },
          stageData: {
            ...stageData,
            searchResults: [],
            aiContent: '',
          },
        },
      });

      // Simulate search complete after 1 second
      setTimeout(() => {
        dispatch({
          type: 'UPDATE_STAGE',
          event: {
            type: 'search_complete',
            stageData: {
              ...stageData,
              aiContent: '',
            },
          },
        });

        // Simulate AI response after another 2 seconds
        setTimeout(() => {
          dispatch({
            type: 'UPDATE_STAGE',
            event: {
              type: 'ai_response',
              content: stageData.aiContent,
            },
          });

          // Stage complete after 1 more second
          setTimeout(() => {
            dispatch({
              type: 'UPDATE_STAGE',
              event: {
                type: 'stage_complete',
                progress: {
                  currentStage: stageIndex + 1,
                  totalStages: 3,
                  percentage: ((stageIndex + 1) / 3) * 100,
                },
                stageData,
              },
            });

            // Move to next stage
            processStage(stageIndex + 1);
          }, 1000);
        }, 2000);
      }, 1000);
    };

    processStage(0);
  }, []);

  const toggleDetailPanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_DETAIL_PANEL' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const contextValue: DeepResearchContextType = {
    state,
    startResearch,
    toggleDetailPanel,
    reset,
    startMockResearch,
  };

  return (
    <DeepResearchContext.Provider value={contextValue}>{children}</DeepResearchContext.Provider>
  );
}

// Hook to use the context
export function useDeepResearch() {
  const context = useContext(DeepResearchContext);
  if (context === undefined) {
    throw new Error('useDeepResearch must be used within a DeepResearchProvider');
  }
  return context;
}
