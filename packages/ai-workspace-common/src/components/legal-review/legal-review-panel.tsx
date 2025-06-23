import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spin, message } from 'antd';
import { IoClose } from 'react-icons/io5';
import { GlobalOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { cn } from '@refly/utils/cn';
import { useUserStoreShallow } from '../../stores/user';
import { VscLaw } from 'react-icons/vsc';

interface AnalysisResult {
  title: string;
  link: string;
  snippet: string;
}

interface LegalAnalysisStage {
  title: string;
  content: string;
  analysisResults: AnalysisResult[];
  status: 'waiting' | 'loading' | 'completed';
}

interface LegalReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
}

// API response types
interface LegalReviewEvent {
  type:
    | 'stage_start'
    | 'analysis_complete'
    | 'ai_response'
    | 'stage_complete'
    | 'complete'
    | 'error';
  stageData?: {
    stage: number;
    stageName: string;
    searchQuery: string;
    analysisResults: AnalysisResult[];
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
const initialStages: LegalAnalysisStage[] = [
  {
    title: 'Identifying Key Clauses',
    content: '',
    analysisResults: [],
    status: 'waiting',
  },
  {
    title: 'Risk Assessment',
    content: '',
    analysisResults: [],
    status: 'waiting',
  },
  {
    title: 'Generating Suggestions',
    content: '',
    analysisResults: [],
    status: 'waiting',
  },
];

const AnalysisResultsSection: React.FC<{ results: AnalysisResult[] }> = ({ results }) => (
  <div className="mt-4">
    <div className="flex items-center gap-2 mb-3">
      <GlobalOutlined className="text-blue-500" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Cited Legal Basis
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

const StageContent: React.FC<{ stage: LegalAnalysisStage; index: number }> = ({ stage, index }) => (
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

          {stage.status === 'completed' && stage.analysisResults.length > 0 && (
            <AnalysisResultsSection results={stage.analysisResults} />
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

export const LegalReviewPanel: React.FC<LegalReviewPanelProps> = ({ isOpen, onClose, query }) => {
  const [stages, setStages] = useState<LegalAnalysisStage[]>(initialStages);
  const [currentStage, setCurrentStage] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  useEffect(() => {
    if (!isOpen) {
      setStages(initialStages);
      setCurrentStage(-1);
      setIsProcessing(false);
      setError(null);
      return;
    }

    if (!query.trim()) {
      setError('Contract text is required');
      return;
    }

    startLegalReview();
  }, [isOpen, query]);

  const startLegalReview = useCallback(async () => {
    if (!query?.trim()) {
      console.error('❌ No query provided for legal review');
      return;
    }

    console.log('🚀 Starting legal review for query:', query);
    setStages([
      {
        title: 'Stage 1: Identifying Key Clauses',
        content: '',
        analysisResults: [],
        status: 'loading',
      },
      { title: 'Stage 2: Risk Assessment', content: '', analysisResults: [], status: 'waiting' },
      {
        title: 'Stage 3: Generating Suggestions',
        content: '',
        analysisResults: [],
        status: 'waiting',
      },
    ]);

    // Mock API call for now
    // In the future, this will be a real API call to the legal review endpoint
    try {
      console.log(' MOCKING API call to legal review endpoint...');
      // Simulate API stream
      const mockStageData = {
        searchQuery: '',
        analysisResults: [],
        aiContent: '',
        timestamp: new Date().toISOString(),
      };

      setTimeout(
        () =>
          handleStreamEvent({
            type: 'stage_start',
            stageData: { ...mockStageData, stage: 0, stageName: 'Identifying Key Clauses' },
          }),
        500,
      );
      setTimeout(
        () =>
          handleStreamEvent({
            type: 'ai_response',
            content: 'Identifying potentially problematic clauses...',
          }),
        1000,
      );
      setTimeout(
        () =>
          handleStreamEvent({
            type: 'stage_complete',
            stageData: {
              ...mockStageData,
              stage: 0,
              stageName: 'Identifying Key Clauses',
              aiContent: 'Identified 5 key clauses related to confidentiality and liability.',
            },
          }),
        2000,
      );

      setTimeout(
        () =>
          handleStreamEvent({
            type: 'stage_start',
            stageData: { ...mockStageData, stage: 1, stageName: 'Risk Assessment' },
          }),
        2500,
      );
      setTimeout(
        () =>
          handleStreamEvent({
            type: 'ai_response',
            content: 'Assessing risks. High risk found in liability clause...',
          }),
        3000,
      );
      setTimeout(
        () =>
          handleStreamEvent({
            type: 'stage_complete',
            stageData: {
              ...mockStageData,
              stage: 1,
              stageName: 'Risk Assessment',
              aiContent: 'Found 2 high-risk items and 3 medium-risk items.',
            },
          }),
        4000,
      );

      setTimeout(
        () =>
          handleStreamEvent({
            type: 'stage_start',
            stageData: { ...mockStageData, stage: 2, stageName: 'Generating Suggestions' },
          }),
        4500,
      );
      setTimeout(
        () =>
          handleStreamEvent({
            type: 'ai_response',
            content: 'Generating modification suggestions...',
          }),
        5000,
      );
      setTimeout(
        () =>
          handleStreamEvent({
            type: 'stage_complete',
            stageData: {
              ...mockStageData,
              stage: 2,
              stageName: 'Generating Suggestions',
              aiContent: 'Provided specific suggestions to mitigate risks and clarify terms.',
            },
          }),
        6000,
      );

      setTimeout(() => handleStreamEvent({ type: 'complete' }), 6500);
    } catch (error) {
      console.error('❌ Legal review mock API error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      message.error('Failed to start legal review');
    }
  }, [query]);

  const handleStreamEvent = (event: LegalReviewEvent) => {
    switch (event.type) {
      case 'stage_start': {
        const stageIndex = event.stageData?.stage ?? currentStage + 1;
        console.log(`🚀 Stage ${stageIndex} started: ${event.stageData?.stageName}`);
        setCurrentStage(stageIndex);
        setStages((prevStages) =>
          prevStages.map((s, i) => (i === stageIndex ? { ...s, status: 'loading' } : s)),
        );
        break;
      }

      case 'analysis_complete':
        if (event.stageData) {
          console.log(
            `🔍 Analysis completed for stage ${event.stageData.stage}:`,
            event.stageData.analysisResults.length,
            'results',
          );
          setStages((prev) =>
            prev.map((stage, index) =>
              index === event.stageData!.stage
                ? { ...stage, analysisResults: event.stageData!.analysisResults }
                : stage,
            ),
          );
        }
        break;

      case 'ai_response':
        if (event.content) {
          console.log(`🤖 AI response received:`, event.content.substring(0, 100) + '...');
          setStages((prev) =>
            prev.map((stage, index) =>
              index === currentStage
                ? { ...stage, content: stage.content + event.content! }
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
                    analysisResults: event.stageData!.analysisResults,
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
    a.download = `legal-review-${Date.now()}.txt`;
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
          <div
            className={cn(
              'fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300',
              isOpen ? 'opacity-100' : 'opacity-0',
            )}
            onClick={onClose}
          />

          <div
            className={cn(
              'fixed right-0 top-0 h-full w-1/2 min-w-[600px] bg-white dark:bg-gray-900',
              'shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out',
              isOpen ? 'translate-x-0' : 'translate-x-full',
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 flex items-center gap-2">
                <VscLaw className="text-xl" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">
                  Legal Contract Review
                </h2>
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

            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">Error: {error}</p>
                </div>
              )}

              <div className="p-4 mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                  Original Query
                </p>
                <p className="text-gray-700 dark:text-gray-300 text-sm mt-1 whitespace-pre-wrap">
                  {query}
                </p>
              </div>

              {isProcessing && currentStage === -1 && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Spin size="large" />
                    <p className="mt-2 text-gray-500">Initializing legal review...</p>
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
