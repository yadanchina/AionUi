/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WidgetBlock {
  type: 'widget';
  title: string;
  widgetCode: string;
}

export interface TextBlock {
  type: 'text';
  content: string;
}

export type ContentBlock = WidgetBlock | TextBlock;

const WIDGET_FENCE_PATTERN = /```show-widget\s*\n([\s\S]*?)```/g;

/**
 * Parse markdown content and extract show-widget blocks
 */
export function parseShowWidgets(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let lastIndex = 0;

  const matches = content.matchAll(WIDGET_FENCE_PATTERN);

  for (const match of matches) {
    const beforeText = content.slice(lastIndex, match.index);
    if (beforeText.trim()) {
      blocks.push({ type: 'text', content: beforeText });
    }

    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.widget_code && parsed.title) {
        blocks.push({
          type: 'widget',
          title: parsed.title,
          widgetCode: parsed.widget_code,
        });
      }
    } catch {
      blocks.push({ type: 'text', content: match[0] });
    }

    lastIndex = (match.index || 0) + match[0].length;
  }

  const remaining = content.slice(lastIndex);
  if (remaining.trim()) {
    blocks.push({ type: 'text', content: remaining });
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', content }];
}
