import { LoadingOutlined } from '@ant-design/icons';
import { memo, useEffect, useRef, useState, Suspense, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

import RemarkBreaks from 'remark-breaks';
import RemarkGfm from 'remark-gfm';

import { cn, markdownCitationParse } from '@refly/utils';

// plugins
import LinkElement from './plugins/link';
import rehypeHighlight from './custom-plugins/rehype-highlight';

// styles
import './styles/markdown.scss';
import './styles/highlight.scss';
import { Source } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';

import { markdownElements } from './plugins';
import { processWithArtifact } from '@refly/utils/artifact';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';
import { MarkdownMode } from './types';
import { serverOrigin } from '@refly-packages/ai-workspace-common/utils/env';

const rehypePlugins = markdownElements.map((element) => element.rehypePlugin);

// Image component for handling preview
const MarkdownImage = memo(({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  // Fix image URL to ensure it points to the correct server
  const fixedSrc = useMemo(() => {
    if (!src) return src;

    // If it's already a full URL, return as is
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }

    // If it's a relative URL starting with /v1, prepend server origin
    if (src.startsWith('/v1/')) {
      return `${serverOrigin}${src}`;
    }

    // If it's starting with /api/v1, remove the /api prefix and prepend server origin
    if (src.startsWith('/api/v1/')) {
      const cleanPath = src.replace('/api', '');
      return `${serverOrigin}${cleanPath}`;
    }

    // Return original src for other cases (like base64 data URLs)
    return src;
  }, [src]);

  return (
    <>
      <img
        src={fixedSrc}
        alt={alt}
        className="max-w-full h-auto cursor-zoom-in rounded-lg hover:opacity-90 transition-opacity"
        onClick={(e) => {
          e.preventDefault();
          setIsPreviewVisible(true);
        }}
        {...props}
      />
      <ImagePreview
        isPreviewModalVisible={isPreviewVisible}
        setIsPreviewModalVisible={setIsPreviewVisible}
        imageUrl={fixedSrc ?? ''}
        imageTitle={alt}
      />
    </>
  );
});

// Custom Components for enhanced Markdown rendering
const HighlightComponent = ({ children }: { children: React.ReactNode }) => (
  <mark className="bg-yellow-200 dark:bg-yellow-800 dark:text-gray-200 rounded-sm px-1 text-inherit">
    {children}
  </mark>
);

const StrikethroughComponent = ({ children }: { children: React.ReactNode }) => (
  <del>{children}</del>
);

export const Markdown = memo(
  (
    props: {
      content: string;
      loading?: boolean;
      sources?: Source[];
      className?: string;
      resultId?: string;
      mode?: MarkdownMode;
    } & React.DOMAttributes<HTMLDivElement>,
  ) => {
    const { content: rawContent, mode = 'interactive' } = props;
    const content = processWithArtifact(rawContent);

    const mdRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const [isKatexLoaded, setIsKatexLoaded] = useState(false);

    // Add state for dynamically loaded plugins
    const [plugins, setPlugins] = useState({
      RemarkMath: null,
      RehypeKatex: null,
      RehypeHighlight: null,
    });

    // Memoize the className to prevent inline object creation
    const markdownClassName = useMemo(
      () => cn('markdown-body dark:text-gray-300', props.className),
      [props.className],
    );

    // Memoize the parsed content
    const parsedContent = useMemo(() => markdownCitationParse(content), [content]);

    const artifactComponents = useMemo(() => {
      // Capture resultId from outer props scope
      const outerResultId = props.resultId;

      return Object.fromEntries(
        markdownElements.map((element) => {
          const Component = element.Component;

          return [
            element.tag,
            (innerProps: any) => <Component {...innerProps} id={outerResultId} mode={mode} />,
          ];
        }),
      );
    }, [props.resultId, mode]);

    // Dynamically import KaTeX CSS
    useEffect(() => {
      import('katex/dist/katex.min.css').then(() => setIsKatexLoaded(true));
    }, []);

    // Dynamically import heavy plugins
    useEffect(() => {
      Promise.all([import('remark-math'), import('rehype-katex'), import('rehype-highlight')]).then(
        ([RemarkMath, RehypeKatex, RehypeHighlight]) => {
          setPlugins({
            RemarkMath: RemarkMath.default,
            RehypeKatex: RehypeKatex.default,
            RehypeHighlight: RehypeHighlight.default,
          });
        },
      );
    }, []);

    return (
      <div className={markdownClassName} ref={mdRef}>
        {props.loading ? (
          <LoadingOutlined />
        ) : (
          <Suspense fallback={<div>{t('common.loading')}</div>}>
            {isKatexLoaded &&
              plugins.RemarkMath &&
              plugins.RehypeKatex &&
              plugins.RehypeHighlight && (
                <ReactMarkdown
                  remarkPlugins={[RemarkBreaks, plugins.RemarkMath, RemarkGfm]}
                  rehypePlugins={[
                    ...rehypePlugins,
                    rehypeHighlight,
                    plugins.RehypeKatex,
                    [
                      plugins.RehypeHighlight,
                      {
                        detect: false,
                        ignoreMissing: true,
                      },
                    ],
                  ]}
                  components={{
                    ...artifactComponents,
                    a: (args) => LinkElement.Component(args, props?.sources || []),
                    img: MarkdownImage,
                    mark: HighlightComponent,
                    del: StrikethroughComponent,
                  }}
                  linkTarget={'_blank'}
                >
                  {parsedContent}
                </ReactMarkdown>
              )}
          </Suspense>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.loading === nextProps.loading &&
      prevProps.className === nextProps.className &&
      prevProps.resultId === nextProps.resultId &&
      prevProps.mode === nextProps.mode &&
      JSON.stringify(prevProps.sources) === JSON.stringify(nextProps.sources)
    );
  },
);
