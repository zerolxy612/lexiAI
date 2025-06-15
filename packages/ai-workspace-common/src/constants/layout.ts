/**
 * Layout constants for consistent sizing across components
 * 布局常量，确保组件间尺寸的一致性
 *
 * IMPORTANT: This file was created to fix the sidebar overlay issue where TopToolbar
 * was being covered by the sidebar due to inconsistent width calculations.
 *
 * 重要说明：此文件用于修复侧边栏遮挡问题，该问题是由于 TopToolbar 和主布局
 * 使用不一致的宽度计算导致的。
 *
 * Problem solved:
 * - TopToolbar was using: calc(100vw - 232px) when expanded
 * - Main layout was using: calc(100% - 300px - 16px) when expanded
 * - This 84px difference caused the toolbar to be partially covered
 *
 * 解决的问题：
 * - TopToolbar 展开时使用：calc(100vw - 232px)
 * - 主布局展开时使用：calc(100% - 300px - 16px)
 * - 84px 的差异导致工具栏被部分遮挡
 */

// Sidebar dimensions
export const SIDEBAR_WIDTH = 300; // Sidebar width in pixels
export const SIDEBAR_MARGIN = 16; // Sidebar margin in pixels
export const SIDEBAR_TOTAL_WIDTH = SIDEBAR_WIDTH + SIDEBAR_MARGIN; // Total space occupied by sidebar

// Collapsed sidebar dimensions
export const COLLAPSED_SIDEBAR_WIDTH = 12; // Collapsed sidebar width in pixels

// Layout calculations for different components
export const LAYOUT_WIDTHS = {
  // For main content area (using percentage-based calculation)
  MAIN_CONTENT_EXPANDED: `calc(100% - ${SIDEBAR_TOTAL_WIDTH}px)`,
  MAIN_CONTENT_COLLAPSED: `calc(100% - ${COLLAPSED_SIDEBAR_WIDTH}px)`,

  // For absolute positioned elements (using viewport-based calculation)
  ABSOLUTE_EXPANDED: `calc(100vw - ${SIDEBAR_TOTAL_WIDTH}px)`,
  ABSOLUTE_COLLAPSED: `calc(100vw - ${COLLAPSED_SIDEBAR_WIDTH}px)`,
} as const;

// Tailwind CSS classes for common width calculations
export const LAYOUT_CLASSES = {
  MAIN_CONTENT_EXPANDED: `w-[${LAYOUT_WIDTHS.MAIN_CONTENT_EXPANDED}]`,
  MAIN_CONTENT_COLLAPSED: `w-[${LAYOUT_WIDTHS.MAIN_CONTENT_COLLAPSED}]`,
  ABSOLUTE_EXPANDED: `w-[${LAYOUT_WIDTHS.ABSOLUTE_EXPANDED}]`,
  ABSOLUTE_COLLAPSED: `w-[${LAYOUT_WIDTHS.ABSOLUTE_COLLAPSED}]`,
} as const;

/**
 * Usage examples:
 *
 * For absolute positioned elements (like TopToolbar):
 * className={collapse ? `w-[${LAYOUT_WIDTHS.ABSOLUTE_COLLAPSED}]` : `w-[${LAYOUT_WIDTHS.ABSOLUTE_EXPANDED}]`}
 *
 * For main content areas:
 * style={{ width: showSider ? LAYOUT_WIDTHS.MAIN_CONTENT_EXPANDED : `calc(100% - ${COLLAPSED_SIDEBAR_WIDTH}px)` }}
 *
 * For sidebar components:
 * width={collapse ? 0 : SIDEBAR_WIDTH}
 */
