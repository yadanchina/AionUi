/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

const GZIP_MAGIC_BYTE_0 = 0x1f;
const GZIP_MAGIC_BYTE_1 = 0x8b;
const RESPONSE_PREVIEW_BYTES = 96;

export type DownloadedModelArchive = {
  objectUrl: string;
  size: number;
  contentType: string | null;
  contentEncoding: string | null;
};

function previewArchiveResponse(bytes: Uint8Array): string {
  const preview = bytes.slice(0, RESPONSE_PREVIEW_BYTES);
  return new TextDecoder()
    .decode(preview)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, RESPONSE_PREVIEW_BYTES);
}

function isGzipArchive(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC_BYTE_0 && bytes[1] === GZIP_MAGIC_BYTE_1;
}

export async function downloadModelArchive(url: string): Promise<DownloadedModelArchive> {
  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to download Vosk model archive: HTTP ${response.status} ${response.statusText}`.trim());
  }

  const contentType = response.headers.get('content-type');
  const contentEncoding = response.headers.get('content-encoding');
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!isGzipArchive(bytes)) {
    const preview = previewArchiveResponse(bytes);
    throw new Error(
      `Invalid Vosk model archive response from ${url}. content-type=${contentType ?? 'unknown'} content-encoding=${
        contentEncoding ?? 'none'
      } preview="${preview}"`
    );
  }

  return {
    objectUrl: URL.createObjectURL(new Blob([bytes], { type: 'application/gzip' })),
    size: bytes.byteLength,
    contentType,
    contentEncoding,
  };
}
