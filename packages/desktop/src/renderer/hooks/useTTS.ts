/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '@/common/config/configService';
import { type TTSConfig, speak, stopSpeech, getBrowserVoices } from '@/common/api/tts';
import { Message } from '@arco-design/web-react';
import { useCallback, useRef, useState } from 'react';

const DEFAULT_TTS_CONFIG: TTSConfig = {
  apiUrl: 'https://api.openai.com',
  apiKey: '',
  voice: 'serena',
  speed: 1.0,
  model: 'tts-1',
  engine: 'api' as const,
  voiceMode: 'preset' as const,
  promptSpeech: '',
  promptText: '',
};

function loadTTSConfig(): TTSConfig {
  return {
    apiUrl: configService.get('tts.apiUrl') || DEFAULT_TTS_CONFIG.apiUrl,
    apiKey: configService.get('tts.apiKey') || '',
    voice: configService.get('tts.voice') || DEFAULT_TTS_CONFIG.voice,
    speed: configService.get('tts.speed') ?? DEFAULT_TTS_CONFIG.speed,
    model: configService.get('tts.model') || DEFAULT_TTS_CONFIG.model,
    engine: (configService.get('tts.engine') === 'api' || configService.get('tts.engine') === 'browser') ? configService.get('tts.engine') as 'api' | 'browser' : 'api',
    voiceMode: (configService.get('tts.voiceMode') === 'preset' || configService.get('tts.voiceMode') === 'clone') ? configService.get('tts.voiceMode') as 'preset' | 'clone' : 'preset',
    promptSpeech: configService.get('tts.promptSpeech') || '',
    promptText: configService.get('tts.promptText') || '',
  };
}

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  const speakText = useCallback(async (text: string) => {
    if (!text?.trim()) return;
    if (speakingRef.current) {
      stopSpeech();
      speakingRef.current = false;
      setSpeaking(false);
      return;
    }
    speakingRef.current = true;
    setSpeaking(true);
    try {
      const config = loadTTSConfig();
      if (config.engine !== 'browser' && !config.apiKey) {
        Message.warning('请先在设置中配置 TTS API Key');
        return;
      }
      await speak(text, config);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS 播放失败';
      Message.error(message);
    } finally {
      speakingRef.current = false;
      setSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    stopSpeech();
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  return { speak: speakText, speaking, stop };
}
