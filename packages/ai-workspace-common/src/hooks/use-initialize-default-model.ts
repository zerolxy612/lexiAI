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
    console.log('🔍 [useInitializeDefaultModel] Hook triggered');
    console.log('🔍 [useInitializeDefaultModel] isLogin:', isLogin);
    console.log('🔍 [useInitializeDefaultModel] skillSelectedModel:', skillSelectedModel);
    console.log('🔍 [useInitializeDefaultModel] selectedModel:', selectedModel);
    console.log('🔍 [useInitializeDefaultModel] userProfile:', userProfile);

    // Only initialize if user is logged in and no models are currently selected
    if (!isLogin || (skillSelectedModel && selectedModel)) {
      console.log(
        '🔍 [useInitializeDefaultModel] Early return - either not logged in or models already selected',
      );
      return;
    }

    const defaultModel = userProfile?.preferences?.defaultModel;
    console.log('🔍 [useInitializeDefaultModel] defaultModel from userProfile:', defaultModel);
    let chatModel = defaultModel?.chat;

    // If no default model configured, create hkgai-general as default
    if (!chatModel) {
      console.log('🔍 [useInitializeDefaultModel] No default model, creating RAG model');
      // Initialize with hkgai-rag as fallback for general AI conversations
      // This matches the model used by deep research service
      const defaultModelInfo: ModelInfo = {
        name: 'hkgai-rag', // Changed to RAG model for better performance
        label: 'HKGAI RAG',
        provider: 'hkgai',
        providerItemId: 'hkgai-rag-item', // Match exact itemId from database
        tier: 't2',
        contextLimit: 8000,
        maxOutput: 4000,
        capabilities: {},
        isDefault: true,
      };
      console.log('🔍 [useInitializeDefaultModel] Created defaultModelInfo:', defaultModelInfo);

      // Convert ModelInfo to ProviderItem format
      chatModel = {
        providerId: defaultModelInfo.provider,
        itemId: defaultModelInfo.providerItemId, // This will be 'hkgai-rag-item'
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
      console.log('🔍 [useInitializeDefaultModel] Created chatModel:', chatModel);
    }

    // Convert ProviderItem to ModelInfo format
    const modelInfo: ModelInfo = {
      name: chatModel.config?.modelId || chatModel.name,
      label: chatModel.name,
      provider: chatModel.providerId || 'hkgai',
      tier: chatModel.tier || 't2',
      contextLimit: 8000,
      maxOutput: 4000,
      capabilities: {},
      isDefault: true,
    };
    console.log('🔍 [useInitializeDefaultModel] Final modelInfo to set:', modelInfo);

    // Set both models in chat store to ensure ReflyPilot uses the correct model
    // skillSelectedModel: used by skill nodes
    // selectedModel: used by ChatPanel (including ReflyPilot)
    if (!skillSelectedModel) {
      console.log('🔍 [useInitializeDefaultModel] Setting skillSelectedModel');
      setSkillSelectedModel(modelInfo);
    }
    if (!selectedModel) {
      console.log('🔍 [useInitializeDefaultModel] Setting selectedModel');
      setSelectedModel(modelInfo);
    }

    console.log('🔍 [useInitializeDefaultModel] Model initialization completed');
  }, [
    isLogin,
    userProfile,
    skillSelectedModel,
    selectedModel,
    setSkillSelectedModel,
    setSelectedModel,
  ]);
};
