/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import ReactMarkdown from 'react-markdown';

import SyntaxHighlighter from 'react-syntax-highlighter';
import { vs, vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import katex from 'katex';
// Import KaTeX CSS to make it available in the document
import 'katex/dist/katex.min.css';

import { diffColors } from '@/renderer/styles/colors';
import { copyText } from '@/renderer/utils/ui/clipboard';
import { openExternalUrl } from '@/renderer/utils/platform';
import { Message } from '@arco-design/web-react';
import { Copy, Down, Up } from '@icon-park/react';
import { theme } from '@office-ai/platform';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { addImportantToAll } from '@renderer/utils/theme/customCssProcessor';
import { convertLatexDelimiters } from '@renderer/utils/chat/latexDelimiters';
import LocalImageView from './media/LocalImageView';
import TacticalReasoningCard, { type ReasoningCardData } from './TacticalReasoningCard';

const formatCode = (code: string) => {
  const content = String(code).replace(/\n$/, '');
  try {
    //@todo 可以再美化
    return JSON.stringify(
      JSON.parse(content),
      (_key, value) => {
        return value;
      },
      2
    );
  } catch (error) {
    return content;
  }
};

const logicRender = <T, F>(condition: boolean, trueComponent: T, falseComponent?: F): T | F => {
  return condition ? trueComponent : falseComponent;
};

/**
 * Get line background style for diff rendering
 * Highlights additions (green), deletions (red), and hunk headers (blue)
 */
const getDiffLineStyle = (line: string, isDark: boolean): React.CSSProperties => {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return { backgroundColor: isDark ? diffColors.additionBgDark : diffColors.additionBgLight };
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return { backgroundColor: isDark ? diffColors.deletionBgDark : diffColors.deletionBgLight };
  }
  if (line.startsWith('@@')) {
    return { backgroundColor: isDark ? diffColors.hunkBgDark : diffColors.hunkBgLight };
  }
  return {};
};

const normalizeCodeLanguage = (language?: string): string => {
  if (!language) return 'text';
  const normalized = language.toLowerCase();
  if (normalized === 'shell' || normalized === 'zsh') return 'bash';
  if (normalized === 'yml') return 'yaml';
  if (normalized === 'plaintext') return 'text';
  return normalized;
};

