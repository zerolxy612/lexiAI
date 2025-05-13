import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownMode } from '../../types';
import { ToolOutlined } from '@ant-design/icons';

// SVG icons for the component
const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-[18px] h-[18px] text-green-500"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

interface MCPCallProps {
  'data-tool-name'?: string;
  'data-tool-arguments'?: string;
  'data-tool-result'?: string;
  'data-tool-type'?: 'use' | 'result';
  id?: string;
  mode?: MarkdownMode;
}

/**
 * MCPCall component renders tool_use and tool_use_result tags as collapsible panels
 * similar to the Cursor MCP UI seen in the screenshot
 */
const MCPCall: React.FC<MCPCallProps> = (props) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Extract tool name from props
  const toolName = useMemo(() => props['data-tool-name'] || 'unknown', [props]);

  // Format the content for parameters
  const parametersContent = useMemo(() => {
    try {
      const argsStr = props['data-tool-arguments'] || '{}';
      const args = JSON.parse(argsStr);
      return Object.keys(args).length
        ? JSON.stringify(args, null, 2)
        : t('components.markdown.noParameters', 'No parameters');
    } catch (_e) {
      return props['data-tool-arguments'] || t('components.markdown.noParameters', 'No parameters');
    }
  }, [props, t]);

  // Format the content for result
  const resultContent = useMemo(() => props['data-tool-result'] || '', [props]);

  // Check if result exists
  const hasResult = !!resultContent;

  return (
    <div className="my-3 rounded-lg border border-[#23272F] overflow-hidden bg-[#181A20] text-white font-mono">
      {/* Header bar */}
      <div
        className="flex items-center px-4 py-2 cursor-pointer select-none bg-[#181A20] min-h-[44px]"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {/* ToolOutlined now serves as the toggle icon with rotation */}
        <ToolOutlined
          style={{
            color: '#A1A1AA',
            fontSize: '16px',
            marginRight: '12px', // Adjusted margin for spacing
            transition: 'transform 0.2s ease-in-out',
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        />
        {/* Tool name displayed as the main text in the header */}
        <div className="flex-1 text-[15px] font-medium tracking-tight text-white">{toolName}</div>
        {/* Check icon for results, with adjusted margin */}
        {hasResult && (
          <span className="ml-2 flex items-center">
            {' '}
            {/* Adjusted margin from ml-1 to ml-2 */}
            <CheckIcon />
          </span>
        )}
      </div>

      {/* Content section */}
      {!isCollapsed && (
        <div className="border-t border-[#23272F] bg-[#181A20] py-2">
          {/* Parameters section always shown */}
          <div>
            <div className="px-5 py-1 text-[#A1A1AA] text-[13px] border-b border-[#23272F] font-normal">
              {t('components.markdown.parameters', 'Parameters:')}
            </div>
            {/* Parameter content block with background, rounded corners, margin and padding */}
            <div className="mx-4 my-2 rounded-md bg-[#23272F] px-4 py-3 font-mono text-[15px] font-normal whitespace-pre-wrap text-[#F4F4F5] leading-[22px]">
              {parametersContent}
            </div>
          </div>
          {/* Result section only if hasResult */}
          {hasResult && (
            <div>
              <div className="px-5 py-1 text-[#A1A1AA] text-[13px] border-b border-[#23272F] font-normal">
                {t('components.markdown.result', 'Result:')}
              </div>
              {/* Result content block with background, rounded corners, margin and padding */}
              <div className="mx-4 my-2 rounded-md bg-[#23272F] px-4 py-3 font-mono text-[15px] font-normal whitespace-pre-wrap text-[#F4F4F5] leading-[22px]">
                {resultContent}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(MCPCall);
