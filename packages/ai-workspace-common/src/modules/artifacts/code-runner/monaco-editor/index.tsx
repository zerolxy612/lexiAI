import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import { Button } from 'antd';
import { CodeArtifactType } from '@refly/openapi-schema';
import debounce from 'lodash.debounce';
import { useTranslation } from 'react-i18next';
import './index.scss';

// Function to map CodeArtifactType to appropriate Monaco editor language
const getLanguageFromType = (type: CodeArtifactType, language: string): string => {
  const languageMap: Record<string, string> = {
    'application/refly.artifacts.react': 'typescript',
    'image/svg+xml': 'xml',
    'application/refly.artifacts.mermaid': 'markdown',
    'text/markdown': 'markdown',
    'application/refly.artifacts.code': language,
    'text/html': 'html',
    'application/refly.artifacts.mindmap': 'json',
  };

  return languageMap[type] ?? language;
};

// Primary CDN URL
// Fallback CDN URL #1
const PRIMARY_CDN = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.41.0/min/vs'; // Use older version that's more stable
// Fallback CDN URL #2
const FALLBACK_CDN2 = 'https://cdn.bootcdn.net/ajax/libs/monaco-editor/0.36.1/min/vs'; // Alternative CDN
// Fallback CDN URL #3
const FALLBACK_CDN3 = 'https://unpkg.com/monaco-editor@0.30.1/min/vs'; // Last resort CDN

// Monaco loading has issues in some network environments, so use feature detection
const isBrowserEnv = typeof window !== 'undefined';

// Configure Monaco loader with timeout option
if (isBrowserEnv) {
  try {
    // Set up feature detection for loader
    loader.config({
      paths: {
        vs: PRIMARY_CDN,
      },
      // Fix for language bundle loading issues
      'vs/nls': {
        availableLanguages: {},
      },
    });
  } catch (error) {
    console.error('Failed to configure Monaco loader:', error);
  }
}

interface MonacoEditorProps {
  content: string;
  language: string;
  type: CodeArtifactType;
  readOnly?: boolean;
  isGenerating?: boolean;
  canvasReadOnly?: boolean;
  onChange?: (value: string) => void;
}

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

