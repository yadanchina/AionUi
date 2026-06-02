/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { configService } from '@/common/config/configService';
import type { SpeechToTextConfig } from '@/common/types/provider/speech';
import type { SpeechToTextResult } from '@/common/types/provider/speech';
import { isElectronDesktop } from '@/renderer/utils/platform';

const MAX_AUDIO_FILE_SIZE_MB = 30;
const MAX_AUDIO_FILE_SIZE_BYTES = MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024;

const getAudioExtension = (mimeType: string) => {
  switch (mimeType) {
    case 'audio/mp4': case 'audio/x-m4a': return 'm4a';
    case 'audio/mpeg': return 'mp3';
    case 'audio/ogg': case 'audio/ogg;codecs=opus': return 'ogg';
    case 'audio/wav': case 'audio/wave': return 'wav';
    default: return 'webm';
  }
};

const createAudioFileName = (mimeType: string) => `speech-input.${getAudioExtension(mimeType)}`;

const ensureAudioSize = (blob: Blob) => {
  if (blob.size > MAX_AUDIO_FILE_SIZE_BYTES) throw new Error('STT_FILE_TOO_LARGE');
};

const parseWebResponse = async (response: XMLHttpRequest): Promise<SpeechToTextResult> => {
  const payload = JSON.parse(response.responseText) as { data?: SpeechToTextResult; msg?: string; success: boolean };
  if (!payload.success || !payload.data) throw new Error(payload.msg || 'STT_REQUEST_FAILED');
  return payload.data;
};

async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioContext.close();
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(wavBuffer);
  const ws = (o: number, s: string) => { for (let i=0;i<s.length;i++) view.setUint8(o+i,s.charCodeAt(i)); };
  ws(0,'RIFF'); view.setUint32(4,36+length*numChannels*2,true);
  ws(8,'WAVE'); ws(12,'fmt '); view.setUint32(16,16,true);
  view.setUint16(20,1,true); view.setUint16(22,numChannels,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*numChannels*2,true);
  view.setUint16(32,numChannels*2,true); view.setUint16(34,16,true);
  ws(36,'data'); view.setUint32(40,length*numChannels*2,true);
  let off = 44;
  for (let i=0;i<length;i++) for (let c=0;c<numChannels;c++) {
    const s = Math.max(-1,Math.min(1,audioBuffer.getChannelData(c)[i]));
    view.setInt16(off, s<0?s*0x8000:s*0x7FFF, true); off+=2;
  }
  return new Blob([wavBuffer],{type:'audio/wav'});
}

async function transcribeViaOpenAI(blob: Blob, config: SpeechToTextConfig): Promise<SpeechToTextResult> {
  const openaiConfig = config.openai;
  if (!openaiConfig?.api_key) throw new Error('STT_OPENAI_NOT_CONFIGURED');

  const baseUrl = openaiConfig.base_url || 'https://api.openai.com/v1';
  const url = baseUrl.replace(/\/+$/, '') + '/audio/transcriptions';

  const formData = new FormData();
  formData.append('file', blob, 'audio.wav');
  formData.append('model', openaiConfig.model || 'whisper-1');
  formData.append('response_format', 'json');
  if (openaiConfig.language) formData.append('language', openaiConfig.language);
  if (openaiConfig.prompt) formData.append('prompt', openaiConfig.prompt);
  if (openaiConfig.temperature !== undefined) formData.append('temperature', String(openaiConfig.temperature));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiConfig.api_key}` },
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`STT_REQUEST_FAILED:${response.status} ${errBody}`);
  }

  const data = await response.json() as { text: string; language?: string };
  return {
    text: data.text,
    model: openaiConfig.model || 'whisper-1',
    provider: 'openai',
    language: data.language,
  };
}

async function transcribeViaDeepgram(blob: Blob, config: SpeechToTextConfig): Promise<SpeechToTextResult> {
  const deepgramConfig = config.deepgram;
  if (!deepgramConfig?.api_key) throw new Error('STT_DEEPGRAM_NOT_CONFIGURED');

  const baseUrl = deepgramConfig.base_url || 'https://api.deepgram.com/v1';
  const url = baseUrl.replace(/\/+$/, '') + '/listen';

  const params = new URLSearchParams();
  if (!deepgramConfig.detectLanguage && deepgramConfig.language) params.append('language', deepgramConfig.language);
  if (deepgramConfig.detectLanguage) params.append('detect_language', 'true');
  if (deepgramConfig.punctuate !== undefined) params.append('punctuate', String(deepgramConfig.punctuate));
  if (deepgramConfig.smartFormat !== undefined) params.append('smart_format', String(deepgramConfig.smartFormat));
  params.append('model', deepgramConfig.model || 'nova-2');

  const fullUrl = url + '?' + params.toString();

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${deepgramConfig.api_key}`,
      'Content-Type': blob.type || 'audio/wav',
    },
    body: blob,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`STT_REQUEST_FAILED:${response.status} ${errBody}`);
  }

  const data = await response.json() as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript: string }> }> };
  };

  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  return {
    text: transcript,
    model: deepgramConfig.model || 'nova-2',
    provider: 'deepgram',
  };
}

const getSttConfig = async (): Promise<SpeechToTextConfig | undefined> => {
  try {
    return await configService.get('tools.speechToText');
  } catch {
    return undefined;
  }
};

export async function transcribeAudioBlob(blob: Blob, languageHint?: string): Promise<SpeechToTextResult> {
  ensureAudioSize(blob);

  let audioBlob = blob;
  if (blob.type.startsWith('audio/webm') || blob.type.startsWith('audio/ogg')) {
    try { audioBlob = await convertToWav(blob); } catch (e) { console.warn('[STT] convert failed:', e); }
  }
  const mimeType = audioBlob.type || 'audio/wav';
  const file_name = createAudioFileName(mimeType);

  const sttConfig = await getSttConfig();
  if (sttConfig?.enabled && sttConfig.mode === 'frontend') {
    if (sttConfig.provider === 'deepgram') {
      return transcribeViaDeepgram(audioBlob, sttConfig);
    }
    return transcribeViaOpenAI(audioBlob, sttConfig);
  }

  if (isElectronDesktop()) {
    const audioBuffer = new Uint8Array(await audioBlob.arrayBuffer());
    return ipcBridge.speechToText.transcribe.invoke({
      audioBuffer: Array.from(audioBuffer),
      file_name,
      languageHint,
      mimeType,
    });
  }
  const formData = new FormData();
  formData.append('audio', audioBlob, file_name);
  formData.append('mimeType', mimeType);
  if (languageHint) formData.append('languageHint', languageHint);
  return new Promise<SpeechToTextResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/stt');
    xhr.withCredentials = true;
    xhr.addEventListener('load', () => {
      if (xhr.status===413) { reject(new Error('STT_FILE_TOO_LARGE')); return; }
      if (xhr.status<200||xhr.status>=300) { reject(new Error(`STT_REQUEST_FAILED:${xhr.status} ${xhr.statusText}`)); return; }
      parseWebResponse(xhr).then(resolve).catch(reject);
    });
    xhr.addEventListener('error', () => reject(new Error('STT_NETWORK_ERROR')));
    xhr.addEventListener('abort', () => reject(new Error('STT_ABORTED')));
    xhr.send(formData);
  });
}
