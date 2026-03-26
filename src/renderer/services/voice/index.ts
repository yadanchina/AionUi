/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { isElectronDesktop } from '@renderer/utils/platform';
import { ElectronVoiceService } from './ElectronVoiceService';
import { WebVoiceService } from './WebVoiceService';
import type { IVoiceService } from './types';

export type { IVoiceService, TranscriptEvent, VoiceStartResult, VoiceStopResult } from './types';

/**
 * Singleton voice service.
 * - Electron desktop: delegates to main process via IPC (Python/Vosk subprocess).
 * - Web browser: runs WebAssembly Vosk directly in the renderer.
 */
export const voiceService: IVoiceService = isElectronDesktop() ? new ElectronVoiceService() : new WebVoiceService();
