/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs, { accessSync, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getEnhancedEnv } from '@process/utils/shellEnv';

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

  private formatPythonSpawnError(error: NodeJS.ErrnoException, pythonBin: string): string {
    const configuredPython = process.env.AIONUI_PYTHON_PATH;
    const targetHint = configuredPython || pythonBin;

    if (error.code === 'ENOENT') {
      if (configuredPython) {
        return `Configured Python not found: ${targetHint}`;
      }
      return process.platform === 'win32'
        ? 'System Python not found. Please install Python and ensure `python` is available in PATH.'
        : 'System Python not found. Please install Python 3 and ensure `python3` is available in PATH.';
    }

    if (error.code === 'EACCES') {
      if (configuredPython) {
        return `Configured Python is not executable: ${targetHint}`;
      }
      return process.platform === 'win32'
        ? 'System Python is not executable. Please verify the `python` command in PATH.'
        : 'System Python 3 is not executable. Please verify the `python3` command in PATH.';
    }

    return `voice process start failed: ${error.message}`;
  }

  private isExecutableFile(candidate: string): boolean {
    try {
      accessSync(candidate, fsConstants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  private findCommandInPath(command: string, envPath?: string): string | null {
    if (!envPath) return null;

    const pathEntries = envPath.split(path.delimiter).filter(Boolean);
    for (const entry of pathEntries) {
      const candidate = path.join(entry, command);
      if (this.isExecutableFile(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private resolvePythonExecutable(envPath?: string): string {
    const envPythonPath = process.env.AIONUI_PYTHON_PATH;
    if (envPythonPath) {
      return envPythonPath;
    }

    if (process.platform === 'win32') {
      return 'python';
    }

    const candidates = [
      'python3',
      'python',
      path.join(process.env.HOME || '', '.local', 'bin', 'python3'),
      path.join(process.env.HOME || '', '.pyenv', 'shims', 'python3'),
      path.join(process.env.HOME || '', '.pyenv', 'shims', 'python'),
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      '/bin/python3',
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (path.isAbsolute(candidate) && this.isExecutableFile(candidate)) {
        return candidate;
      }
      const resolved = this.findCommandInPath(candidate, envPath);
      if (resolved) {
        return resolved;
      }
    }

    return 'python3';
  }

  private formatVoiceRuntimeError(message: string, pythonBin: string): string {
    if (process.platform === 'linux') {
      if (message.includes('python deps missing:')) {
        if (message.includes('No module named')) {
          return `Voice Python dependencies are missing for ${pythonBin}. Install scripts/voice/requirements.txt into the same Python environment.`;
        }
        if (message.includes('PortAudio') || message.includes('libportaudio')) {
          return `Voice Python dependencies are incomplete for ${pythonBin}. Install PortAudio system libraries, for example: sudo apt install portaudio19-dev libportaudio2.`;
        }
      }

      if (
        message.includes('audio stream failed:') &&
        (message.includes('PortAudio') || message.includes('Error querying device'))
      ) {
        return 'Linux audio input initialization failed. Verify microphone access and install PortAudio runtime libraries such as `libportaudio2`.';
      }
    }

    return message;
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
    const env = getEnhancedEnv({
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    });
    const pythonBin = this.resolvePythonExecutable(env.PATH);
    const scriptPath = this.resolveScriptPath();

    this.stdoutBuffer = '';
    this.child = spawn(pythonBin, [scriptPath, '--model', modelPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env,
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
            this.emit({ error: this.formatVoiceRuntimeError(payload.error || 'voice input failed', pythonBin) });
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
      this.emit({ error: this.formatVoiceRuntimeError(msg, pythonBin) });
    });

    this.child.on('exit', (code) => {
      this.running = false;
      this.child = null;
      if (code !== 0 && code !== null) {
        this.emit({ error: `voice process exited with code ${code}` });
      }
    });
    this.child.on('error', (error: NodeJS.ErrnoException) => {
      this.running = false;
      this.child = null;
      this.emit({ error: this.formatPythonSpawnError(error, pythonBin) });
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
