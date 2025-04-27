import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { ActionResult } from '@refly/openapi-schema';
import { persist } from 'zustand/middleware';

interface PollingState {
  notFoundErrorCount: number;
  lastPollTime: number;
  isPolling: boolean;
  version: number;
  timeoutStartTime: number | null;
  lastEventTime: number | null;
}

interface ActionResultState {
  resultMap: Record<string, ActionResult>;
  pollingStateMap: Record<string, PollingState>;
  batchUpdateQueue: Array<{ resultId: string; result: ActionResult }>;
  isBatchUpdateScheduled: boolean;

  // Individual update actions
  updateActionResult: (resultId: string, result: ActionResult) => void;
  startPolling: (resultId: string, version: number) => void;
  stopPolling: (resultId: string) => void;
  incrementErrorCount: (resultId: string) => void;
  resetErrorCount: (resultId: string) => void;
  updateLastPollTime: (resultId: string) => void;
  startTimeout: (resultId: string) => void;
  updateLastEventTime: (resultId: string) => void;
  clearTimeout: (resultId: string) => void;

  // Batched update actions
  queueActionResultUpdate: (resultId: string, result: ActionResult) => void;
  processBatchedUpdates: () => void;
  batchPollingStateUpdates: (
    updates: Array<{ resultId: string; state: Partial<PollingState> }>,
  ) => void;
}

export const defaultState = {
  resultMap: {},
  pollingStateMap: {},
  batchUpdateQueue: [],
  isBatchUpdateScheduled: false,
};

const POLLING_STATE_INITIAL: PollingState = {
  notFoundErrorCount: 0,
  lastPollTime: 0,
  isPolling: false,
  version: 0,
  timeoutStartTime: null,
  lastEventTime: null,
};

// Optimization: use selective updates instead of full immer for simple property changes
export const useActionResultStore = create<ActionResultState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      // Direct update (use sparingly - prefer queueActionResultUpdate)
      updateActionResult: (resultId: string, result: ActionResult) => {
        // Shallow update to avoid deep copying the entire store
        set((state) => {
          return {
            ...state,
            resultMap: {
              ...state.resultMap,
              [resultId]: result,
            },
          };
        });
      },

      // Queue update for batching
      queueActionResultUpdate: (resultId: string, result: ActionResult) => {
        set((state) => {
          // Add to queue
          const updatedQueue = [...state.batchUpdateQueue, { resultId, result }];

          // Schedule processing if not already scheduled
          if (!state.isBatchUpdateScheduled && updatedQueue.length === 1) {
            setTimeout(() => {
              get().processBatchedUpdates();
            }, 50); // Batch updates with a 50ms delay

            return {
              ...state,
              batchUpdateQueue: updatedQueue,
              isBatchUpdateScheduled: true,
            };
          }

          return {
            ...state,
            batchUpdateQueue: updatedQueue,
          };
        });
      },

      // Process all batched updates at once
      processBatchedUpdates: () => {
        set((state) => {
          if (state.batchUpdateQueue.length === 0) {
            return {
              ...state,
              isBatchUpdateScheduled: false,
            };
          }

          // Create new result map with all batched updates
          const updatedResultMap = { ...state.resultMap };

          for (const { resultId, result } of state.batchUpdateQueue) {
            updatedResultMap[resultId] = result;
          }

          return {
            ...state,
            resultMap: updatedResultMap,
            batchUpdateQueue: [],
            isBatchUpdateScheduled: false,
          };
        });
      },

      startPolling: (resultId: string, version: number) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId] || {
            ...POLLING_STATE_INITIAL,
          };
          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                isPolling: true,
                version,
                lastPollTime: Date.now(),
              },
            },
          };
        });
      },

      stopPolling: (resultId: string) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                isPolling: false,
                timeoutStartTime: null,
                lastEventTime: null,
              },
            },
          };
        });
      },

      incrementErrorCount: (resultId: string) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId] || {
            ...POLLING_STATE_INITIAL,
          };
          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                notFoundErrorCount: currentPollingState.notFoundErrorCount + 1,
              },
            },
          };
        });
      },

      resetErrorCount: (resultId: string) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                notFoundErrorCount: 0,
              },
            },
          };
        });
      },

      updateLastPollTime: (resultId: string) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                lastPollTime: Date.now(),
              },
            },
          };
        });
      },

      startTimeout: (resultId: string) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId] || {
            ...POLLING_STATE_INITIAL,
          };
          const now = Date.now();

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                timeoutStartTime: now,
                lastEventTime: now,
              },
            },
          };
        });
      },

      updateLastEventTime: (resultId: string) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                lastEventTime: Date.now(),
              },
            },
          };
        });
      },

      clearTimeout: (resultId: string) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                timeoutStartTime: null,
                lastEventTime: null,
              },
            },
          };
        });
      },

      // Batched update for multiple polling state changes at once
      batchPollingStateUpdates: (
        updates: Array<{ resultId: string; state: Partial<PollingState> }>,
      ) => {
        set((state) => {
          const newPollingStateMap = { ...state.pollingStateMap };

          for (const update of updates) {
            const { resultId, state: partialState } = update;
            const currentState = newPollingStateMap[resultId] || { ...POLLING_STATE_INITIAL };

            newPollingStateMap[resultId] = {
              ...currentState,
              ...partialState,
            };
          }

          return {
            ...state,
            pollingStateMap: newPollingStateMap,
          };
        });
      },
    }),
    {
      name: 'action-result-storage',
      partialize: (state) => ({
        resultMap: state.resultMap,
        pollingStateMap: state.pollingStateMap,
      }),
    },
  ),
);

export const useActionResultStoreShallow = <T>(selector: (state: ActionResultState) => T) => {
  return useActionResultStore(useShallow(selector));
};
