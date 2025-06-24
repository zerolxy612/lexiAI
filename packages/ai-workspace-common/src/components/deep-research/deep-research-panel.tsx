import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spin, message } from 'antd';
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
  status: 'waiting' | 'searching' | 'search_complete' | 'ai_processing' | 'completed';
  isSearching?: boolean;
  isAiProcessing?: boolean;
}

interface DeepResearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
}

// API response types
interface DeepResearchEvent {
  type: 'stage_start' | 'search_complete' | 'ai_response' | 'stage_complete' | 'complete' | 'error';
  stage?: number; // Add stage field for ai_response events
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
  { title: 'Stage 1: Basic Analysis', content: '', searchResults: [], status: 'waiting' },
  { title: 'Stage 2: Extended Analysis', content: '', searchResults: [], status: 'waiting' },
  { title: 'Stage 3: Deep Analysis', content: '', searchResults: [], status: 'waiting' },
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
    <div className="flex items-center gap-3 mb-4">
      {/* Stage Status Icon */}
      <div className="flex items-center gap-2">
        {stage.status === 'searching' ? (
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <Spin size="small" className="text-white" />
          </div>
        ) : stage.status === 'search_complete' ? (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        ) : stage.status === 'ai_processing' ? (
          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
            <Spin size="small" className="text-white" />
          </div>
        ) : stage.status === 'completed' ? (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        ) : (
          <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 text-xs">{index + 1}</span>
          </div>
        )}

        {/* Stage Title */}
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{stage.title}</h3>
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-2 ml-auto">
        {stage.status === 'searching' && (
          <span className="text-xs text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded-full flex items-center gap-1">
            <Spin size="small" />
            Searching...
          </span>
        )}
        {stage.status === 'search_complete' && (
          <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">
            Search Complete
          </span>
        )}
        {stage.status === 'ai_processing' && (
          <span className="text-xs text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded-full flex items-center gap-1">
            <Spin size="small" />
            AI Processing...
          </span>
        )}
        {stage.status === 'completed' && (
          <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">
            Completed
          </span>
        )}
      </div>
    </div>

    {/* Stage Content - Show content as soon as we have search results or AI content */}
    {stage.status !== 'waiting' && (
      <div className="ml-8 space-y-4">
        {/* Search Results Section - Show immediately when available */}
        {stage.searchResults.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">🔍</span>
              </div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Search Results
              </span>
              <span className="text-xs text-blue-500 bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">
                {stage.searchResults.length} results
              </span>
            </div>
            <SearchResultsSection results={stage.searchResults} />
          </div>
        )}

        {/* AI Content Section - Show as it streams in */}
        {(stage.content || stage.status === 'ai_processing') && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">🤖</span>
              </div>
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                AI Analysis
              </span>
              {stage.status === 'ai_processing' && (
                <span className="text-xs text-purple-500 bg-purple-100 dark:bg-purple-800 px-2 py-1 rounded flex items-center gap-1">
                  <Spin size="small" />
                  Generating...
                </span>
              )}
              {stage.status === 'completed' && stage.content && (
                <span className="text-xs text-green-500 bg-green-100 dark:bg-green-800 px-2 py-1 rounded">
                  {stage.content.length} characters
                </span>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              {stage.content ? (
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {stage.content}
                  {stage.status === 'ai_processing' && (
                    <span className="inline-block w-2 h-4 bg-purple-500 ml-1 animate-pulse"></span>
                  )}
                </p>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <Spin size="small" />
                  <span className="text-sm">Generating AI analysis...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading states for different phases */}
        {stage.status === 'searching' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-600">
              <Spin size="small" />
              <span className="text-sm">Searching for relevant information...</span>
            </div>
          </div>
        )}
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
    setIsProcessing(true);
    setError(null);
    setCurrentStage(-1);

    // Initialize stages with waiting status
    setStages([
      { title: 'Stage 1: Basic Analysis', content: '', searchResults: [], status: 'waiting' },
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
              index === event.stageData!.stage ? { ...stage, status: 'searching' } : stage,
            ),
          );
        }
        break;

      case 'search_complete':
        if (event.stageData) {
          console.log(
            `🔍 Search completed for stage ${event.stageData.stage}, switching to AI processing.`,
            event.stageData.searchResults.length,
            'results',
          );
          setStages((prev) =>
            prev.map((stage, index) =>
              index === event.stageData!.stage
                ? {
                    ...stage,
                    status: 'ai_processing',
                    searchResults: event.stageData!.searchResults,
                  }
                : stage,
            ),
          );
        }
        break;

      case 'ai_response':
        if (event.content) {
          console.log(`🤖 AI response received:`, event.content.substring(0, 100) + '...');
          // Use stage from event data, not currentStage variable
          const targetStage = event.stage ?? currentStage;
          console.log(`🎯 Updating content for stage ${targetStage}`);
          setStages((prev) =>
            prev.map((stage, index) =>
              index === targetStage
                ? {
                    ...stage,
                    status: 'ai_processing',
                    content: (stage.content || '') + event.content!,
                  }
                : stage,
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
        setIsProcessing(false);
        console.log('🎉 All stages completed!');
        setCurrentStage(-1);
        break;

      case 'error':
        setIsProcessing(false);
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

              {/* Overall Progress Indicator */}
              {isProcessing && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Spin size="small" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Deep Research in Progress
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-blue-100 dark:bg-blue-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(stages.filter((s) => s.status === 'completed').length / stages.length) * 100}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 mt-2">
                    <span>
                      {stages.filter((s) => s.status === 'completed').length} of {stages.length}{' '}
                      stages completed
                    </span>
                    <span>
                      {Math.round(
                        (stages.filter((s) => s.status === 'completed').length / stages.length) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                </div>
              )}

              {/* Show initial loading only when no stages have started */}
              {isProcessing &&
                currentStage === -1 &&
                stages.every((s) => s.status === 'waiting') && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Spin size="large" />
                      <p className="mt-2 text-gray-500">Initializing deep research...</p>
                    </div>
                  </div>
                )}

              {/* Render all stages */}
              {stages.map((stage, index) => (
                <StageContent key={index} stage={stage} index={index} />
              ))}

              {/* Completion Message */}
              {!isProcessing && stages.every((s) => s.status === 'completed') && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="font-medium">Deep research completed successfully!</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    All {stages.length} stages have been processed. You can now copy or download the
                    results.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
