/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { voiceInputService } from '../services/voiceInputService';

let initialized = false;

export function initSpeechBridge(): void {
  if (initialized) return;
  initialized = true;

  voiceInputService.onTranscript((event) => {
    ipcBridge.speech.transcript.emit(event);
  });

  ipcBridge.speech.startVoiceInput.provider(async ({ modelPath }) => {
    try {
      const result = await voiceInputService.start({ modelPath });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : 'start voice input failed' };
    }
  });

  ipcBridge.speech.stopVoiceInput.provider(async () => {
    try {
      const result = await voiceInputService.stop();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : 'stop voice input failed' };
    }
  });
}
