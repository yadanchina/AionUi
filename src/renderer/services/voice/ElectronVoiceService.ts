/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IVoiceService, TranscriptEvent, VoiceStartResult, VoiceStopResult } from './types';

/**
 * Voice service for Electron desktop mode.
 * Delegates to the main process via ipcBridge, which spawns the Python Vosk subprocess.
 */
export class ElectronVoiceService implements IVoiceService {
  async start(opts?: { modelPath?: string }): Promise<VoiceStartResult> {
    const result = await ipcBridge.speech.startVoiceInput.invoke(opts ?? {});
    return result.success ? { success: true } : { success: false, msg: result.msg };
  }

  async stop(): Promise<VoiceStopResult> {
    await ipcBridge.speech.stopVoiceInput.invoke();
    return { success: true };
  }

  onTranscript(listener: (event: TranscriptEvent) => void): () => void {
    return ipcBridge.speech.transcript.on(listener);
  }
}
