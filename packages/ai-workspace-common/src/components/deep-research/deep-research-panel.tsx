import React, { useState, useEffect, useCallback } from 'react';
import { Button, Steps, Spin, message } from 'antd';
import { IoClose } from 'react-icons/io5';
import { GlobalOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { cn } from '@refly/utils/cn';
import { useUserStoreShallow } from '../../stores/user';

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

// API response types
interface DeepResearchEvent {
  type: 'stage_start' | 'search_complete' | 'ai_response' | 'stage_complete' | 'complete' | 'error';
  stageData?: {
    stage: number;
    stageName: string;
    searchQuery: string;
    searchResults: SearchResult[];
    aiContent: string;
    timestamp: string;
  };
  content?: string;
  error?: string;
  progress?: {
    currentStage: number;
    totalStages: number;
    percentage: number;
  };
}

// Initial stages structure
const initialStages: DeepResearchStage[] = [
  {
    title: 'Basic Analysis',
    content: '',
    searchResults: [],
    status: 'waiting',
  },
  {
    title: 'Extended Analysis',
    content: '',
    searchResults: [],
    status: 'waiting',
  },
  {
    title: 'Deep Analysis',
    content: '',
    searchResults: [],
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
          {stage.content && (
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
              {stage.content}
            </p>
          )}

          {stage.status === 'completed' && stage.searchResults.length > 0 && (
            <SearchResultsSection results={stage.searchResults} />
          )}

          {stage.status === 'loading' && (
            <div className="flex items-center gap-2 text-gray-500">
              <Spin size="small" />
              <span className="text-sm">Processing...</span>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

export const DeepResearchPanel: React.FC<DeepResearchPanelProps> = ({ isOpen, onClose, query }) => {
  const [stages, setStages] = useState<DeepResearchStage[]>(initialStages);
  const [currentStage, setCurrentStage] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user token for API authentication
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  // Call real API when panel opens
  useEffect(() => {
    if (!isOpen) {
      // Reset when panel closes
      setStages(initialStages);
      setCurrentStage(-1);
      setIsProcessing(false);
      setError(null);
      return;
    }

    if (!query.trim()) {
      setError('Query is required');
      return;
    }

    // Start real API call
    startDeepResearch();
  }, [isOpen, query]);

  const startDeepResearch = useCallback(async () => {
    if (!query?.trim()) {
      console.error('❌ No query provided for deep research');
      return;
    }

    console.log('🚀 Starting deep research for query:', query);
    setStages([
      { title: 'Stage 1: Basic Analysis', content: '', searchResults: [], status: 'loading' },
      { title: 'Stage 2: Extended Analysis', content: '', searchResults: [], status: 'waiting' },
      { title: 'Stage 3: Deep Analysis', content: '', searchResults: [], status: 'waiting' },
    ]);

    try {
      // Check if we're in development environment
      const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';

      // Prepare headers - skip token in development
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Only add Authorization header in production
      if (!isDev) {
        // Try to get token from cookie first, then localStorage
        const getCookie = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
          return null;
        };

        const token = getCookie('_rf_access') || localStorage.getItem('access_token');
        if (!token) {
          throw new Error('Authentication token not found');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log(
        '🔧 API call headers:',
        isDev ? 'Development mode - no auth' : 'Production mode - with auth',
      );

      // Make API call to deep-research endpoint
      const response = await fetch('http://localhost:5800/api/v1/deep-research/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: query.trim(),
          search: true,
          messages: [],
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      console.log('✅ API call successful, processing stream...');

      // Process Server-Sent Events stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('🏁 Stream completed');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData: DeepResearchEvent = JSON.parse(line.substring(6));
              console.log('📨 Received event:', eventData.type, eventData);

              handleStreamEvent(eventData);
            } catch (parseError) {
              console.warn('Failed to parse event data:', line, parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Deep research API error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      message.error('Failed to start deep research');
    } finally {
      setIsProcessing(false);
    }
  }, [query]);

  const handleStreamEvent = (event: DeepResearchEvent) => {
    switch (event.type) {
      case 'stage_start':
        if (event.stageData) {
          console.log(`🎬 Stage ${event.stageData.stage} started: ${event.stageData.stageName}`);
          setCurrentStage(event.stageData.stage);
          setStages((prev) =>
            prev.map((stage, index) =>
              index === event.stageData!.stage ? { ...stage, status: 'loading' } : stage,
            ),
          );
        }
        break;

      case 'search_complete':
        if (event.stageData) {
          console.log(
            `🔍 Search completed for stage ${event.stageData.stage}:`,
            event.stageData.searchResults.length,
            'results',
          );
          setStages((prev) =>
            prev.map((stage, index) =>
              index === event.stageData!.stage
                ? { ...stage, searchResults: event.stageData!.searchResults }
                : stage,
            ),
          );
        }
        break;

      case 'ai_response':
        if (event.content) {
          console.log(`🤖 AI response received:`, event.content.substring(0, 100) + '...');
          // Update content for current stage
          setStages((prev) =>
            prev.map((stage, index) =>
              index === currentStage ? { ...stage, content: event.content! } : stage,
            ),
          );
        }
        break;

      case 'stage_complete':
        if (event.stageData) {
          console.log(`✅ Stage ${event.stageData.stage} completed`);
          setStages((prev) =>
            prev.map((stage, index) =>
              index === event.stageData!.stage
                ? {
                    ...stage,
                    status: 'completed',
                    content: event.stageData!.aiContent,
                    searchResults: event.stageData!.searchResults,
                  }
                : stage,
            ),
          );
        }
        break;

      case 'complete':
        console.log('🎉 All stages completed!');
        setCurrentStage(-1);
        break;

      case 'error':
        console.error('❌ Stream error:', event.error);
        setError(event.error || 'Unknown error occurred');
        break;

      default:
        console.log('📝 Unhandled event type:', event.type);
    }
  };

  const handleCopy = () => {
    const allContent = stages
      .filter((stage) => stage.status === 'completed')
      .map((stage) => `${stage.title}\n${stage.content}`)
      .join('\n\n');

    navigator.clipboard.writeText(allContent);
    message.success('Content copied to clipboard');
  };

  const handleDownload = () => {
    const allContent = stages
      .filter((stage) => stage.status === 'completed')
      .map((stage) => `${stage.title}\n${stage.content}`)
      .join('\n\n');

    const blob = new Blob([allContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deep-research-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Content downloaded');
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
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
                  disabled={!stages.some((stage) => stage.status === 'completed')}
                >
                  Copy
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  disabled={!stages.some((stage) => stage.status === 'completed')}
                >
                  Download
                </Button>
                <Button type="text" size="small" icon={<IoClose />} onClick={onClose} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">Error: {error}</p>
                </div>
              )}

              {isProcessing && currentStage === -1 && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Spin size="large" />
                    <p className="mt-2 text-gray-500">Initializing deep research...</p>
                  </div>
                </div>
              )}

              {stages.map((stage, index) => (
                <StageContent key={index} stage={stage} index={index} />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};
