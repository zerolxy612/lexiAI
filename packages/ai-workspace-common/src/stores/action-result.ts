import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { ActionResult } from '@refly/openapi-schema';
import { persist } from 'zustand/middleware';

// Maximum number of action results to keep in storage
const MAX_STORED_RESULTS = 5;

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
  lastUsedResults: string[]; // Track recently used result IDs in order

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

  // Storage management
  trackResultUsage: (resultId: string) => void;
  cleanupOldResults: () => void;
}

export const defaultState = {
  resultMap: {},
  pollingStateMap: {},
  batchUpdateQueue: [],
  isBatchUpdateScheduled: false,
  lastUsedResults: [],
};

const POLLING_STATE_INITIAL: PollingState = {
  notFoundErrorCount: 0,
  lastPollTime: 0,
  isPolling: false,
  version: 0,
  timeoutStartTime: null,
  lastEventTime: null,
};

// Helper function to update the last used results array
const updateLastUsedResults = (lastUsedResults: string[], resultId: string): string[] => {
  // Remove the resultId if it already exists
  const filteredResults = lastUsedResults.filter((id) => id !== resultId);

  // Add the resultId to the beginning (most recent)
  return [resultId, ...filteredResults].slice(0, MAX_STORED_RESULTS);
};

// Optimization: use selective updates instead of full immer for simple property changes
export const useActionResultStore = create<ActionResultState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      // Track result usage (call this whenever a result is accessed)
      trackResultUsage: (resultId: string) => {
        set((state) => ({
          ...state,
          lastUsedResults: updateLastUsedResults(state.lastUsedResults, resultId),
        }));
      },

      // Clean up old results that exceed the maximum
      cleanupOldResults: () => {
        set((state) => {
          const { lastUsedResults, resultMap, pollingStateMap } = state;

          // Keep only the most recent results based on lastUsedResults
          const resultIdsToKeep = new Set(lastUsedResults.slice(0, MAX_STORED_RESULTS));

          const newResultMap: Record<string, ActionResult> = {};
          const newPollingStateMap: Record<string, PollingState> = {};

          // Keep only the results we want to retain
          for (const resultId of resultIdsToKeep) {
            if (resultMap[resultId]) {
              newResultMap[resultId] = resultMap[resultId];
            }

            if (pollingStateMap[resultId]) {
              newPollingStateMap[resultId] = pollingStateMap[resultId];
            }
          }

          return {
            ...state,
            resultMap: newResultMap,
            pollingStateMap: newPollingStateMap,
          };
        });
      },

      // Direct update (use sparingly - prefer queueActionResultUpdate)
      updateActionResult: (resultId: string, result: ActionResult) => {
        // Shallow update to avoid deep copying the entire store
        set((state) => {
          // Track usage and clean up if needed
          const updatedLastUsed = updateLastUsedResults(state.lastUsedResults, resultId);

          return {
            ...state,
            resultMap: {
              ...state.resultMap,
              [resultId]: result,
            },
            lastUsedResults: updatedLastUsed,
          };
        });

        // Clean up old results after update
        get().cleanupOldResults();
      },

      // Queue update for batching
      queueActionResultUpdate: (resultId: string, result: ActionResult) => {
        set((state) => {
          // Track usage whenever we update a result
          const updatedLastUsed = updateLastUsedResults(state.lastUsedResults, resultId);

          // Check if there's already an update for this resultId in the queue
          const existingUpdateIndex = state.batchUpdateQueue.findIndex(
            (item) => item.resultId === resultId,
          );

          const updatedQueue = [...state.batchUpdateQueue];

          if (existingUpdateIndex !== -1) {
            // Replace the existing update with the new one to avoid duplicate updates
            updatedQueue[existingUpdateIndex] = { resultId, result };
          } else {
            // Add to queue if no existing update
            updatedQueue.push({ resultId, result });
          }

          // Schedule processing if not already scheduled
          if (!state.isBatchUpdateScheduled && updatedQueue.length > 0) {
            // Use requestAnimationFrame for better synchronization with browser rendering
            window.setTimeout(() => {
              window.requestAnimationFrame(() => {
                get().processBatchedUpdates();
                // Clean up old results after processing batch updates
                get().cleanupOldResults();
              });
            }, 100); // Increased batching delay for better performance

            return {
              ...state,
              batchUpdateQueue: updatedQueue,
              isBatchUpdateScheduled: true,
              lastUsedResults: updatedLastUsed,
            };
          }

          return {
            ...state,
            batchUpdateQueue: updatedQueue,
            lastUsedResults: updatedLastUsed,
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
          let updatedLastUsed = [...state.lastUsedResults];

          // First group updates by resultId to ensure we only process the latest update for each result
          const latestUpdates = new Map<string, ActionResult>();

          for (const { resultId, result } of state.batchUpdateQueue) {
            latestUpdates.set(resultId, result);
            // Update last used tracking for each result
            updatedLastUsed = updateLastUsedResults(updatedLastUsed, resultId);
          }

          // Apply all updates at once
          for (const [resultId, result] of latestUpdates.entries()) {
            updatedResultMap[resultId] = result;
          }

          return {
            ...state,
            resultMap: updatedResultMap,
            batchUpdateQueue: [],
            isBatchUpdateScheduled: false,
            lastUsedResults: updatedLastUsed,
          };
        });
      },

      startPolling: (resultId: string, version: number) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId] || {
            ...POLLING_STATE_INITIAL,
          };

          // Track usage when polling starts
          const updatedLastUsed = updateLastUsedResults(state.lastUsedResults, resultId);

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
            lastUsedResults: updatedLastUsed,
          };
        });
      },

      stopPolling: (resultId: string) => {
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          // Track usage when stopping polling
          const updatedLastUsed = updateLastUsedResults(state.lastUsedResults, resultId);

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
            lastUsedResults: updatedLastUsed,
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

          // Track usage when starting timeout
          const updatedLastUsed = updateLastUsedResults(state.lastUsedResults, resultId);

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
            lastUsedResults: updatedLastUsed,
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
          let updatedLastUsed = [...state.lastUsedResults];

          for (const update of updates) {
            const { resultId, state: partialState } = update;
            const currentState = newPollingStateMap[resultId] || { ...POLLING_STATE_INITIAL };

            newPollingStateMap[resultId] = {
              ...currentState,
              ...partialState,
            };

            // Track usage for each updated resultId
            updatedLastUsed = updateLastUsedResults(updatedLastUsed, resultId);
          }

          return {
            ...state,
            pollingStateMap: newPollingStateMap,
            lastUsedResults: updatedLastUsed,
          };
        });

        // Clean up old results after batch updates
        get().cleanupOldResults();
      },
    }),
    {
      name: 'action-result-storage',
      partialize: (state) => ({
        resultMap: state.resultMap,
        pollingStateMap: state.pollingStateMap,
        lastUsedResults: state.lastUsedResults,
      }),
    },
  ),
);

export const useActionResultStoreShallow = <T>(selector: (state: ActionResultState) => T) => {
  return useActionResultStore(useShallow(selector));
};
