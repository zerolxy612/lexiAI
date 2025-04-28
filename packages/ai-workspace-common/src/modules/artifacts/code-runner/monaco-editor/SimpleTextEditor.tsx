import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoEditorProps } from './types';

// Simple text editor for displaying content without syntax highlighting
// Used during content generation to improve performance
const SimpleTextEditor = ({
  content,
  onChange,
  readOnly,
  isGenerating,
  canvasReadOnly,
}: MonacoEditorProps) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value);
    },
    [onChange],
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {isGenerating && (
        <div className="bg-blue-50 text-blue-800 px-4 py-2 text-sm flex items-center">
          <div className="mr-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
          {t('codeArtifact.editor.generatingContent')}
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
        value={content}
        onChange={handleChange}
        readOnly={readOnly || isGenerating || canvasReadOnly}
        style={{
          minHeight: '460px',
          lineHeight: '1.5',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
        placeholder={isGenerating ? t('codeArtifact.editor.generatingPlaceholder') : ''}
      />
    </div>
  );
};

export default SimpleTextEditor;
