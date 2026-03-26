/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadModelArchive } from '@renderer/services/voice/modelArchive';

describe('downloadModelArchive', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns an object URL when the response is a gzip archive', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([0x1f, 0x8b, 0x08, 0x00]), {
        status: 200,
        headers: { 'Content-Type': 'application/gzip' },
      })
    );
    const createObjectURL = vi.fn().mockReturnValue('blob:vosk-model');

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });

    const archive = await downloadModelArchive('/api/vosk-model.tar.gz');

    expect(fetchMock).toHaveBeenCalledWith('/api/vosk-model.tar.gz', { cache: 'no-store' });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(archive).toMatchObject({
      objectUrl: 'blob:vosk-model',
      size: 4,
      contentType: 'application/gzip',
      contentEncoding: null,
    });
  });

  it('rejects non-gzip responses with a preview of the unexpected payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'not found' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    });

    await expect(downloadModelArchive('/api/vosk-model.tar.gz')).rejects.toThrow(
      'Invalid Vosk model archive response'
    );
  });
});
