import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownMode } from '../../types';

// SVG icons for the component
const ChevronDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5 text-green-500"
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Extract tool name from props
  const toolName = useMemo(() => props['data-tool-name'] || 'unknown', [props]);

  // Determine if this is a tool use or result component
  const isToolUse = useMemo(() => props['data-tool-type'] === 'use', [props]);

  // Format the content based on whether this is a tool use or result
  const content = useMemo(() => {
    if (isToolUse) {
      try {
        // Try to parse JSON arguments if present
        const argsStr = props['data-tool-arguments'] || '{}';
        const args = JSON.parse(argsStr);
        return Object.keys(args).length
          ? JSON.stringify(args, null, 2)
          : t('components.markdown.noParameters', 'No parameters');
      } catch (_e) {
        return (
          props['data-tool-arguments'] || t('components.markdown.noParameters', 'No parameters')
        );
      }
    } else {
      return props['data-tool-result'] || '';
    }
  }, [props, isToolUse, t]);

  return (
    <div className="my-4 rounded-lg border border-gray-700 overflow-hidden bg-gray-900 text-white">
      {/* Header bar */}
      <div
        className="flex items-center p-3 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="mr-2 text-gray-400">
          <ChevronDownIcon />
        </div>
        <div className="flex-1 font-medium">
          {isToolUse
            ? t('components.markdown.calledMCPTool', 'Called MCP tool')
            : t('components.markdown.result', 'Result')}
        </div>
        <div className="mx-2 px-3 py-1 bg-gray-800 rounded text-sm font-mono">{toolName}</div>
        {!isToolUse && <CheckIcon />}
      </div>

      {/* Content section */}
      {!isCollapsed && (
        <div className="border-t border-gray-700">
          {isToolUse ? (
            <div>
              <div className="px-5 py-3 text-gray-400 border-b border-gray-800">
                {t('components.markdown.parameters', 'Parameters:')}
              </div>
              <div className="p-5 font-mono text-sm whitespace-pre-wrap">{content}</div>
            </div>
          ) : (
            <div>
              <div className="px-5 py-3 text-gray-400 border-b border-gray-800">
                {t('components.markdown.result', 'Result:')}
              </div>
              <div className="p-5 font-mono text-sm whitespace-pre-wrap">{content}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(MCPCall);
