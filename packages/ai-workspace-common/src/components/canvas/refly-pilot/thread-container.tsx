import { memo, useCallback, useEffect, useMemo, useState, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from 'antd';
import { cn } from '@refly/utils/cn';
import {
  IconClose,
  IconExitWideMode,
  IconWideMode,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { Maximize2, Minimize2 } from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import { LinearThreadContent } from './linear-thread';
import { LinearThreadMessage } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useContextUpdateByResultId } from '@refly-packages/ai-workspace-common/hooks/canvas/use-debounced-context-update';
import { LaunchPad } from '@refly-packages/ai-workspace-common/components/canvas/launchpad';
import {
  useContextPanelStore,
  ContextTarget,
  IContextItem,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { IconAskAI } from '@refly-packages/ai-workspace-common/components/common/icon';
import { SkillTemplateConfig } from '@refly/openapi-schema';
import { contextEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/context';

export interface ThreadContainerProps {
  className?: string;
  resultId?: string;
  standalone?: boolean;
  messages: LinearThreadMessage[];
  onAddMessage: (
    message: { id: string; resultId: string; nodeId: string; data?: any },
    query?: string,
    contextItems?: any[],
  ) => void;
  onClearConversation: () => void;
  onGenerateMessageIds: () => { resultId: string; nodeId: string };
  onClose?: () => void;
  tplConfig?: SkillTemplateConfig | null;
  onUpdateTplConfig?: (config: SkillTemplateConfig | null) => void;
}

const ThreadHeader = memo(
  ({
    onClose,
    onMaximize,
    isMaximized,
    onWideMode,
    isWideMode,
    onClearConversation,
  }: {
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
    onWideMode: () => void;
    isWideMode: boolean;
    onClearConversation: () => void;
  }) => {
    const { t } = useTranslation();

    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary-600 shadow-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium flex items-center justify-center">
              <IconAskAI className="w-3 h-3" />
            </span>
          </div>
          <span className="text-sm font-medium leading-normal">
            {t('canvas.reflyPilot.title', { defaultValue: 'Ask AI' })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="text"
            size="small"
            icon={<RefreshCw className="w-3 h-3" />}
            onClick={onClearConversation}
            className="opacity-60 hover:opacity-100 transition-opacity"
            title={t('canvas.reflyPilot.clearConversation', { defaultValue: 'Clear conversation' })}
          />

          {!isMaximized && (
            <Button
              type="text"
              size="small"
              icon={
                isWideMode ? (
                  <IconExitWideMode className="w-3 h-3" />
                ) : (
                  <IconWideMode className="w-3 h-3" />
                )
              }
              onClick={onWideMode}
              className="opacity-60 hover:opacity-100 transition-opacity"
              title={isWideMode ? t('common.exitWideMode') : t('common.wideMode')}
            />
          )}

          <Button
            type="text"
            size="small"
            icon={
              isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />
            }
            onClick={onMaximize}
            className="opacity-60 hover:opacity-100 transition-opacity"
            title={isMaximized ? t('common.minimize') : t('common.maximize')}
          />

          <Button
            type="text"
            size="small"
            icon={<IconClose className="w-3 h-3" />}
            onClick={onClose}
            className="opacity-60 hover:opacity-100 transition-opacity"
            title={t('common.close')}
          />
        </div>
      </div>
    );
  },
);

ThreadHeader.displayName = 'ThreadHeader';

export const ThreadContainer = memo(
  forwardRef<HTMLDivElement, ThreadContainerProps>((props, ref) => {
    const {
      className,
      resultId,
      messages,
      onAddMessage,
      onClearConversation,
      onGenerateMessageIds,
      onClose,
      tplConfig,
      onUpdateTplConfig,
    } = props;

    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize isMaximized from URL parameters
    const [isMaximized, setIsMaximized] = useState(() => {
      return searchParams.get('reflyPilotMaximized') === 'true';
    });
    const [isWideMode, setIsWideMode] = useState(false);
    const [contentHeight, setContentHeight] = useState('auto');

    // Monitor URL parameter changes for ReflyPilot maximized state
    useEffect(() => {
      const isMaximizedFromUrl = searchParams.get('reflyPilotMaximized') === 'true';
      console.log('🎯 [ReflyPilot] URL parameter changed:', {
        isMaximizedFromUrl,
        currentIsMaximized: isMaximized,
        urlParams: searchParams.toString(),
      });

      if (isMaximizedFromUrl !== isMaximized) {
        console.log('🎯 [ReflyPilot] Updating maximized state:', {
          from: isMaximized,
          to: isMaximizedFromUrl,
        });
        setIsMaximized(isMaximizedFromUrl);
      }
    }, [searchParams, isMaximized]);

    // Get context panel store to manage context items
    const { setContextItems, setActiveResultId } = useContextPanelStoreShallow((state) => ({
      setContextItems: state.setContextItems,
      setActiveResultId: state.setActiveResultId,
    }));

    // Use our custom hook instead of the local implementation
    const { debouncedUpdateContextItems } = useContextUpdateByResultId({
      resultId,
      setContextItems,
    });

    // Listen for context events for the global pilot
    useEffect(() => {
      const handleAddToContext = (data: { contextItem: IContextItem; resultId: string }) => {
        if (data.resultId === ContextTarget.Global) {
          const { contextItems } = useContextPanelStore.getState();
          setContextItems([...contextItems, data.contextItem]);
        }
      };

      // Register event listeners
      contextEmitter.on('addToContext', handleAddToContext);

      // Cleanup
      return () => {
        contextEmitter.off('addToContext', handleAddToContext);
      };
    }, [setActiveResultId]);

    // Add ESC key handler to exit fullscreen
    useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isMaximized) {
          setIsMaximized(false);
          // Update URL parameters when exiting fullscreen via ESC
          setSearchParams((prev) => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('reflyPilotMaximized');
            return newParams;
          });
        }
      };

      document.addEventListener('keydown', handleEscKey);

      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }, [isMaximized, setSearchParams]);

    const handleClose = useCallback(() => {
      if (onClose) {
        onClose();
      }
      // Clear URL parameters when closing
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('reflyPilotMaximized');
        return newParams;
      });
    }, [onClose, setSearchParams]);

    const handleMaximize = useCallback(() => {
      const newIsMaximized = !isMaximized;
      setIsMaximized(newIsMaximized);
      if (isWideMode && !isMaximized) {
        setIsWideMode(false);
      }

      // Update URL parameters when toggling maximize
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (newIsMaximized) {
          newParams.set('reflyPilotMaximized', 'true');
        } else {
          newParams.delete('reflyPilotMaximized');
        }
        return newParams;
      });
    }, [isMaximized, isWideMode, setSearchParams]);

    const handleWideMode = useCallback(() => {
      setIsWideMode(!isWideMode);
      if (isMaximized && !isWideMode) {
        setIsMaximized(false);
        // Clear maximized URL parameter when entering wide mode
        setSearchParams((prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.delete('reflyPilotMaximized');
          return newParams;
        });
      }
    }, [isWideMode, isMaximized, setSearchParams]);

    const containerStyles = useMemo(
      () => ({
        height: isMaximized ? '100vh' : 'calc(100vh - 72px)',
        width: isMaximized ? 'calc(100vw)' : isWideMode ? '840px' : '420px',
        position: isMaximized ? ('fixed' as const) : ('relative' as const),
        top: isMaximized ? 0 : null,
        right: isMaximized ? 0 : null,
        zIndex: isMaximized ? 50 : 10,
        transition: isMaximized
          ? 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          : 'all 50ms cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column' as const,
        borderRadius: isMaximized ? 0 : '0.5rem',
      }),
      [isMaximized, isWideMode],
    );

    const containerClassName = useMemo(
      () => `
        flex-shrink-0 
        bg-white dark:bg-gray-900
        border 
        border-gray-200 dark:border-gray-700
        flex 
        flex-col
        will-change-transform
        ${isMaximized ? 'fixed' : 'rounded-lg'}
      `,
      [isMaximized],
    );

    // Handle window resize and update dimensions
    useEffect(() => {
      const updateDimensions = () => {
        // Calculate available space
        const viewportHeight = window.innerHeight;
        const headerHeight = 52; // Header height
        const launchpadHeight = 180; // Approximate height of launchpad + margins
        const topOffset = isMaximized ? 0 : 72; // No offset when maximized

        // Calculate content height
        const availableHeight = viewportHeight - topOffset - headerHeight - launchpadHeight;

        if (messages.length === 0) {
          setContentHeight('auto');
        } else {
          // Make content area taller when maximized
          const minHeight = isMaximized ? 500 : 300;
          setContentHeight(`${Math.max(minHeight, availableHeight)}px`);
        }
      };

      // Initial calculation
      updateDimensions();

      // Listen for window resize
      window.addEventListener('resize', updateDimensions);

      return () => {
        window.removeEventListener('resize', updateDimensions);
      };
    }, [messages.length, isMaximized]);

    // Update context when resultId changes or component mounts
    useEffect(() => {
      if (resultId) {
        // Add delay to ensure edges have been properly updated in React Flow
        const timer = setTimeout(() => {
          debouncedUpdateContextItems();
        }, 150);

        return () => clearTimeout(timer);
      }
    }, [resultId, debouncedUpdateContextItems]);

    const outerContainerStyles = useMemo(
      () => ({
        marginLeft: 'auto', // Right-align the container to match NodePreview
      }),
      [],
    );

    return (
      <div
        ref={ref}
        className="border border-solid border-gray-100 rounded-lg bg-transparent dark:border-gray-800 "
        style={outerContainerStyles}
      >
        <div className={cn(containerClassName, className)} style={containerStyles}>
          <div>
            <ThreadHeader
              onClose={handleClose}
              onMaximize={handleMaximize}
              isMaximized={isMaximized}
              onWideMode={handleWideMode}
              isWideMode={isWideMode}
              onClearConversation={onClearConversation}
            />
          </div>

          <LinearThreadContent messages={messages} contentHeight={contentHeight} />

          <div className="mt-auto border-t border-gray-200 w-full max-w-[1024px] mx-auto dark:border-gray-700">
            <LaunchPad
              visible={true}
              inReflyPilot={true}
              onAddMessage={onAddMessage}
              onGenerateMessageIds={onGenerateMessageIds}
              className="w-full max-w-[1024px] mx-auto"
              tplConfig={tplConfig}
              onUpdateTplConfig={onUpdateTplConfig}
            />
          </div>
        </div>
      </div>
    );
  }),
);

ThreadContainer.displayName = 'ThreadContainer';
