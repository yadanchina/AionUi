/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TTSConfig {
  engine?: 'api' | 'browser';
  apiUrl: string;
  apiKey: string;
  voice?: string;
  speed?: number;
  model?: string;
  voiceMode?: 'preset' | 'clone';
  promptSpeech?: string;
  promptText?: string;
}

const DEFAULT_VOICE = 'serena';
const DEFAULT_SPEED = 1.0;

let currentAudio: HTMLAudioElement | null = null;
let stopped = false;

export function stopSpeech(): void {
  stopped = true;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio.load();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[。！？.!?\n])/g).map((s) => s.trim()).filter(Boolean);
}

async function synthesizeSpeech(text: string, config: TTSConfig): Promise<ArrayBuffer> {
  const url = config.apiUrl.replace(/\/$/, '') + '/v1/audio/speech';
  const body: Record<string, unknown> = {
    model: config.model || 'Qwen3-TTS-12Hz-0.6B-CustomVoice',
    input: text,
    speed: config.speed || DEFAULT_SPEED,
    response_format: 'mp3',
  };

  // Clone mode: use prompt_speech + prompt_text
  if (config.voiceMode === 'clone') {
    if (config.promptSpeech) body.prompt_speech = config.promptSpeech;
    if (config.promptText) body.prompt_text = config.promptText;
  } else {
    // Preset mode: voice is speaker name
    body.voice = config.voice || DEFAULT_VOICE;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`TTS API error (${response.status}): ${errorText}`);
  }
  return response.arrayBuffer();
}

function playAudioBuffer(audioData: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (stopped) { resolve(); return; }
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; reject(new Error('Playback failed')); };
    audio.play().catch((err) => { URL.revokeObjectURL(url); currentAudio = null; reject(err); });
  });
}

async function speakSplitSentences(text: string, config: TTSConfig): Promise<void> {
  stopped = false;
  const sentences = splitSentences(text);
  if (sentences.length === 0) return;
  for (const sentence of sentences) {
    if (stopped) break;
    try {
      const audioData = await synthesizeSpeech(sentence, config);
      if (stopped) break;
      await playAudioBuffer(audioData);
    } catch (err) {
      console.error('[TTS] Sentence failed:', err);
    }
  }
}

function browserSpeak(text: string, config: TTSConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    window.speechSynthesis?.cancel();
    stopped = false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = config.speed || 1.0;
    if (config.voice) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === config.voice || v.lang.includes('zh'));
      if (match) utterance.voice = match;
    }
    utterance.onend = () => { if (!stopped) resolve(); };
    utterance.onerror = (e) => { if (!stopped) reject(e); };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.name === config.voice);
        if (match) utterance.voice = match;
        window.speechSynthesis.speak(utterance);
      };
    } else {
      window.speechSynthesis.speak(utterance);
    }
  });
}

export async function speak(text: string, config: TTSConfig): Promise<void> {
  if (config.engine === 'browser') {
    await browserSpeak(text, config);
  } else {
    await speakSplitSentences(text, config);
  }
}

export function getBrowserVoices(): { name: string; lang: string }[] {
  return window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang }));
}
