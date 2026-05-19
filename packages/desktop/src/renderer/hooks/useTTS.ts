/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigStorage } from '@/common/config/storage';
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

async function loadTTSConfig(): Promise<TTSConfig> {
  try {
    const [apiUrl, apiKey, voice, speed, model, engine, voiceMode, promptSpeech, promptText] = await Promise.all([
      ConfigStorage.get('tts.apiUrl'),
      ConfigStorage.get('tts.apiKey'),
      ConfigStorage.get('tts.voice'),
      ConfigStorage.get('tts.speed'),
      ConfigStorage.get('tts.model'),
      ConfigStorage.get('tts.engine'),
      ConfigStorage.get('tts.voiceMode'),
      ConfigStorage.get('tts.promptSpeech'),
      ConfigStorage.get('tts.promptText'),
    ]);
    return {
      apiUrl: apiUrl || DEFAULT_TTS_CONFIG.apiUrl,
      apiKey: apiKey || '',
      voice: voice || DEFAULT_TTS_CONFIG.voice,
      speed: speed ?? DEFAULT_TTS_CONFIG.speed,
      model: model || DEFAULT_TTS_CONFIG.model,
      engine: (engine === 'api' || engine === 'browser') ? engine : 'api',
      voiceMode: (voiceMode === 'preset' || voiceMode === 'clone') ? voiceMode : 'preset',
      promptSpeech: promptSpeech || '',
      promptText: promptText || '',
    };
  } catch {
    return { ...DEFAULT_TTS_CONFIG };
  }
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
      const config = await loadTTSConfig();
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
