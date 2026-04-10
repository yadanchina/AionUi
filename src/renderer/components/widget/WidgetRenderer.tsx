/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { resolveThemeVars, getWidgetIframeStyleBlock } from '@/renderer/lib/widget/widget-css-bridge';
import { sanitizeForStreaming, sanitizeForIframe, buildReceiverSrcdoc } from '@/renderer/lib/widget/widget-sanitizer';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';

interface WidgetRendererProps {
  widgetCode: string;
  isStreaming: boolean;
  title?: string;
  showOverlay?: boolean;
}

const MAX_IFRAME_HEIGHT = 2000;
const STREAM_DEBOUNCE = 120;
const CDN_PATTERN = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|esm\.sh/;

const _heightCache = new Map<string, number>();
function getHeightCacheKey(code: string): string {
  return code.slice(0, 200);
}

function WidgetRendererInner({ widgetCode, isStreaming, title, showOverlay }: WidgetRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>('');
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(() => {
    return _heightCache.get(getHeightCacheKey(widgetCode)) || 0;
  });
  const [showCode, setShowCode] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const hasReceivedFirstHeight = useRef((_heightCache.get(getHeightCacheKey(widgetCode)) || 0) > 0);
  const heightLockedRef = useRef(false);

  const hasCDN = useMemo(() => CDN_PATTERN.test(widgetCode), [widgetCode]);

  const srcdoc = useMemo(() => {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const resolvedVars = resolveThemeVars();
    const styleBlock = getWidgetIframeStyleBlock(resolvedVars);
    return buildReceiverSrcdoc(styleBlock, isDark);
  }, []);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data.type !== 'string') return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;

      switch (e.data.type) {
        case 'widget:ready':
          setIframeReady(true);
          break;
        case 'widget:resize':
          if (typeof e.data.height === 'number' && e.data.height > 0) {
            const newH = Math.min(e.data.height + 2, MAX_IFRAME_HEIGHT);
            const cacheKey = getHeightCacheKey(widgetCode);
            if (heightLockedRef.current) {
              setIframeHeight((prev) => {
                const h = Math.max(prev, newH);
                _heightCache.set(cacheKey, h);
                return h;
              });
              break;
            }
            _heightCache.set(cacheKey, newH);
            if (!hasReceivedFirstHeight.current) {
              hasReceivedFirstHeight.current = true;
              const el = iframeRef.current;
              if (el) {
                el.style.transition = 'none';
                void el.offsetHeight;
              }
              setIframeHeight(newH);
              requestAnimationFrame(() => {
                if (el) el.style.transition = 'height 0.3s ease-out';
              });
            } else {
              setIframeHeight(newH);
            }
          }
          break;
        case 'widget:link': {
          const href = String(e.data.href || '');
          if (href && !/^\s*(javascript|data)\s*:/i.test(href)) {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
          break;
        }
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [widgetCode]);

  const sendUpdate = useCallback((html: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    if (html === lastSentRef.current) return;
    lastSentRef.current = html;
    iframe.contentWindow.postMessage({ type: 'widget:update', html }, '*');
  }, []);

  useEffect(() => {
    if (!isStreaming || !iframeReady) return;
    const sanitized = sanitizeForStreaming(widgetCode);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => sendUpdate(sanitized), STREAM_DEBOUNCE);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [widgetCode, isStreaming, iframeReady, sendUpdate]);

  const finalizedCodeRef = useRef('');
  useEffect(() => {
    if (isStreaming || !iframeReady) return;
    if (finalizedCodeRef.current === widgetCode) return;
    const sanitized = sanitizeForIframe(widgetCode);
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    finalizedCodeRef.current = widgetCode;
    lastSentRef.current = sanitized;
    heightLockedRef.current = true;
    iframe.contentWindow.postMessage({ type: 'widget:finalize', html: sanitized }, '*');
    setTimeout(() => {
      heightLockedRef.current = false;
      setFinalized(true);
    }, 400);
  }, [isStreaming, iframeReady, widgetCode]);

  const showLoadingOverlay = hasCDN && !isStreaming && iframeReady && !finalized;

  return (
    <div className='relative my-8px group'>
      <iframe
        ref={iframeRef}
        sandbox='allow-scripts'
        srcDoc={srcdoc}
        title={title || 'Widget'}
        onLoad={() => setIframeReady(true)}
        style={{
          width: '100%',
          height: iframeHeight,
          border: 'none',
          display: showCode ? 'none' : 'block',
          overflow: 'hidden',
          transition: 'height 0.3s ease-out',
        }}
        scrolling='no'
      />
      {(showLoadingOverlay || showOverlay) && (
        <div
          className='absolute inset-0 pointer-events-none rd-8px'
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(128,128,128,0.08) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'widget-shimmer 1.5s ease-in-out infinite',
          }}
        />
      )}
      {showCode && (
        <pre className='p-12px text-xs rd-8px bg-fill-2 overflow-x-auto max-h-320px overflow-y-auto border border-line-2'>
          <code>{widgetCode}</code>
        </pre>
      )}
      <div className='absolute top-4px right-4px opacity-0 group-hover:opacity-100 transition-opacity'>
        <button
          onClick={() => setShowCode(!showCode)}
          className='text-10px px-6px py-2px rd-4px text-t-3 hover:text-t-2 hover:bg-fill-2'
        >
          {showCode ? 'Hide' : 'Show'} Code
        </button>
      </div>
    </div>
  );
}

export function WidgetRenderer(props: WidgetRendererProps) {
  return (
    <WidgetErrorBoundary>
      <WidgetRendererInner {...props} />
    </WidgetErrorBoundary>
  );
}
