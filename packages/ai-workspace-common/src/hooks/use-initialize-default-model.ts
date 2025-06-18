import { useEffect } from 'react';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { ProviderItem, ModelInfo } from '@refly/openapi-schema';

/**
 * Hook to initialize default model when user logs in
 * Automatically sets the hkgai-general model as default if user doesn't have a default model configured
 */
export const useInitializeDefaultModel = () => {
  const { userProfile, isLogin } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    isLogin: state.isLogin,
  }));

  const { setSkillSelectedModel, skillSelectedModel, setSelectedModel, selectedModel } =
    useChatStoreShallow((state) => ({
      setSkillSelectedModel: state.setSkillSelectedModel,
      skillSelectedModel: state.skillSelectedModel,
      setSelectedModel: state.setSelectedModel,
      selectedModel: state.selectedModel,
    }));

  useEffect(() => {
    // Only initialize if user is logged in and no models are currently selected
    if (!isLogin || (skillSelectedModel && selectedModel)) {
      return;
    }

    const defaultModel = userProfile?.preferences?.defaultModel;
    let chatModel = defaultModel?.chat;

    // If no default model configured, create hkgai-general as default
    if (!chatModel) {
      // Initialize with hkgai-general as fallback for general AI conversations
      // This matches the model used by askai nodes (1-for-general)
      const defaultModelInfo: ModelInfo = {
        name: 'hkgai-general', // Changed from hkgai-missinginfo to hkgai-general
        label: 'HKGAI General',
        provider: 'hkgai',
        providerItemId: 'hkgai-general-item', // Match exact itemId from database
        tier: 't2',
        contextLimit: 8000,
        maxOutput: 4000,
        capabilities: {},
        isDefault: true,
      };

      // Convert ModelInfo to ProviderItem format
      chatModel = {
        providerId: defaultModelInfo.provider,
        itemId: defaultModelInfo.providerItemId, // This will be 'hkgai-general-item'
        category: 'llm',
        name: defaultModelInfo.label,
        enabled: true,
        config: {
          modelId: defaultModelInfo.name,
          contextLimit: defaultModelInfo.contextLimit,
          maxOutput: defaultModelInfo.maxOutput,
          capabilities: defaultModelInfo.capabilities,
        },
        tier: defaultModelInfo.tier,
        order: 0,
        groupName: 'HKGAI',
      } as ProviderItem;
    }

    // Convert ProviderItem to ModelInfo format
    const modelInfo: ModelInfo = {
      name: chatModel.name,
      label: chatModel.name,
      provider: chatModel.providerId || 'hkgai',
      tier: chatModel.tier || 't2',
      contextLimit: 8000,
      maxOutput: 4000,
      capabilities: {},
      isDefault: true,
    };

    // Set both models in chat store to ensure ReflyPilot uses the correct model
    // skillSelectedModel: used by skill nodes
    // selectedModel: used by ChatPanel (including ReflyPilot)
    if (!skillSelectedModel) {
      setSkillSelectedModel(modelInfo);
    }
    if (!selectedModel) {
      setSelectedModel(modelInfo);
    }
  }, [
    isLogin,
    userProfile,
    skillSelectedModel,
    selectedModel,
    setSkillSelectedModel,
    setSelectedModel,
  ]);
};
