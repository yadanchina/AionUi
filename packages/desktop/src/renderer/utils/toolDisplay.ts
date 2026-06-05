/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */



/** Map tool names from API to localized display names via i18n. */
export function getToolDisplayName(t: (key: string, options?: Record<string, unknown>) => string, name: string): string {
  const key = 'conversation.toolNames.' + name;
  return t(key, { defaultValue: name });
}
