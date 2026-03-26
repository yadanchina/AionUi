/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { VOSK_MODEL_ARCHIVE_ROUTE } from '@/common/config/voice';
import { downloadModelArchive } from './modelArchive';
import type { IVoiceService, TranscriptEvent, VoiceStartResult, VoiceStopResult } from './types';

/** URL the renderer fetches the Vosk model tar.gz from (served by the web server). */
const MODEL_URL = VOSK_MODEL_ARCHIVE_ROUTE;
const TARGET_SAMPLE_RATE = 16000;

/** Buffer size for ScriptProcessorNode — 4096 samples @ 16 kHz ≈ 256 ms per chunk. */
const PROCESSOR_BUFFER_SIZE = 4096;

/**
 * Voice service for Web (browser) mode.
 * Uses vosk-browser (WebAssembly) for fully offline, client-side speech recognition.
 * The Vosk model is downloaded from the web server on first use and cached in IndexedDB.
 *
 * Audio pipeline:
 *   getUserMedia → AudioContext(16 kHz) → ScriptProcessorNode → KaldiRecognizer
 *
 * Note: ScriptProcessorNode is deprecated in favour of AudioWorklet but is still
 * universally supported and avoids the need for a separate Worklet module file.
 */
export class WebVoiceService implements IVoiceService {
  private model: Awaited<ReturnType<typeof import('vosk-browser').createModel>> | null = null;
  private recognizer: { remove(): void } | null = null;
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private processor: ScriptProcessorNode | null = null;
  private readonly listeners = new Set<(event: TranscriptEvent) => void>();

  private emit(event: TranscriptEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  onTranscript(listener: (event: TranscriptEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(_opts?: { modelPath?: string }): Promise<VoiceStartResult> {
    try {
      // Request microphone access first so any permission error surfaces clearly.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.stream = stream;

      // Lazily load and cache the Vosk model (IndexedDB cache after first download).
      if (!this.model) {
        console.log('[WebVoiceService] Loading vosk-browser...');
        const { createModel } = await import('vosk-browser');
        console.log('[WebVoiceService] Downloading model from:', MODEL_URL);
        const archive = await downloadModelArchive(MODEL_URL);
        console.log('[WebVoiceService] Model archive downloaded:', {
          size: archive.size,
          contentType: archive.contentType,
          contentEncoding: archive.contentEncoding,
        });
        try {
          this.model = await createModel(archive.objectUrl);
        } finally {
          URL.revokeObjectURL(archive.objectUrl);
        }
        console.log('[WebVoiceService] Model loaded successfully');
      }

      // Build audio graph.
      const audioCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      this.audioCtx = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      // Build recognizer and wire events with the effective AudioContext rate.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = new (this.model as any).KaldiRecognizer(audioCtx.sampleRate);
      rec.on('result', (msg: { result: { text: string } }) => {
        const text = msg.result?.text?.trim();
        if (text) this.emit({ text, isFinal: true });
      });
      rec.on('partialresult', (msg: { result: { partial: string } }) => {
        const text = msg.result?.partial?.trim();
        if (text) this.emit({ text, isFinal: false });
      });
      this.recognizer = rec;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = audioCtx.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (rec as any).acceptWaveform(e.inputBuffer);
        } catch (error) {
          console.error('[WebVoiceService] acceptWaveform failed:', error);
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
      this.processor = processor;

      return { success: true };
    } catch (error) {
      await this.cleanup();
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Voice input failed',
      };
    }
  }

  async stop(): Promise<VoiceStopResult> {
    await this.cleanup();
    return { success: true };
  }

  private async cleanup(): Promise<void> {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.audioCtx) {
      await this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.recognizer) {
      try {
        (this.recognizer as { remove(): void }).remove();
      } catch {
        // ignore
      }
      this.recognizer = null;
    }
  }
}
