import { useState, useCallback, useEffect, useRef } from "react";
import { type NodeRelation } from "../components/ArtifactRenderer";

interface UseSlideshowOptions {
  nodes: NodeRelation[];
  isPreviewMode: boolean;
  handleUiInteraction: () => void;
}

/**
 * 幻灯片预览模式 Hook
 */
export const useSlideshow = ({
  nodes,
  isPreviewMode,
  handleUiInteraction,
}: UseSlideshowOptions) => {
  // 幻灯片状态
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const previewContentRef = useRef<HTMLDivElement>(null);

  // 幻灯片导航方法
  const nextSlide = useCallback(() => {
    if (currentSlideIndex < nodes.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  }, [currentSlideIndex, nodes.length]);

  const prevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  }, [currentSlideIndex]);

  // 处理幻灯片选择
  const handlePreviewSlideSelect = useCallback((index: number) => {
    setCurrentSlideIndex(index);
  }, []);

  // 键盘导航控制
  useEffect(() => {
    if (!isPreviewMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "Space":
          nextSlide();
          break;
        case "ArrowLeft":
          prevSlide();
          break;
        case "Escape":
          // 这里不直接设置 isPreviewMode，而是通过外部回调处理
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewMode, nextSlide, prevSlide]);

  // 添加触摸手势支持
  useEffect(() => {
    if (!isPreviewMode || !previewContentRef.current) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
      // 触摸时重置闲置状态
      handleUiInteraction();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleTouchMove = () => {
      // 触摸移动时重置闲置状态
      handleUiInteraction();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      if (touchEndX < touchStartX - swipeThreshold) {
        nextSlide();
      }
      if (touchEndX > touchStartX + swipeThreshold) {
        prevSlide();
      }
    };

    const element = previewContentRef.current;
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isPreviewMode, nextSlide, prevSlide, handleUiInteraction]);

  // 重置当前幻灯片索引
  const resetSlideIndex = useCallback(() => {
    setCurrentSlideIndex(0);
  }, []);

  return {
    currentSlideIndex,
    setCurrentSlideIndex,
    nextSlide,
    prevSlide,
    handlePreviewSlideSelect,
    previewContentRef,
    resetSlideIndex,
  };
};
