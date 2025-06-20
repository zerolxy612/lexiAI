import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { CloseOutlined, CopyOutlined, DownloadOutlined, GlobalOutlined } from '@ant-design/icons';
import { message, Spin, Steps, Divider, Tooltip, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDeepResearchStore } from '../../stores/deep-research';
import type { SearchResult } from '../../stores/deep-research';
import { requestEventStream, streamResponse } from '../../utils/stream';
import './deep-research.scss';

// Search Results Display Component
const SearchResultsDisplay = memo(({ results }: { results: SearchResult[] }) => (
  <Steps
    direction="vertical"
    items={[
      {
        title: <span className="font-medium text-gray-900">Researching websites</span>,
        status: 'finish',
        description: (
          <div className="flex flex-wrap gap-3">
            {results.map((item, index) => (
              <Tooltip key={index} title={item.snippet}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center w-[22%] gap-2 px-4 py-2 
                           bg-gray-50 hover:bg-gray-100 
                           rounded-[10px] border border-[#EAE6F2] 
                           bg-white shadow-[0px_2px_6px_0px_rgba(25,29,40,0.06)]
                           transition-colors duration-200
                           hover:shadow-md"
                >
                  <GlobalOutlined className="text-blue-500" />
                  <span className="text-gray-800 font-medium truncate">
                    {new URL(item.link).hostname}
                  </span>
                </a>
              </Tooltip>
            ))}
          </div>
        ),
        icon: <GlobalOutlined className="text-blue-500" />,
      },
    ]}
  />
));

SearchResultsDisplay.displayName = 'SearchResultsDisplay';

// Main Deep Research Component
export const DeepResearch = memo(() => {
  const { t } = useTranslation();
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const {
    isDeepShow,
    deepShowContent,
    streamingAnswer,
    streamingAnswer2,
    streamingAnswer3,
    searchResults,
    searchResults2,
    searchResults3,
    showSearch,
    showSearch2,
    showSearch3,
    showLoad,
    setIsDeepShow,
    setStreamingAnswer,
    setStreamingAnswer2,
    setStreamingAnswer3,
    setSearchResults,
    setSearchResults2,
    setSearchResults3,
    setShowSearch,
    setShowSearch2,
    setShowSearch3,
    setShowLoad,
    resetAllStates,
  } = useDeepResearchStore();

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    const container = contentContainerRef.current;
    if (!container) return;
    setTimeout(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);
  }, []);

  // 第一段：基础分析
  const getAiAnswer = useCallback(async () => {
    if (!deepShowContent) return;
    setShowLoad(true);

    // 重置所有状态
    resetAllStates();

    try {
      const response = await requestEventStream({
        isSearch: true,
        languageTag: 'EN', // 临时使用固定语言，后续可优化
        message: {
          type: 'user',
          text: deepShowContent, // 原始问题，不添加后缀
          metadata: { chatDialogId: '' },
        },
        model: 'hkgai-general',
        preGenerationRequired: 0, // 第一段
        persistentStrategy: 0,
        searchStrategy: 1,
      });

      let answer = '';
      for await (const { streamContent, searchResultsStream } of streamResponse(response)) {
        if (searchResultsStream && searchResults.length === 0) {
          setSearchResults(searchResultsStream);
        }

        if (streamContent) {
          setShowLoad(false);
          answer += streamContent;
          setStreamingAnswer(answer);
        }
      }

      setShowSearch(true);
      scrollToBottom();

      // 自动执行第二段
      getAiAnswer2();
    } catch (error) {
      console.log('error', error);
      setShowLoad(false);
    }
  }, [
    deepShowContent,
    resetAllStates,
    scrollToBottom,
    searchResults.length,
    setSearchResults,
    setStreamingAnswer,
    setShowSearch,
    setShowLoad,
  ]);

  // 第二段：拓展分析
  const getAiAnswer2 = useCallback(async () => {
    try {
      const response = await requestEventStream({
        isSearch: true,
        languageTag: 'EN',
        message: {
          type: 'user',
          text: deepShowContent + '，拓展', // 添加"拓展"后缀
          metadata: { chatDialogId: '' },
        },
        model: 'hkgai-general',
        preGenerationRequired: 1, // 第二段
        persistentStrategy: 0,
        searchStrategy: 1,
      });

      let answer = '';
      for await (const { streamContent, searchResultsStream } of streamResponse(response)) {
        if (searchResultsStream && searchResults2.length === 0) {
          setSearchResults2(searchResultsStream);
        }

        if (streamContent) {
          answer += streamContent;
          setStreamingAnswer2(answer);
        }
      }

      setShowSearch2(true);
      scrollToBottom();

      // 自动执行第三段
      getAiAnswer3();
    } catch (error) {
      console.log('error', error);
    }
  }, [
    deepShowContent,
    scrollToBottom,
    searchResults2.length,
    setSearchResults2,
    setStreamingAnswer2,
    setShowSearch2,
  ]);

  // 第三段：深度剖析
  const getAiAnswer3 = useCallback(async () => {
    try {
      const response = await requestEventStream({
        isSearch: true,
        languageTag: 'EN',
        message: {
          type: 'user',
          text: deepShowContent + '，深度剖析', // 添加"深度剖析"后缀
          metadata: { chatDialogId: '' },
        },
        model: 'hkgai-general',
        preGenerationRequired: 2, // 第三段
        persistentStrategy: 0,
        searchStrategy: 1,
      });

      let answer = '';
      for await (const { streamContent, searchResultsStream } of streamResponse(response)) {
        if (searchResultsStream && searchResults3.length === 0) {
          setSearchResults3(searchResultsStream);
        }

        if (streamContent) {
          answer += streamContent;
          setStreamingAnswer3(answer);
        }
      }

      setShowSearch3(true);
      scrollToBottom();
    } catch (error) {
      console.log('error', error);
    }
  }, [
    deepShowContent,
    scrollToBottom,
    searchResults3.length,
    setSearchResults3,
    setStreamingAnswer3,
    setShowSearch3,
  ]);

  // 复制功能
  const copyText = useCallback(async (textToCopy: string | null | undefined) => {
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      message.success('Copy successful');
    } catch (err) {
      message.error('Copy failed');
    }
  }, []);

  // 下载功能 (占位符)
  const downloadContent = useCallback(() => {
    const allContent = `${streamingAnswer}\n\n${streamingAnswer2}\n\n${streamingAnswer3}`;
    const blob = new Blob([allContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deep-research-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [streamingAnswer, streamingAnswer2, streamingAnswer3]);

  // 自动启动三段检索
  useEffect(() => {
    if (isDeepShow && deepShowContent) {
      getAiAnswer();
    }
  }, [isDeepShow, deepShowContent, getAiAnswer]);

  // 自动滚动效果
  useEffect(() => {
    const container = contentContainerRef.current;
    if (!container) return;

    const animationFrame = requestAnimationFrame(() => {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;

      if (isNearBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [streamingAnswer, streamingAnswer2, streamingAnswer3]);

  if (!isDeepShow) return null;

  return (
    <div className="deep-research-container">
      <div className="deep-research-panel">
        {/* 标题栏 */}
        <div className="relative">
          <div className="font-bold text-sm text-center text-[#222] font-sans p-[10px]">
            {deepShowContent}
          </div>
          <div className="absolute right-[0px] top-[10px] flex items-center gap-2">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={downloadContent}
              className="text-gray-500 hover:text-gray-700"
            />
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() =>
                copyText(`${streamingAnswer}\n${streamingAnswer2}\n${streamingAnswer3}`)
              }
              className="text-gray-500 hover:text-gray-700"
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setIsDeepShow(false)}
              className="text-gray-500 hover:text-gray-700"
            />
          </div>
        </div>

        <Divider style={{ margin: '10px 0', borderColor: '#DEDDDF' }} />

        {/* 内容区域 */}
        <div ref={contentContainerRef} className="deep-research-content">
          {/* 加载状态 */}
          {showLoad && (
            <div className="min-h-[200px] flex justify-center items-center">
              <Spin />
            </div>
          )}

          {/* 三段检索结果展示 */}
          {streamingAnswer && (
            <div className="research-stages">
              <Steps
                direction="vertical"
                items={[
                  {
                    title: 'Basic Analysis',
                    status: 'finish',
                    description: (
                      <div className="markdown-content text-gray-800 word-break">
                        {streamingAnswer}
                      </div>
                    ),
                    icon: (
                      <div className="w-[30px] h-[30px] rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
                        1
                      </div>
                    ),
                  },
                ]}
              />

              {/* 第一段搜索结果 */}
              {searchResults.length > 0 && showSearch && (
                <SearchResultsDisplay results={searchResults} />
              )}

              {/* 第二段内容 */}
              {streamingAnswer2 && (
                <Steps
                  direction="vertical"
                  items={[
                    {
                      title: 'Extended Analysis',
                      status: 'finish',
                      description: (
                        <div className="markdown-content text-gray-800 word-break">
                          {streamingAnswer2}
                        </div>
                      ),
                      icon: (
                        <div className="w-[30px] h-[30px] rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
                          2
                        </div>
                      ),
                    },
                  ]}
                />
              )}

              {/* 第二段搜索结果 */}
              {searchResults2.length > 0 && showSearch2 && (
                <SearchResultsDisplay results={searchResults2} />
              )}

              {/* 第三段内容 */}
              {streamingAnswer3 && (
                <Steps
                  direction="vertical"
                  items={[
                    {
                      title: 'Deep Analysis',
                      status: 'finish',
                      description: (
                        <div className="markdown-content text-gray-800 word-break">
                          {streamingAnswer3}
                        </div>
                      ),
                      icon: (
                        <div className="w-[30px] h-[30px] rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
                          3
                        </div>
                      ),
                    },
                  ]}
                />
              )}

              {/* 第三段搜索结果 */}
              {searchResults3.length > 0 && showSearch3 && (
                <SearchResultsDisplay results={searchResults3} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DeepResearch.displayName = 'DeepResearch';
