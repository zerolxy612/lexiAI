import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface DeepResearchState {
  // 面板显示状态
  isDeepShow: boolean;
  deepShowContent: string;

  // 新的面板状态
  isPanelOpen: boolean;
  currentQuery: string;

  // 三段检索内容
  streamingAnswer: string;
  streamingAnswer2: string;
  streamingAnswer3: string;

  // 搜索结果
  searchResults: SearchResult[];
  searchResults2: SearchResult[];
  searchResults3: SearchResult[];

  // 显示控制
  showSearch: boolean;
  showSearch2: boolean;
  showSearch3: boolean;
  showLoad: boolean;

  // Track if deep analysis is selected for a specific result
  deepAnalysisSelected: Record<string, boolean>;

  // Actions
  setIsDeepShow: (show: boolean) => void;
  setDeepShowContent: (content: string) => void;
  setIsPanelOpen: (open: boolean) => void;
  setCurrentQuery: (query: string) => void;
  setStreamingAnswer: (answer: string) => void;
  setStreamingAnswer2: (answer: string) => void;
  setStreamingAnswer3: (answer: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setSearchResults2: (results: SearchResult[]) => void;
  setSearchResults3: (results: SearchResult[]) => void;
  setShowSearch: (show: boolean) => void;
  setShowSearch2: (show: boolean) => void;
  setShowSearch3: (show: boolean) => void;
  setShowLoad: (show: boolean) => void;
  resetAllStates: () => void;
  setDeepAnalysisSelected: (resultId: string, selected: boolean) => void;
  clearDeepAnalysisSelection: (resultId: string) => void;
  isDeepAnalysisSelected: (resultId: string) => boolean;
}

export const useDeepResearchStore = create<DeepResearchState>((set, get) => ({
  // Initial state
  isDeepShow: false,
  deepShowContent: '',
  isPanelOpen: false,
  currentQuery: '',
  streamingAnswer: '',
  streamingAnswer2: '',
  streamingAnswer3: '',
  searchResults: [],
  searchResults2: [],
  searchResults3: [],
  showSearch: false,
  showSearch2: false,
  showSearch3: false,
  showLoad: false,
  deepAnalysisSelected: {},

  // Actions
  setIsDeepShow: (show) => set({ isDeepShow: show }),
  setDeepShowContent: (content) => set({ deepShowContent: content }),
  setIsPanelOpen: (open) => set({ isPanelOpen: open }),
  setCurrentQuery: (query) => set({ currentQuery: query }),
  setStreamingAnswer: (answer) => set({ streamingAnswer: answer }),
  setStreamingAnswer2: (answer) => set({ streamingAnswer2: answer }),
  setStreamingAnswer3: (answer) => set({ streamingAnswer3: answer }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchResults2: (results) => set({ searchResults2: results }),
  setSearchResults3: (results) => set({ searchResults3: results }),
  setShowSearch: (show) => set({ showSearch: show }),
  setShowSearch2: (show) => set({ showSearch2: show }),
  setShowSearch3: (show) => set({ showSearch3: show }),
  setShowLoad: (show) => set({ showLoad: show }),

  resetAllStates: () =>
    set({
      showSearch: false,
      showSearch2: false,
      showSearch3: false,
      streamingAnswer: '',
      streamingAnswer2: '',
      streamingAnswer3: '',
      searchResults: [],
      searchResults2: [],
      searchResults3: [],
      showLoad: false,
    }),

  setDeepAnalysisSelected: (resultId: string, selected: boolean) =>
    set((state) => ({
      deepAnalysisSelected: {
        ...state.deepAnalysisSelected,
        [resultId]: selected,
      },
    })),

  clearDeepAnalysisSelection: (resultId: string) =>
    set((state) => {
      const { [resultId]: _, ...rest } = state.deepAnalysisSelected;
      return { deepAnalysisSelected: rest };
    }),

  isDeepAnalysisSelected: (resultId: string) => {
    const state = get();
    return state.deepAnalysisSelected[resultId] || false;
  },
}));

export const useDeepResearchStoreShallow = <T>(selector: (state: DeepResearchState) => T) => {
  return useDeepResearchStore(useShallow(selector));
};
