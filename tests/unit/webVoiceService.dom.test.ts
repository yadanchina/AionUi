/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebVoiceService } from '@renderer/services/voice/WebVoiceService';

type MockRecognizer = {
  acceptWaveform: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

type MockMediaStreamTrack = {
  stop: ReturnType<typeof vi.fn>;
};

type MockMediaStream = {
  getTracks: ReturnType<typeof vi.fn>;
};

type MockAudioNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect?: ReturnType<typeof vi.fn>;
};

type MockAudioContextInstance = {
  close: ReturnType<typeof vi.fn>;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createScriptProcessor: ReturnType<typeof vi.fn>;
  destination: Record<string, never>;
  sampleRate: number;
};

const audioContextInstances: MockAudioContextInstance[] = [];

class AudioContextMock {
  close = vi.fn().mockResolvedValue(undefined);
  createMediaStreamSource = vi.fn();
  createScriptProcessor = vi.fn();
  destination = {};
  sampleRate = 22050;

  constructor(_options?: AudioContextOptions) {
    const source: MockAudioNode = {
      connect: vi.fn(),
    };
    const processor: MockAudioNode & {
      onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
    } = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };

    this.createMediaStreamSource.mockReturnValue(source);
    this.createScriptProcessor.mockReturnValue(processor);
    audioContextInstances.push(this as unknown as MockAudioContextInstance);
  }
}

describe('WebVoiceService', () => {
  beforeEach(() => {
    audioContextInstances.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should construct the recognizer with the effective audio context sample rate', async () => {
    const track: MockMediaStreamTrack = {
      stop: vi.fn(),
    };
    const stream: MockMediaStream = {
      getTracks: vi.fn(() => [track]),
    };
    const recognizer: MockRecognizer = {
      acceptWaveform: vi.fn(),
      on: vi.fn(),
      remove: vi.fn(),
    };
    const kaldiRecognizer = vi.fn(function (_sampleRate: number) {
      return recognizer;
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });
    vi.stubGlobal('AudioContext', AudioContextMock);

    const service = new WebVoiceService();
    (
      service as unknown as {
        model: {
          KaldiRecognizer: typeof kaldiRecognizer;
        };
      }
    ).model = {
      KaldiRecognizer: kaldiRecognizer,
    };

    const result = await service.start();

    expect(result).toEqual({ success: true });
    expect(kaldiRecognizer).toHaveBeenCalledWith(22050);

    await service.stop();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(recognizer.remove).toHaveBeenCalledOnce();
  });

  it('should return a failed result when recognizer creation throws', async () => {
    const track: MockMediaStreamTrack = {
      stop: vi.fn(),
    };
    const stream: MockMediaStream = {
      getTracks: vi.fn(() => [track]),
    };
    const kaldiRecognizer = vi.fn(function () {
      throw new Error('bad recognizer');
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });
    vi.stubGlobal('AudioContext', AudioContextMock);

    const service = new WebVoiceService();
    (
      service as unknown as {
        model: {
          KaldiRecognizer: typeof kaldiRecognizer;
        };
      }
    ).model = {
      KaldiRecognizer: kaldiRecognizer,
    };

    const result = await service.start();

    expect(result).toEqual({
      success: false,
      msg: 'bad recognizer',
    });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(audioContextInstances).toHaveLength(1);
    expect(audioContextInstances[0].close).toHaveBeenCalledOnce();
  });
});