const parseReasoningCard = (content: string): ReasoningCardData | null => {
  try {
    const parsed = JSON.parse(content) as ReasoningCardData;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.header || typeof parsed.header.title !== 'string' || typeof parsed.header.des !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const MermaidBlock: React.FC<{ chart: string }> = ({ chart }) => {
  const { t } = useTranslation();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  React.useEffect(() => {
    const updateTheme = () => {
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setCurrentTheme(theme);
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    let disposed = false;

    const renderDiagram = async () => {
      try {
        setError(null);
        const mermaidModule = await import('mermaid');
        const mermaid = (mermaidModule.default ?? mermaidModule) as any;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'antiscript',
          theme: currentTheme === 'dark' ? 'dark' : 'default',
        });

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const rendered = await mermaid.render(id, chart);
        if (!disposed) {
          setSvg(rendered.svg);
        }
      } catch (renderError) {
        if (!disposed) {
          setSvg('');
          setError(renderError instanceof Error ? renderError.message : t('messages.renderFailed', 'Render failed'));
        }
      }
    };

    void renderDiagram();

    return () => {
      disposed = true;
    };
  }, [chart, currentTheme, t]);

  if (error) {
    return (
      <div className='mermaid-block'>
        <div className='mermaid-error'>{error}</div>
        <pre>{chart}</pre>
      </div>
    );
  }

  return (
    <div className='mermaid-block'>
      {svg ? (
        <div className='mermaid-diagram' dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className='mermaid-loading'>{t('common.loading', 'Loading...')}</div>
      )}
    </div>
  );
};

function CodeBlock(props: any) {
  const { t } = useTranslation();
  const [fold, setFlow] = useState(true);
  const shellRef = React.useRef<HTMLDivElement | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  React.useEffect(() => {
    const updateTheme = () => {
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setCurrentTheme(theme);
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const getScrollableParent = (el: HTMLElement | null): HTMLElement | null => {
    if (!el) return null;
    let current: HTMLElement | null = el.parentElement;
    while (current) {
      const style = window.getComputedStyle(current);
      const canScroll = /(auto|scroll)/.test(style.overflowY || '');
      if (canScroll && current.scrollHeight > current.clientHeight) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  const toggleFold = (nextFold: boolean) => {
    const shell = shellRef.current;
    if (!shell) {
      setFlow(nextFold);
      return;
    }

    const scrollParent = getScrollableParent(shell);
    const shellTopBefore = shell.getBoundingClientRect().top;
    const scrollTopBefore = scrollParent?.scrollTop ?? window.scrollY;

    setFlow(nextFold);

    requestAnimationFrame(() => {
      const shellTopAfter = shell.getBoundingClientRect().top;
      const delta = shellTopAfter - shellTopBefore;
      if (Math.abs(delta) < 1) return;

      if (scrollParent) {
        scrollParent.scrollTop = scrollTopBefore + delta;
      } else {
        window.scrollTo({ top: scrollTopBefore + delta });
      }
    });
  };

  return useMemo(() => {
    const { children, className, node: _node, hiddenCodeCopyButton, codeStyle: _codeStyle, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');
    const language = normalizeCodeLanguage(match?.[1]);
    const codeTheme = currentTheme === 'dark' ? vs2015 : vs;
    const codeContent = String(children).replace(/\n$/, '');
    const lineCount = codeContent ? codeContent.split('\n').length : 0;

    if (language === 'mermaid') {
      return (
        <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', ...(props.codeStyle || {}) }}>
          <div className='code-block-shell' ref={shellRef}>
            <div className='code-block-toolbar'>
              <div className='code-block-meta'>
                <span className='code-block-lang'>mermaid</span>
                <span className='code-block-lines'>{lineCount} lines</span>
              </div>
              {!hiddenCodeCopyButton && (
                <div className='code-block-actions'>
                  <Copy
                    theme='outline'
                    size='18'
                    style={{ cursor: 'pointer' }}
                    fill='var(--text-secondary)'
                    onClick={() => {
                      void copyText(codeContent)
                        .then(() => {
                          Message.success(t('common.copySuccess'));
                        })
                        .catch(() => {
                          Message.error(t('common.copyFailed'));
                        });
                    }}
                  />
                </div>
              )}
            </div>
            <MermaidBlock chart={codeContent} />
          </div>
        </div>
      );
    }

    if (language === 'reasoning') {
      const reasoningData = parseReasoningCard(codeContent);

      if (reasoningData) {
        return (
          <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', ...(props.codeStyle || {}) }}>
            <TacticalReasoningCard
              data={reasoningData}
              mermaidRenderer={reasoningData.mermaid ? <MermaidBlock chart={reasoningData.mermaid} /> : undefined}
              renderMermaid={(chart) => <MermaidBlock chart={chart} />}
            />
          </div>
        );
      }
    }

    // Render latex/math code blocks as KaTeX display math
    // Skip full LaTeX documents (with \documentclass, \begin{document}, etc.) — KaTeX only handles math
    if (language === 'latex' || language === 'math' || language === 'tex') {
      const isFullDocument = /\\(documentclass|begin\{document\}|usepackage)\b/.test(codeContent);
      if (!isFullDocument) {
        try {
          const html = katex.renderToString(codeContent, {
            displayMode: true,
            throwOnError: false,
          });
          return <div className='katex-display' dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          // Fall through to render as code block if KaTeX fails
        }
      }
    }

    if (!String(children).includes('\n')) {
      return (
        <code
          {...rest}
          className={className}
          style={{
            fontWeight: 'bold',
          }}
        >
          {children}
        </code>
      );
    }

    const isDiff = language === 'diff';
    const formattedContent = formatCode(children);
    const diffLines = isDiff ? formattedContent.split('\n') : [];
    const displayLineCount = formattedContent ? formattedContent.split('\n').length : lineCount;

    return (
      <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', ...(props.codeStyle || {}) }}>
        <div className='code-block-shell' ref={shellRef}>
          <div className='code-block-toolbar'>
            <div className='code-block-meta'>
              <span className='code-block-lang'>{language.toLocaleLowerCase()}</span>
              <span className='code-block-lines'>{displayLineCount} lines</span>
            </div>
            <div className='code-block-actions'>
              {/* 复制代码按钮 / Copy code button */}
              {!hiddenCodeCopyButton && (
                <Copy
                  theme='outline'
                  size='18'
                  style={{ cursor: 'pointer' }}
                  fill='var(--text-secondary)'
                  onClick={() => {
                    void copyText(formattedContent)
                      .then(() => {
                        Message.success(t('common.copySuccess'));
                      })
                      .catch(() => {
                        Message.error(t('common.copyFailed'));
                      });
                  }}
                />
              )}
              {/* 折叠/展开按钮 / Fold/unfold button */}
              {logicRender(
                !fold,
                <Up
                  theme='outline'
                  size='20'
                  style={{ cursor: 'pointer' }}
                  fill='var(--text-secondary)'
                  onClick={() => setFlow(true)}
                />,
                <Down
                  theme='outline'
                  size='20'
                  style={{ cursor: 'pointer' }}
                  fill='var(--text-secondary)'
                  onClick={() => setFlow(false)}
                />
              )}
            </div>
          </div>
          {logicRender(
            !fold,
            <>
              <SyntaxHighlighter
                children={formattedContent}
                language={language}
                style={codeTheme}
                PreTag='div'
                wrapLines={isDiff}
                lineProps={
                  isDiff
                    ? (lineNumber: number) => ({
                        style: {
                          display: 'block',
                          ...getDiffLineStyle(diffLines[lineNumber - 1] || '', currentTheme === 'dark'),
                        },
                      })
                    : undefined
                }
                customStyle={{
                  marginTop: '0',
                  margin: '0',
                  borderTopLeftRadius: '0',
                  borderTopRightRadius: '0',
                  borderBottomLeftRadius: '0',
                  borderBottomRightRadius: '0',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  maxWidth: '100%',
                }}
                codeTagProps={{
                  style: {
                    color: 'var(--text-primary)',
                  },
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-2)',
                  borderBottomLeftRadius: '0.3rem',
                  borderBottomRightRadius: '0.3rem',
                  padding: '6px 10px',
                  borderTop: '1px solid var(--bg-3)',
                }}
              >
                <Up
                  theme='outline'
                  size='20'
                  style={{ cursor: 'pointer' }}
                  fill='var(--text-secondary)'
                  onClick={() => setFlow(true)}
                  title={t('common.collapse', '收起')}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }, [props, currentTheme, fold, t]);
}

const createInitStyle = (currentTheme = 'light', cssVars?: Record<string, string>, customCss?: string) => {
  const style = document.createElement('style');
  // 将外部 CSS 变量注入到 Shadow DOM 中，支持深色模式 Inject external CSS variables into Shadow DOM for dark mode support
  const cssVarsDeclaration = cssVars
    ? Object.entries(cssVars)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n    ')
    : '';

  style.innerHTML = `
  /* Shadow DOM CSS 变量定义 Shadow DOM CSS variable definitions */
  :host {
    ${cssVarsDeclaration}
  }

  * {
    line-height:26px;
    font-size:16px;
    color: inherit;
  }

  .markdown-shadow-body {
    word-break: break-word;
    overflow-wrap: anywhere;
    color: var(--text-primary);
    max-width: 100%;
  }
  .markdown-shadow-body>p:first-child
  {
    margin-top:0px;
  }
  h1,h2,h3,h4,h5,h6,p,pre{
    margin-block-start:0px;
    margin-block-end:0px;
  }
  a{
    color:${theme.Color.PrimaryColor};
    text-decoration: none;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: anywhere;
  }
  h1{
    font-size: 24px;
    line-height: 32px;
    font-weight: bold;
  }
  h2,h3,h4,h5,h6{
    font-size: 16px;
    line-height: 24px;
    font-weight: bold;
    margin-top: 8px;
    margin-bottom: 8px;
  }
  code{
    font-size:14px;
  }

  .markdown-shadow-body>p:last-child{
    margin-bottom:0px;
  }
  ol, ul {
    padding-inline-start:20px;
  }
  pre {
    max-width: 100%;
    overflow-x: auto;
  }
  .code-block-shell {
    border: 1px solid var(--bg-3);
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-1);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.06);
  }
  .code-block-toolbar,
  .code-block-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-2);
  }
  .code-block-toolbar {
    border-bottom: 1px solid var(--bg-3);
  }
  .code-block-footer {
    justify-content: flex-end;
    border-top: 1px solid var(--bg-3);
  }
  .code-block-meta,
  .code-block-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .code-block-lang {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bg-1);
    color: var(--text-primary);
    font-size: 12px;
    line-height: 18px;
    text-transform: lowercase;
  }
  .code-block-lines {
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 18px;
  }
  .mermaid-block {
    padding: 16px;
    overflow-x: auto;
    background: var(--bg-1);
  }
  .mermaid-diagram {
    display: flex;
    justify-content: center;
    min-width: fit-content;
  }
  .mermaid-diagram svg {
    max-width: 100%;
    height: auto;
  }
  .mermaid-error {
    color: #d14343;
    font-size: 13px;
    line-height: 20px;
    margin-bottom: 12px;
  }
  .mermaid-loading {
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 20px;
  }
  img {
    max-width: 100%;
    height: auto;
  }
   /* 给整个表格添加边框 */
  table {
    border-collapse: collapse;  /* 表格边框合并为单一边框 */
    th{
      padding: 8px;
      border: 1px solid var(--bg-3);
      background-color: var(--bg-1);
      font-weight: bold;
    }
    td{
        padding: 8px;
        border: 1px solid var(--bg-3);
        min-width: 120px;
    }
  }
  /* Inline code should wrap on small screens to avoid horizontal overflow */
  .markdown-shadow-body code {
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  /* Allow KaTeX to use its own line-height for proper fraction/superscript rendering */
  .katex,
  .katex * {
    line-height: normal;
  }

  /* Display math: only scroll horizontally when formula exceeds container width */
  .katex-display {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.5em 0;
  }

  .loading {
    animation: loading 1s linear infinite;
  }


  @keyframes loading {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* 用户自定义 CSS（注入到 Shadow DOM）User Custom CSS (injected into Shadow DOM) */
  ${customCss || ''}
  `;
  return style;
};

// Cache for KaTeX stylesheet to share across Shadow DOM instances
let katexStyleSheet: CSSStyleSheet | null = null;

/**
 * Get or create a shared KaTeX CSSStyleSheet for Shadow DOM adoption
 * This extracts KaTeX styles from the document and creates a constructable stylesheet
 */
const getKatexStyleSheet = (): CSSStyleSheet | null => {
  if (katexStyleSheet) return katexStyleSheet;

  try {
    // Find the KaTeX stylesheet in the document
    const katexSheet = [...document.styleSheets].find(
      (sheet) => sheet.href?.includes('katex') || (sheet.ownerNode as HTMLElement)?.dataset?.katex
    );

    if (katexSheet) {
      const cssRules = [...katexSheet.cssRules].map((rule) => rule.cssText).join('\n');
      katexStyleSheet = new CSSStyleSheet();
      katexStyleSheet.replaceSync(cssRules);
      return katexStyleSheet;
    }

    // Fallback: try to find KaTeX styles by checking style tags
    const styleSheets = [...document.styleSheets];
    for (const sheet of styleSheets) {
      try {
        const rules = [...sheet.cssRules];
        // Check if this stylesheet contains KaTeX rules
        const hasKatexRules = rules.some((rule) => rule.cssText.includes('.katex'));
        if (hasKatexRules) {
          const cssRules = rules.map((rule) => rule.cssText).join('\n');
          katexStyleSheet = new CSSStyleSheet();
          katexStyleSheet.replaceSync(cssRules);
          return katexStyleSheet;
        }
      } catch {
        // CORS may block access to cssRules for external stylesheets
        continue;
      }
    }
  } catch (error) {
    console.warn('Failed to create KaTeX stylesheet for Shadow DOM:', error);
  }

  return null;
};

const ShadowView = ({ children }: { children: React.ReactNode }) => {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const styleRef = React.useRef<HTMLStyleElement | null>(null);
  const [customCss, setCustomCss] = useState<string>('');

  // 从 ConfigStorage 加载自定义 CSS / Load custom CSS from ConfigStorage
  React.useEffect(() => {
    void import('@/common/config/storage').then(({ ConfigStorage }) => {
      ConfigStorage.get('customCss')
        .then((css) => {
          if (css) {
            // 使用统一的工具函数自动添加 !important
            const processedCss = addImportantToAll(css);
            setCustomCss(processedCss);
          } else {
            setCustomCss('');
          }
        })
        .catch((error) => {
          console.error('Failed to load custom CSS:', error);
        });
    });

    // 监听自定义 CSS 更新事件 / Listen to custom CSS update events
    const handleCustomCssUpdate = (e: CustomEvent) => {
      if (e.detail?.customCss !== undefined) {
        const css = e.detail.customCss || '';
        // 使用统一的工具函数自动添加 !important
        const processedCss = addImportantToAll(css);
        setCustomCss(processedCss);
      }
    };

    window.addEventListener('custom-css-updated', handleCustomCssUpdate as EventListener);

    return () => {
      window.removeEventListener('custom-css-updated', handleCustomCssUpdate as EventListener);
    };
  }, []);

  // 更新 Shadow DOM 中的 CSS 变量和自定义样式 Update CSS variables and custom styles in Shadow DOM
  const updateStyles = React.useCallback(
    (shadowRoot: ShadowRoot) => {
      const computedStyle = getComputedStyle(document.documentElement);
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const cssVars = {
        '--bg-1': computedStyle.getPropertyValue('--bg-1'),
        '--bg-2': computedStyle.getPropertyValue('--bg-2'),
        '--bg-3': computedStyle.getPropertyValue('--bg-3'),
        '--color-text-1': computedStyle.getPropertyValue('--color-text-1'),
        '--color-text-2': computedStyle.getPropertyValue('--color-text-2'),
        '--color-text-3': computedStyle.getPropertyValue('--color-text-3'),
        '--text-primary': computedStyle.getPropertyValue('--text-primary'),
        '--text-secondary': computedStyle.getPropertyValue('--text-secondary'),
      };

      // 移除旧样式并添加新样式 Remove old style and add new style
      if (styleRef.current) {
        styleRef.current.remove();
      }
      const newStyle = createInitStyle(currentTheme, cssVars, customCss);
      styleRef.current = newStyle;
      shadowRoot.appendChild(newStyle);

      // Inject KaTeX styles into Shadow DOM using adoptedStyleSheets
      // This allows math expressions to render correctly
      const katexSheet = getKatexStyleSheet();
      if (katexSheet && !shadowRoot.adoptedStyleSheets.includes(katexSheet)) {
        shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, katexSheet];
      }
    },
    [customCss]
  );

  React.useEffect(() => {
    if (!root) return;

    // 当自定义 CSS 变化时，更新样式 Update styles when custom CSS changes
    updateStyles(root);
  }, [root, customCss, updateStyles]);

  React.useEffect(() => {
    if (!root) return;

    // 监听主题变化 Listen for theme changes
    const observer = new MutationObserver(() => {
      updateStyles(root);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    return () => observer.disconnect();
  }, [root, updateStyles]);

  return (
    <div
      ref={(el: any) => {
        if (!el || el.__init__shadow) return;
        el.__init__shadow = true;
        const shadowRoot = el.attachShadow({ mode: 'open' });
        updateStyles(shadowRoot);
        setRoot(shadowRoot);
      }}
      className='markdown-shadow'
      style={{ width: '100%', flex: '1 1 auto', minWidth: 0 }}
    >
      {root && ReactDOM.createPortal(children, root)}
    </div>
  );
};

interface MarkdownViewProps {
  children: string;
  hiddenCodeCopyButton?: boolean;
  codeStyle?: React.CSSProperties;
  className?: string;
  onRef?: (el?: HTMLDivElement | null) => void;
  /** Enable raw HTML rendering in markdown content. Use with caution — only for trusted sources. */
  allowHtml?: boolean;
}

const MarkdownView: React.FC<MarkdownViewProps> = ({
  hiddenCodeCopyButton,
  codeStyle,
  className,
  onRef,
  allowHtml,
  children: childrenProp,
}) => {
  const { t } = useTranslation();

  const normalizedChildren = useMemo(() => {
    if (typeof childrenProp === 'string') {
      let text = childrenProp.replace(/file:\/\//g, '');
      text = convertLatexDelimiters(text);
      return text;
    }
    return childrenProp;
  }, [childrenProp]);

  const isLocalFilePath = (src: string): boolean => {
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return false;
    }
    if (src.startsWith('data:')) {
      return false;
    }
    return true;
  };

  return (
    <div className={classNames('relative w-full', className)}>
      <ShadowView>
        <div ref={onRef} className='markdown-shadow-body'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
            rehypePlugins={allowHtml ? [rehypeRaw, rehypeKatex] : [rehypeKatex]}
            components={{
              span: ({ node: _node, className, children, ...props }) => {
                return (
                  <span {...props} className={className}>
                    {children}
                  </span>
                );
              },
              code: (props: any) => CodeBlock({ ...props, codeStyle, hiddenCodeCopyButton }),
              a: ({ node: _node, ...props }) => (
                <a
                  {...props}
                  target='_blank'
                  rel='noreferrer'
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!props.href) return;
                    openExternalUrl(props.href).catch((error) => {
                      console.error(t('messages.openLinkFailed'), error);
                    });
                  }}
                />
              ),
              table: ({ node: _node, ...props }) => (
                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                  <table
                    {...props}
                    style={{
                      ...props.style,
                      borderCollapse: 'collapse',
                      border: '1px solid var(--bg-3)',
                      minWidth: '100%',
                    }}
                  />
                </div>
              ),
              td: ({ node: _node, ...props }) => (
                <td
                  {...props}
                  style={{
                    ...props.style,
                    padding: '8px',
                    border: '1px solid var(--bg-3)',
                    minWidth: '120px',
                  }}
                />
              ),
              img: ({ node: _node, ...props }) => {
                if (isLocalFilePath(props.src || '')) {
                  const src = decodeURIComponent(props.src || '');
                  return <LocalImageView src={src} alt={props.alt || ''} className={props.className} />;
                }
                return <img {...props} />;
              },
            }}
          >
            {normalizedChildren}
          </ReactMarkdown>
        </div>
      </ShadowView>
    </div>
  );
};

export default MarkdownView;
