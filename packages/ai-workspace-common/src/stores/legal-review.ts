import { create } from 'zustand';

interface LegalReviewState {
  isPanelOpen: boolean;
  contractText: string;
  setPanelOpen: (isOpen: boolean) => void;
  setContractText: (text: string) => void;
  openLegalReviewPanel: (text: string) => void;
}

export const useLegalReviewStore = create<LegalReviewState>((set) => ({
  isPanelOpen: false,
  contractText: '',
  setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
  setContractText: (text) => set({ contractText: text }),
  openLegalReviewPanel: (text) => set({ isPanelOpen: true, contractText: text }),
}));

export const useLegalReviewStoreShallow = (callback: (state: LegalReviewState) => any) => {
  return useLegalReviewStore(callback);
};
