import React, { memo, useCallback, useEffect } from 'react';
import { notification } from 'antd';
import {
  DeepResearchContainer,
  useDeepResearchTrigger,
  DeepResearchProvider,
} from '../../deep-research';

interface DeepResearchWrapperProps {
  children: React.ReactNode;
  onTrigger?: (query: string) => void;
}

// Create a global event emitter for deep research triggers
class DeepResearchEventEmitter {
  private listeners: Array<(query: string) => void> = [];

  subscribe(listener: (query: string) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  trigger(query: string) {
    this.listeners.forEach((listener) => listener(query));
  }
}

export const deepResearchEmitter = new DeepResearchEventEmitter();

// Inner component that uses the deep research hook
const DeepResearchTriggerHandler = memo(() => {
  const [currentQuery, setCurrentQuery] = React.useState('');

  const { handleTrigger } = useDeepResearchTrigger({
    query: currentQuery,
    onTrigger: () => {
      console.log('🎯 Deep research started for:', currentQuery);
    },
  });

  useEffect(() => {
    const unsubscribe = deepResearchEmitter.subscribe((query: string) => {
      if (!query?.trim()) {
        notification.info({
          message: '三段检索',
          description: '请先输入问题，然后点击深度分析图标开始三段检索',
        });
        return;
      }

      // Set the query and trigger
      setCurrentQuery(query.trim());

      // Trigger after query is set
      setTimeout(() => {
        handleTrigger();
      }, 0);
    });

    return unsubscribe;
  }, [handleTrigger]);

  return null;
});

DeepResearchTriggerHandler.displayName = 'DeepResearchTriggerHandler';

// Main wrapper component
export const DeepResearchWrapper = memo(({ children, onTrigger }: DeepResearchWrapperProps) => {
  const triggerDeepResearch = useCallback(
    (query: string) => {
      onTrigger?.(query);
      deepResearchEmitter.trigger(query);
    },
    [onTrigger],
  );

  // Expose the trigger function globally
  useEffect(() => {
    // Make trigger function available globally
    (window as any).triggerDeepResearch = triggerDeepResearch;

    return () => {
      delete (window as any).triggerDeepResearch;
    };
  }, [triggerDeepResearch]);

  return (
    <DeepResearchProvider>
      <div className="relative">
        {children}

        {/* Deep Research UI Components with test trigger */}
        <DeepResearchContainer showTestTrigger={true} />

        {/* Event handler */}
        <DeepResearchTriggerHandler />
      </div>
    </DeepResearchProvider>
  );
});

DeepResearchWrapper.displayName = 'DeepResearchWrapper';
