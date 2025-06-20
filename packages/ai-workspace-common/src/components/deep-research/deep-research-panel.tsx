import React, { useState, useEffect } from 'react';
import { Button, Steps, Spin } from 'antd';
import { IoClose } from 'react-icons/io5';
import { GlobalOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { cn } from '@refly/utils/cn';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface DeepResearchStage {
  title: string;
  content: string;
  searchResults: SearchResult[];
  status: 'waiting' | 'loading' | 'completed';
}

interface DeepResearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
}

// Mock data for the three stages
const mockStages: DeepResearchStage[] = [
  {
    title: 'Basic Analysis',
    content:
      'This is the first stage of analysis providing fundamental insights about the topic...',
    searchResults: [
      {
        title: 'Example Site 1',
        link: 'https://example1.com',
        snippet: 'Basic information about...',
      },
      { title: 'Example Site 2', link: 'https://example2.com', snippet: 'Fundamental concepts...' },
      { title: 'Example Site 3', link: 'https://example3.com', snippet: 'Core principles...' },
    ],
    status: 'waiting',
  },
  {
    title: 'Extended Analysis',
    content:
      'This is the second stage providing more comprehensive analysis with broader context...',
    searchResults: [
      {
        title: 'Extended Source 1',
        link: 'https://extended1.com',
        snippet: 'Comprehensive overview...',
      },
      {
        title: 'Extended Source 2',
        link: 'https://extended2.com',
        snippet: 'Detailed analysis...',
      },
      { title: 'Extended Source 3', link: 'https://extended3.com', snippet: 'Broader context...' },
    ],
    status: 'waiting',
  },
  {
    title: 'Deep Analysis',
    content: 'This is the final stage offering deep insights and comprehensive understanding...',
    searchResults: [
      { title: 'Deep Research 1', link: 'https://deep1.com', snippet: 'In-depth analysis...' },
      { title: 'Deep Research 2', link: 'https://deep2.com', snippet: 'Comprehensive insights...' },
      { title: 'Deep Research 3', link: 'https://deep3.com', snippet: 'Expert perspectives...' },
    ],
    status: 'waiting',
  },
];

const SearchResultsSection: React.FC<{ results: SearchResult[] }> = ({ results }) => (
  <div className="mt-4">
    <div className="flex items-center gap-2 mb-3">
      <GlobalOutlined className="text-blue-500" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Researching websites
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {results.map((result, index) => (
        <a
          key={index}
          href={result.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 
                     dark:bg-gray-800 dark:hover:bg-gray-700 
                     rounded-lg border border-gray-200 dark:border-gray-600
                     transition-colors duration-200 text-xs"
          title={result.snippet}
        >
          <GlobalOutlined className="text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-300 truncate">
            {result.link.replace(/^https?:\/\//, '').split('/')[0]}
          </span>
        </a>
      ))}
    </div>
  </div>
);

const StageContent: React.FC<{ stage: DeepResearchStage; index: number }> = ({ stage, index }) => (
  <div className="mb-6">
    {/* Stage Header */}
    <div className="flex items-center gap-2 mb-3">
      {stage.status === 'loading' ? (
        <Spin size="small" />
      ) : stage.status === 'completed' ? (
        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      ) : (
        <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
          <span className="text-gray-600 text-xs">{index + 1}</span>
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{stage.title}</h3>
    </div>

    {/* Stage Content */}
    {(stage.status === 'completed' || stage.status === 'loading') && (
      <div className="ml-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            {stage.content}
          </p>

          {stage.status === 'completed' && <SearchResultsSection results={stage.searchResults} />}
        </div>
      </div>
    )}
  </div>
);

export const DeepResearchPanel: React.FC<DeepResearchPanelProps> = ({ isOpen, onClose, query }) => {
  const [stages, setStages] = useState<DeepResearchStage[]>(mockStages);
  const [currentStage, setCurrentStage] = useState(-1);

  // Simulate the three-stage research process
  useEffect(() => {
    if (!isOpen) {
      // Reset when panel closes
      setStages(mockStages.map((stage) => ({ ...stage, status: 'waiting' })));
      setCurrentStage(-1);
      return;
    }

    // Start the simulation
    const runStageSimulation = async () => {
      for (let i = 0; i < stages.length; i++) {
        setCurrentStage(i);

        // Set current stage to loading
        setStages((prev) =>
          prev.map((stage, index) => (index === i ? { ...stage, status: 'loading' } : stage)),
        );

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));

        // Set current stage to completed
        setStages((prev) =>
          prev.map((stage, index) => (index === i ? { ...stage, status: 'completed' } : stage)),
        );

        // Small delay before next stage
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    };

    runStageSimulation();
  }, [isOpen]);

  const handleCopy = () => {
    const allContent = stages
      .filter((stage) => stage.status === 'completed')
      .map((stage) => `${stage.title}\n${stage.content}`)
      .join('\n\n');

    navigator.clipboard.writeText(allContent);
  };

  const handleDownload = () => {
    // TODO: Implement PDF download functionality
    console.log('Download functionality to be implemented');
  };

  return (
    <>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              'fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300',
              isOpen ? 'opacity-100' : 'opacity-0',
            )}
            onClick={onClose}
          />

          {/* Panel */}
          <div
            className={cn(
              'fixed right-0 top-0 h-full w-1/2 min-w-[600px] bg-white dark:bg-gray-900',
              'shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out',
              isOpen ? 'translate-x-0' : 'translate-x-full',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {query}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Deep Research Analysis</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  className="text-gray-500 hover:text-gray-700"
                  size="small"
                />
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
                  className="text-gray-500 hover:text-gray-700"
                  size="small"
                />
                <Button
                  type="text"
                  icon={<IoClose />}
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700"
                  size="small"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-full">
                {stages.map((stage, index) => (
                  <StageContent key={index} stage={stage} index={index} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