// Fallback editor when Monaco fails to load - styled for code display
const FallbackEditor = ({
  content,
  onChange,
  readOnly,
  isGenerating,
  canvasReadOnly,
  language,
}: MonacoEditorProps) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value);
    },
    [onChange],
  );

  // Apply minimal syntax highlighting
  const getHighlightClass = () => {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 'bg-gray-50 text-blue-800';
      case 'html':
        return 'bg-gray-50 text-red-800';
      case 'css':
        return 'bg-gray-50 text-purple-800';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <div className="h-full flex flex-col border border-gray-200 rounded">
      <div className="bg-blue-50 text-blue-800 px-4 py-2 text-sm flex items-center justify-between border-b border-gray-200">
        <span>{t('codeArtifact.editor.fallbackMode')}</span>
        <span className="text-xs px-2 py-1 bg-blue-100 rounded">{language}</span>
      </div>
      <textarea
        ref={textareaRef}
        className={`w-full h-full p-4 font-mono text-sm border-0 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 ${getHighlightClass()}`}
        value={content}
        onChange={handleChange}
        readOnly={readOnly || isGenerating || canvasReadOnly}
        style={{
          minHeight: '460px',
          lineHeight: '1.6',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
        spellCheck="false"
      />
    </div>
  );
};

const MAX_LOAD_ATTEMPTS = 4; // Max number of CDN fallback attempts

const MonacoEditor = React.memo(
  ({
    content,
    language,
    type,
    readOnly = false,
    isGenerating = false,
    canvasReadOnly = false,
    onChange,
  }: MonacoEditorProps) => {
    const { t } = useTranslation();
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const [isEditorReady, setIsEditorReady] = useState(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [useFallbackEditor, setUseFallbackEditor] = useState(false);

    // Get current CDN based on load attempt
    const getCurrentCDN = useCallback(() => {
      switch (loadAttempt) {
        case 0:
          return PRIMARY_CDN;
        case 1:
          return FALLBACK_CDN2;
        case 2:
          return FALLBACK_CDN3;
        default:
          return PRIMARY_CDN;
      }
    }, [loadAttempt]);

    // Use simple editor during generation to improve performance
    // Skip complex Monaco initialization & syntax highlighting while content is changing rapidly
    if (isGenerating) {
      return (
        <div className="h-full" style={{ minHeight: '500px' }}>
          <SimpleTextEditor
            content={content}
            language={language}
            type={type}
            readOnly={readOnly}
            isGenerating={isGenerating}
            canvasReadOnly={canvasReadOnly}
            onChange={onChange}
          />
        </div>
      );
    }

    // Switch CDN when current one fails
    useEffect(() => {
      // Skip if we're using the fallback editor already
      if (useFallbackEditor) return;

      const currentCDN = getCurrentCDN();

      // Try another CDN if we have more attempts
      if (loadAttempt > 0 && loadAttempt < MAX_LOAD_ATTEMPTS) {
        console.log(`Trying alternative Monaco CDN (attempt ${loadAttempt}): ${currentCDN}`);

        // Configure loader with new CDN
        try {
          loader.config({
            paths: {
              vs: currentCDN,
            },
            'vs/nls': {
              availableLanguages: {},
            },
          });
        } catch (error) {
          console.error('Failed to reconfigure Monaco loader:', error);
          // If we can't even reconfigure, move to next attempt
          if (loadAttempt < MAX_LOAD_ATTEMPTS - 1) {
            setLoadAttempt(loadAttempt + 1);
          } else {
            // Last attempt failed, use fallback editor
            setUseFallbackEditor(true);
            setLoadingError('Failed to load editor after multiple attempts');
          }
        }
      }

      // If we've reached max attempts, use fallback editor
      if (loadAttempt >= MAX_LOAD_ATTEMPTS - 1) {
        setUseFallbackEditor(true);
        setLoadingError('Failed to load editor after multiple attempts');
      }
    }, [loadAttempt, useFallbackEditor, getCurrentCDN]);

    // Debounced onChange handler to prevent too frequent updates
    const debouncedOnChange = useMemo(
      () =>
        debounce((value: string | undefined) => {
          if (value !== undefined) {
            onChange?.(value);
          }
        }, 300),
      [onChange],
    );

    // Handle content changes from editor
    const handleEditorChange = useCallback(
      (value: string | undefined) => {
        debouncedOnChange(value);
      },
      [debouncedOnChange],
    );

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedOnChange.cancel();
      };
    }, [debouncedOnChange]);

    // Configure editor when it's mounted
    const handleEditorDidMount = useCallback((editor: any, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      try {
        // Configure TypeScript and other languages
        if (monaco.languages.typescript) {
          monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.Latest,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            esModuleInterop: true,
            jsx: monaco.languages.typescript.JsxEmit.React,
            reactNamespace: 'React',
            allowJs: true,
          });

          // Disable some TypeScript validations for better performance
          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false,
          });
        }

        // Set editor options
        editor.updateOptions({
          tabSize: 2,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          // Performance related options
          renderWhitespace: 'none',
          renderControlCharacters: false,
          renderIndentGuides: false,
          renderValidationDecorations: 'editable',
          // Reduce the frequency of rendering
          renderFinalNewline: false,
          // Disable some features for better performance
          quickSuggestions: false,
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          wordBasedSuggestions: false,
          folding: false,
          // Enable lazy loading of content
          largeFileOptimizations: true,
          // Reduce the max tokenization line length
          maxTokenizationLineLength: 2000,
        });

        setIsEditorReady(true);
        setLoadingError(null);
      } catch (error) {
        console.error('Error configuring Monaco editor:', error);
        setLoadingError((error as Error).message);
      }
    }, []);

    // Configure Monaco instance before mounting
    const handleEditorWillMount = useCallback((monaco: Monaco) => {
      try {
        monaco.editor.defineTheme('github-custom', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '008000' },
            { token: 'keyword', foreground: '0000FF' },
            { token: 'string', foreground: 'A31515' },
            { token: 'number', foreground: '098658' },
            { token: 'regexp', foreground: '800000' },
          ],
          colors: {
            'editor.foreground': '#000000',
            'editor.background': '#ffffff',
            'editor.selectionBackground': '#b3d4fc',
            'editor.lineHighlightBackground': '#f5f5f5',
            'editorCursor.foreground': '#000000',
            'editorWhitespace.foreground': '#d3d3d3',
          },
        });
      } catch (error) {
        console.error('Error defining Monaco theme:', error);
      }
    }, []);

    // Handle editor loading errors
    const handleEditorError = useCallback(
      (error: Error) => {
        const currentCDN = getCurrentCDN();
        console.error(`Monaco editor loading failed from ${currentCDN}:`, error);

        if (loadAttempt < MAX_LOAD_ATTEMPTS - 1) {
          // Try next CDN
          setLoadAttempt(loadAttempt + 1);
        } else {
          // All CDNs failed, use fallback editor
          setUseFallbackEditor(true);
          setLoadingError(`Failed to load editor: ${error.message}`);
        }
      },
      [loadAttempt, getCurrentCDN],
    );

    // Update editor content when prop changes
    useEffect(() => {
      if (isEditorReady && editorRef.current) {
        try {
          const model = editorRef.current.getModel();
          if (model && model.getValue() !== content) {
            // Use setValue instead of setValueUnflushed for more compatibility
            model.setValue?.(content);
          }
        } catch (error) {
          console.error('Error updating editor content:', error);
        }
      }
    }, [content, isEditorReady]);

    // If we've exhausted all fallbacks and need to use the textarea
    if (useFallbackEditor) {
      return (
        <div className="h-full" style={{ minHeight: '500px' }}>
          <FallbackEditor
            content={content}
            language={language}
            type={type}
            readOnly={readOnly}
            isGenerating={isGenerating}
            canvasReadOnly={canvasReadOnly}
            onChange={onChange}
          />
        </div>
      );
    }

    // Handle fallback logic when Editor can't be loaded
    if (loadingError) {
      return (
        <div className="h-full" style={{ minHeight: '500px' }}>
          <div className="h-full flex items-center justify-center bg-gray-50 text-gray-700 p-4 rounded border border-gray-200">
            <div className="text-center">
              <p className="mb-2 font-medium">{t('codeArtifact.editor.loadError')}</p>
              <p className="text-sm text-gray-500">{loadingError}</p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  onClick={() => window.location.reload()}
                >
                  {t('common.refresh')}
                </Button>
                <Button
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                  onClick={() => setUseFallbackEditor(true)}
                >
                  {t('codeArtifact.editor.useFallback')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Create editor props with the onError handler
    const editorProps = {
      height: '100%',
      value: content,
      className: 'refly-code-editor',
      onChange: handleEditorChange,
      language: getLanguageFromType(type, language),
      beforeMount: handleEditorWillMount,
      onMount: handleEditorDidMount,
      loading: (
        <div className="text-gray-500 flex items-center justify-center h-full">
          {t('codeArtifact.editor.loading')}
        </div>
      ),
      options: {
        automaticLayout: true,
        minimap: {
          enabled: false, // Disable minimap for better performance
        },
        scrollBeyondLastLine: false,
        fontSize: 14,
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontLigatures: true,
        lineNumbers: 'on',
        renderLineHighlight: 'none',
        readOnly: readOnly || canvasReadOnly,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          alwaysConsumeMouseWheel: false,
          useShadows: false, // Remove scrollbar shadows for cleaner look
        },
        // Performance optimizations
        formatOnPaste: false,
        formatOnType: false,
        autoIndent: 'none',
        colorDecorators: false,
        // Reduce editor features for better performance
        occurrencesHighlight: 'off',
        selectionHighlight: false,
        // Enable virtual rendering
        fixedOverflowWidgets: true,
        // Disable unnecessary features
        links: false,
        hover: {
          enabled: false,
        },
        // Improve scrolling performance
        smoothScrolling: false,
        mouseWheelScrollSensitivity: 1.5,
        fastScrollSensitivity: 7,
      },
      theme: 'github-custom',
      onError: handleEditorError,
    };

    // Return the editor with container styles that prevent double scrollbars
    return (
      <div className="h-full overflow-hidden" style={{ minHeight: '500px' }}>
        {/* Use type assertion to work around type issues with onError prop */}
        {React.createElement(Editor, editorProps as any)}
      </div>
    );
  },
);

export default MonacoEditor;
