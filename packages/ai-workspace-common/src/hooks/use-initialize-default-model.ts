import { useEffect } from 'react';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { ProviderItem, ModelInfo } from '@refly/openapi-schema';

/**
 * Hook to initialize default model when user logs in
 * Automatically sets the hkgai-missinginfo model as default if user doesn't have a default model configured
 */
export const useInitializeDefaultModel = () => {
  const { userProfile, isLogin } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    isLogin: state.isLogin,
  }));

  const { setSkillSelectedModel, skillSelectedModel } = useChatStoreShallow((state) => ({
    setSkillSelectedModel: state.setSkillSelectedModel,
    skillSelectedModel: state.skillSelectedModel,
  }));

  useEffect(() => {
    // Only initialize if user is logged in and no model is currently selected
    if (!isLogin || skillSelectedModel) {
      return;
    }

    const defaultModel = userProfile?.preferences?.defaultModel;
    let chatModel = defaultModel?.chat;

    // If no default model configured, create hkgai-searchentry as default
    if (!chatModel) {
      // Initialize with hkgai-searchentry as fallback
      const defaultModelInfo: ModelInfo = {
        name: 'hkgai-searchentry', // Use model ID for proper HKGAI adapter matching
        label: 'HKGAI Search Entry',
        provider: 'hkgai',
        providerItemId: 'hkgai-searchentry-item', // Match exact itemId from database
        tier: 't2',
        contextLimit: 8000,
        maxOutput: 4000,
        capabilities: {},
        isDefault: true,
      };

      // Convert ModelInfo to ProviderItem format
      chatModel = {
        providerId: defaultModelInfo.provider,
        itemId: defaultModelInfo.providerItemId, // This will be 'hkgai-searchentry-item'
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

    // Set the model in chat store
    setSkillSelectedModel(modelInfo);
  }, [isLogin, userProfile, skillSelectedModel, setSkillSelectedModel]);
};
