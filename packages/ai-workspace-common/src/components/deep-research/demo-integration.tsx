import React, { memo, useCallback } from 'react';
import { Button, Input, Space } from 'antd';
import { DeepResearchWrapper } from '../canvas/launchpad/deep-research-wrapper';

const DemoIntegration = memo(() => {
  const [query, setQuery] = React.useState('');

  const handleTrigger = useCallback(() => {
    if ((window as any).triggerDeepResearch) {
      (window as any).triggerDeepResearch(query);
    } else {
      console.error('Deep research trigger not available');
    }
  }, [query]);

  return (
    <DeepResearchWrapper
      onTrigger={(query) => {
        console.log('🎯 Demo integration triggered with:', query);
      }}
    >
      <div className="p-4 border rounded-lg bg-white">
        <h3 className="text-lg font-semibold mb-4">Deep Research Demo</h3>
        <Space direction="vertical" size="middle" className="w-full">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入你的问题..."
            className="w-full"
          />
          <Button type="primary" onClick={handleTrigger} disabled={!query.trim()}>
            触发三段检索
          </Button>
        </Space>
      </div>
    </DeepResearchWrapper>
  );
});

DemoIntegration.displayName = 'DemoIntegration';

export { DemoIntegration };
