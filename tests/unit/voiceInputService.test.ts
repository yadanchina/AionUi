/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('voiceInputService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns actionable Linux dependency guidance for missing Python modules', async () => {
    vi.doMock('electron', () => ({
      app: {
        isPackaged: true,
        getPath: vi.fn(() => '/tmp/userdata'),
      },
    }));

    Object.defineProperty(process, 'platform', { value: 'linux' });

    const { voiceInputService } = await import('@process/services/voiceInputService');
    const formattedMessage = (voiceInputService as any).formatVoiceRuntimeError(
      'python deps missing: No module named sounddevice',
      '/opt/venv/bin/python3'
    );

    expect(formattedMessage).toContain('Install scripts/voice/requirements.txt into the same Python environment');
  });
});
