/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigStorage } from '@/common/config/storage';
import { SPEECH_TO_TEXT_CONFIG_CHANGED_EVENT, type SpeechInputMode } from '@/common/types/speech';
import { useEffect, useState } from 'react';

const DEFAULT_SPEECH_INPUT_MODE: SpeechInputMode = 'local';

const normalizeSpeechInputMode = (mode?: SpeechInputMode): SpeechInputMode => {
  return mode === 'remote' ? 'remote' : DEFAULT_SPEECH_INPUT_MODE;
};

export const useSpeechInputMode = () => {
  const [mode, setMode] = useState<SpeechInputMode>(DEFAULT_SPEECH_INPUT_MODE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncSpeechInputMode = async () => {
      try {
        const storedMode = await ConfigStorage.get('tools.speechInputMode');
        if (cancelled) {
          return;
        }
        setMode(normalizeSpeechInputMode(storedMode));
      } catch {
        if (cancelled) {
          return;
        }
        setMode(DEFAULT_SPEECH_INPUT_MODE);
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    };

    const handleConfigChanged = () => {
      void syncSpeechInputMode();
    };

    void syncSpeechInputMode();
    window.addEventListener(SPEECH_TO_TEXT_CONFIG_CHANGED_EVENT, handleConfigChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(SPEECH_TO_TEXT_CONFIG_CHANGED_EVENT, handleConfigChanged);
    };
  }, []);

  return {
    isLoaded,
    mode,
  };
};
