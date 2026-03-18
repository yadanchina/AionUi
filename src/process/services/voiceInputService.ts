/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

type TranscriptEvent = { text?: string; isFinal?: boolean; error?: string };
type StartOptions = { modelPath?: string };

class VoiceInputService {
  private running = false;
  private child: ChildProcessWithoutNullStreams | null = null;
  private modelPathInUse = '';
  private listeners = new Set<(event: TranscriptEvent) => void>();
  private stdoutBuffer = '';

  private emit(event: TranscriptEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  onTranscript(listener: (event: TranscriptEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private normalizeModelRoot(candidate: string): string | null {
    if (!fs.existsSync(candidate)) return null;
    const directModelFile = path.join(candidate, 'am', 'final.mdl');
    if (fs.existsSync(directModelFile)) return candidate;

    const entries = fs.readdirSync(candidate, { withFileTypes: true });
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    if (dirs.length === 1) {
      const nested = path.join(candidate, dirs[0]);
      const nestedModelFile = path.join(nested, 'am', 'final.mdl');
      if (fs.existsSync(nestedModelFile)) return nested;
    }
    return null;
  }

  private findFirstExistingPath(candidates: string[]): string | null {
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private resolvePythonExecutable(): string {
    const envPythonPath = process.env.AIONUI_PYTHON_PATH;
    if (envPythonPath) {
      return envPythonPath;
    }

    const isWindows = process.platform === 'win32';
    const pythonRelativeCandidates = isWindows
      ? ['python/python.exe', 'python.exe']
      : ['python/bin/python3', 'python/bin/python', 'python3', 'python'];

    const runtimeRoots = app.isPackaged
      ? [process.resourcesPath]
      : [path.join(process.cwd(), 'resources'), process.resourcesPath];
    const absoluteCandidates = runtimeRoots.flatMap((root) =>
      pythonRelativeCandidates.map((relativePath) => path.join(root, relativePath))
    );
    const embeddedPython = this.findFirstExistingPath(absoluteCandidates);
    if (embeddedPython) {
      return embeddedPython;
    }

    return isWindows ? 'python' : 'python3';
  }

  private resolveScriptPath(): string {
    const scriptRelativePath = path.join('voice', 'vosk_stt.py');
    const candidates = app.isPackaged
      ? [path.join(process.resourcesPath, scriptRelativePath)]
      : [path.join(process.cwd(), 'scripts', scriptRelativePath), path.join(process.resourcesPath, scriptRelativePath)];

    const scriptPath = this.findFirstExistingPath(candidates);
    if (scriptPath) {
      return scriptPath;
    }

    throw new Error('Voice script not found. Ensure scripts/voice/vosk_stt.py is bundled to resources/voice.');
  }

  private resolveModelPath(explicitPath?: string): string {
    const candidates = [
      explicitPath,
      process.env.AIONUI_VOSK_MODEL_PATH,
      app.isPackaged
        ? path.join(process.resourcesPath, 'vosk-model')
        : path.join(process.cwd(), 'resources', 'vosk-model'),
      path.join(app.getPath('userData'), 'models', 'vosk-model'),
      path.join(process.cwd(), 'models', 'vosk-model'),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      const resolved = this.normalizeModelRoot(candidate);
      if (resolved) return resolved;
    }
    throw new Error('Vosk model not found. Set AIONUI_VOSK_MODEL_PATH or put model under resources/vosk-model');
  }

  async start(options: StartOptions): Promise<{ running: boolean; modelPath?: string }> {
    if (this.running) {
      return { running: true, modelPath: this.modelPathInUse };
    }

    const modelPath = this.resolveModelPath(options.modelPath);
    const pythonBin = this.resolvePythonExecutable();
    const scriptPath = this.resolveScriptPath();

    this.stdoutBuffer = '';
    this.child = spawn(pythonBin, [scriptPath, '--model', modelPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    this.child.stdout.on('data', (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString('utf-8');
      const lines = this.stdoutBuffer.split('\n');
      this.stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        const text = line.trim();
        if (!text) continue;
        try {
          const payload = JSON.parse(text) as { type?: string; text?: string; error?: string };
          if (payload.type === 'info') {
            continue;
          }
          if (payload.type === 'error') {
            this.emit({ error: payload.error || 'voice input failed' });
            void this.stop();
            return;
          }
          if ((payload.type === 'final' || payload.type === 'partial') && payload.text?.trim()) {
            this.emit({ text: payload.text.trim(), isFinal: payload.type === 'final' });
          }
        } catch {
          // ignore non-json logs
        }
      }
    });

    this.child.stderr.on('data', (chunk: Buffer) => {
      const msg = chunk.toString('utf-8').trim();
      if (!msg) return;
      this.emit({ error: msg });
    });

    this.child.on('exit', (code) => {
      this.running = false;
      this.child = null;
      if (code !== 0 && code !== null) {
        this.emit({ error: `voice process exited with code ${code}` });
      }
    });
    this.child.on('error', (error: Error) => {
      this.running = false;
      this.child = null;
      this.emit({ error: `voice process start failed: ${error.message}` });
    });

    this.running = true;
    this.modelPathInUse = modelPath;
    return { running: true, modelPath };
  }

  async stop(): Promise<{ running: boolean }> {
    if (!this.running) return { running: false };
    this.running = false;
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
    return { running: false };
  }
}

export const voiceInputService = new VoiceInputService();
