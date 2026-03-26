/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type TranscriptEvent = { text?: string; isFinal?: boolean; error?: string };

export type VoiceStartResult = { success: boolean; msg?: string };

export type VoiceStopResult = { success: boolean };

export interface IVoiceService {
  start(opts?: { modelPath?: string }): Promise<VoiceStartResult>;
  stop(): Promise<VoiceStopResult>;
  /** Subscribe to transcript events. Returns an unsubscribe function. */
  onTranscript(listener: (event: TranscriptEvent) => void): () => void;
}
