import React, { useState, useEffect } from 'react';
import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { McpServerJsonEditorProps } from './types';
import MonacoEditorComponent from '../../../modules/artifacts/code-runner/monaco-editor/MonacoEditorComponent';
import { CodeArtifactType } from '@refly/openapi-schema';

export const McpServerJsonEditor: React.FC<McpServerJsonEditorProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const [jsonString, setJsonString] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Convert value to JSON string
  useEffect(() => {
    try {
      setJsonString(JSON.stringify(value, null, 2));
      setError(null);
    } catch (_err) {
      setError(t('settings.mcpServer.jsonParseError'));
    }
  }, [value, t]);

  // Handle JSON changes
  const handleJsonChange = (newJsonString: string) => {
    setJsonString(newJsonString);
    try {
      const parsed = JSON.parse(newJsonString);
      setError(null);
      onChange(parsed);
    } catch (_err: any) {
      setError(t('settings.mcpServer.jsonParseError'));
    }
  };

  return (
    <div className="mcp-server-json-editor">
      {error && <Alert message={error} type="error" showIcon className="mb-4" />}
      <div style={{ height: '400px' }}>
        <MonacoEditorComponent
          content={jsonString}
          onChange={handleJsonChange}
          language="json"
          type={'application/refly.artifacts.code' as CodeArtifactType}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};
