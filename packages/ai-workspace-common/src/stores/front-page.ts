import { create } from 'zustand';
import { Skill, SkillTemplateConfig, SkillRuntimeConfig } from '@refly/openapi-schema';

interface FrontPageState {
  query: string;
  selectedSkill: Skill | null;
  tplConfig: SkillTemplateConfig | null;
  runtimeConfig: SkillRuntimeConfig | null;
  setQuery: (query: string) => void;
  setSelectedSkill: (skill: Skill | null) => void;
  setTplConfig: (tplConfig: SkillTemplateConfig | null) => void;
  setRuntimeConfig: (runtimeConfig: SkillRuntimeConfig | null) => void;
  reset: () => void;
}

export const useFrontPageStore = create<FrontPageState>((set) => ({
  query: '',
  selectedSkill: null,
  tplConfig: null,
  runtimeConfig: null,
  setQuery: (query) => set({ query }),
  setSelectedSkill: (selectedSkill) => set({ selectedSkill }),
  setTplConfig: (tplConfig) => set({ tplConfig }),
  setRuntimeConfig: (runtimeConfig) => set({ runtimeConfig }),
  reset: () => set({ query: '', selectedSkill: null, tplConfig: null, runtimeConfig: null }),
}));

export const useFrontPageStoreShallow = (selector: (state: FrontPageState) => any) => {
  return useFrontPageStore(selector);
};
