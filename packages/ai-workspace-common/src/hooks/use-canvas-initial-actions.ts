import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFrontPageStoreShallow } from '../stores/front-page';
import { genActionResultID } from '@refly/utils/id';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useCanvasContext } from '../context/canvas';

export const useCanvasInitialActions = (canvasId: string) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addNode } = useAddNode();
  const { invokeAction } = useInvokeAction();
  const { query, selectedSkill, runtimeConfig, tplConfig, reset } = useFrontPageStoreShallow(
    (state) => ({
      query: state.query,
      selectedSkill: state.selectedSkill,
      runtimeConfig: state.runtimeConfig,
      tplConfig: state.tplConfig,
      reset: state.reset,
    }),
  );

  const { skillSelectedModel } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
  }));

  // Get canvas provider to check connection status
  const { provider } = useCanvasContext();
  const [isConnected, setIsConnected] = useState(false);

  // Store the required data to execute actions after connection
  const pendingActionRef = useRef<{
    source: string | null;
    query: string;
    selectedSkill: any;
    modelInfo: any;
    tplConfig: any;
    runtimeConfig: any;
  } | null>(null);

  // Update connection status when provider status changes
  useEffect(() => {
    if (!provider) return;

    const handleStatus = ({ status }: { status: string }) => {
      setIsConnected(status === 'connected');
    };

    // Check initial status
    setIsConnected(provider.status === 'connected');

    // Listen for status changes
    provider.on('status', handleStatus);

    return () => {
      provider.off('status', handleStatus);
    };
  }, [provider]);

  // Store parameters needed for actions when URL parameters are processed
  useEffect(() => {
    const source = searchParams.get('source');
    const newParams = new URLSearchParams();

    // Copy all params except 'source'
    for (const [key, value] of searchParams.entries()) {
      if (key !== 'source') {
        newParams.append(key, value);
      }
    }
    setSearchParams(newParams);

    // Store the data if we need to execute actions
    if (source === 'front-page' && query?.trim() && canvasId) {
      pendingActionRef.current = {
        source,
        query,
        selectedSkill,
        modelInfo: skillSelectedModel,
        tplConfig,
        runtimeConfig,
      };
    }
  }, [canvasId, query, selectedSkill, searchParams, skillSelectedModel, tplConfig, runtimeConfig]);

  // Execute the actions once connected
  useEffect(() => {
    // Only proceed if we're connected and have pending actions
    if (isConnected && pendingActionRef.current && canvasId) {
      const { query, selectedSkill, modelInfo, tplConfig, runtimeConfig } =
        pendingActionRef.current;

      console.log('Canvas connected, executing initial action:', {
        canvasId,
        query,
        selectedSkill,
        tplConfig,
        runtimeConfig,
      });

      const resultId = genActionResultID();
      invokeAction(
        {
          query,
          resultId,
          selectedSkill,
          modelInfo,
          tplConfig,
          runtimeConfig,
        },
        {
          entityId: canvasId,
          entityType: 'canvas',
        },
      );
      addNode({
        type: 'skillResponse',
        data: {
          title: query,
          entityId: resultId,
          metadata: {
            status: 'executing',
            selectedSkill,
            modelInfo,
            runtimeConfig,
            tplConfig,
            structuredData: {
              query,
            },
          },
        },
      });

      reset();

      // Clear pending action
      pendingActionRef.current = null;
    }
  }, [canvasId, isConnected, invokeAction, addNode, reset]);
};
