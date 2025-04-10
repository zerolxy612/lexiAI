import { useState, useCallback, useRef, useEffect } from "react";

interface UIState {
  isIdle: boolean;
  showNav: boolean;
}

interface Timers {
  idle: NodeJS.Timeout | null;
  nav: NodeJS.Timeout | null;
  minimap: NodeJS.Timeout | null;
}

interface UsePreviewUIOptions {
  isPreviewMode: boolean;
}

/**
 * 预览模式 UI 状态管理 Hook
 */
export const usePreviewUI = ({ isPreviewMode }: UsePreviewUIOptions) => {
  // UI 状态
  const [uiState, setUiState] = useState<UIState>({
    isIdle: false,
    showNav: false
  });
  
  // 预览模式小地图状态
  const [showPreviewMinimap, setShowPreviewMinimap] = useState(false);
  
  // 定时器引用
  const timersRef = useRef<Timers>({ 
    idle: null, 
    nav: null, 
    minimap: null 
  });

  // 统一的 UI 状态更新函数
  const updateUiState = useCallback((updates: Partial<UIState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);

  // 重置定时器
  const resetTimer = useCallback((timerKey: keyof Timers, callback: () => void, delay: number) => {
    if (timersRef.current[timerKey]) {
      clearTimeout(timersRef.current[timerKey]!);
    }
    timersRef.current[timerKey] = setTimeout(callback, delay);
  }, []);

  // 重置闲置状态
  const resetIdleState = useCallback(() => {
    updateUiState({ isIdle: false });
    
    if (isPreviewMode) {
      resetTimer('idle', () => {
        updateUiState({ isIdle: true, showNav: false });
      }, 2000); // 2秒无操作后隐藏导航栏
    }
  }, [isPreviewMode, updateUiState, resetTimer]);

  // 统一的 UI 交互处理函数
  const handleUiInteraction = useCallback(() => {
    resetIdleState();
    updateUiState({ showNav: true });

    resetTimer('nav', () => {
      if (uiState.isIdle) {
        updateUiState({ showNav: false });
      }
    }, 3000); // 悬停3秒后，如果处于闲置状态则隐藏
  }, [resetIdleState, updateUiState, resetTimer, uiState.isIdle]);

  // 预览模式鼠标移动处理
  const handlePreviewMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPreviewMode) return;

      handleUiInteraction();

      // 当鼠标移动到屏幕左侧边缘时显示小地图
      if (e.clientX < 20) {
        setShowPreviewMinimap(true);
        resetTimer('minimap', () => {}, 0);
      }
    },
    [isPreviewMode, handleUiInteraction, resetTimer]
  );

  // 小地图交互处理
  const handleMinimapMouseEnter = useCallback(() => {
    if (timersRef.current.minimap) {
      clearTimeout(timersRef.current.minimap);
      timersRef.current.minimap = null;
    }
  }, []);

  const handleMinimapMouseLeave = useCallback(() => {
    setShowPreviewMinimap(false);
  }, []);

  const handleSideHintClick = useCallback(() => {
    setShowPreviewMinimap(true);
  }, []);

  // 预览模式状态变化处理
  useEffect(() => {
    if (isPreviewMode) {
      resetIdleState();
      updateUiState({ showNav: true });
    } else {
      updateUiState({ isIdle: false, showNav: false });
      Object.keys(timersRef.current).forEach(key => {
        const timerKey = key as keyof Timers;
        if (timersRef.current[timerKey]) {
          clearTimeout(timersRef.current[timerKey]!);
          timersRef.current[timerKey] = null;
        }
      });
    }
  }, [isPreviewMode, resetIdleState, updateUiState]);

  // 清理所有定时器
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  return {
    uiState,
    showPreviewMinimap,
    setShowPreviewMinimap,
    handleUiInteraction,
    handlePreviewMouseMove,
    handleMinimapMouseEnter,
    handleMinimapMouseLeave,
    handleSideHintClick,
    resetIdleState,
  };
};
