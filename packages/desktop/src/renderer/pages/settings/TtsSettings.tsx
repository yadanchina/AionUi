/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '@/common/config/configService';
import { getBrowserVoices } from '@/common/api/tts';
import { Divider, Form, Input, Select, Switch } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';

const PRESET_VOICES = [
  { value: 'serena', label: 'Serena (女声)' },
  { value: 'vivian', label: 'Vivian (女声)' },
  { value: 'ono_anna', label: 'Ono Anna (女声)' },
  { value: 'sohee', label: 'Sohee (女声)' },
  { value: 'aiden', label: 'Aiden (男声)' },
  { value: 'dylan', label: 'Dylan (男声)' },
  { value: 'eric', label: 'Eric (男声)' },
  { value: 'ryan', label: 'Ryan (男声)' },
  { value: 'uncle_fu', label: 'Uncle Fu (男声)' },
];

const TtsSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [engine, setEngine] = useState<'api' | 'browser'>('api');
  const [apiUrl, setApiUrl] = useState('http://127.0.0.1:9997');
  const [apiKey, setApiKey] = useState('');
  const [voice, setVoice] = useState('serena');
  const [speed, setSpeed] = useState(1.0);
  const [model, setModel] = useState('Qwen3-TTS-12Hz-0.6B-CustomVoice');
  const [voiceMode, setVoiceMode] = useState<'preset' | 'clone'>('preset');
  const [promptSpeech, setPromptSpeech] = useState('');
  const [promptText, setPromptText] = useState('');
  const [browserVoices, setBrowserVoices] = useState<{ name: string; lang: string }[]>([]);

  useEffect(() => {
    const voices = getBrowserVoices();
    setBrowserVoices(voices);
    window.speechSynthesis.onvoiceschanged = () => setBrowserVoices(getBrowserVoices());
  }, []);

  useEffect(() => {
    const enabled = configService.get('tts.enabled');
    if (typeof enabled === 'boolean') setEnabled(enabled);
    const eng = configService.get('tts.engine');
    if (eng === 'api' || eng === 'browser') setEngine(eng);
    const url = configService.get('tts.apiUrl');
    if (url) setApiUrl(url);
    const key = configService.get('tts.apiKey');
    if (key) setApiKey(key);
    const voice = configService.get('tts.voice');
    if (voice) setVoice(voice);
    const speed = configService.get('tts.speed');
    if (typeof speed === 'number') setSpeed(speed);
    const model = configService.get('tts.model');
    if (model) setModel(model);
    const mode = configService.get('tts.voiceMode');
    if (mode === 'preset' || mode === 'clone') setVoiceMode(mode);
    const promptSpeech = configService.get('tts.promptSpeech');
    if (promptSpeech) setPromptSpeech(promptSpeech);
    const promptText = configService.get('tts.promptText');
    if (promptText) setPromptText(promptText);
  }, []);

  const save = useCallback((key: string, value: unknown) => {
    configService.set(key as any, value).catch(() => {});
  }, []);

  const isApi = engine === 'api';

  return (
    <div className='space-y-16px'>
      <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
        <div className='flex items-center justify-between gap-12px mb-8px'>
          <div className='flex flex-col gap-4px'>
            <span className='text-14px text-t-primary'>语音合成 (TTS)</span>
            <span className='text-13px text-t-secondary'>将文本转换为语音输出，支持 Xinference API 和浏览器内置引擎</span>
          </div>
          <Switch checked={enabled} onChange={(val) => { setEnabled(val); save('tts.enabled', val); }} />
        </div>

        <Divider className='mt-0px mb-20px' />

        <Form layout='horizontal' labelAlign='left' className='space-y-12px'>
          <Form.Item label='TTS 引擎'>
            <Select value={engine} disabled={!enabled} onChange={(val) => { setEngine(val); save('tts.engine', val); }}>
              <Select.Option value='api'>API (Xinference)</Select.Option>
              <Select.Option value='browser'>浏览器内置</Select.Option>
            </Select>
          </Form.Item>

          {isApi ? (
            <>
              <Form.Item label='API 地址'>
                <Input value={apiUrl} placeholder='http://127.0.0.1:9997' disabled={!enabled}
                  onChange={(val) => { setApiUrl(val); save('tts.apiUrl', val); }} />
              </Form.Item>
              <Form.Item label='API Key'>
                <Input.Password value={apiKey} placeholder='not-needed' visibilityToggle disabled={!enabled}
                  onChange={(val) => { setApiKey(val); save('tts.apiKey', val); }} />
              </Form.Item>
              <Form.Item label='模型'>
                <Input value={model} placeholder='Qwen3-TTS-12Hz-0.6B-CustomVoice' disabled={!enabled}
                  onChange={(val) => { setModel(val); save('tts.model', val); }} />
              </Form.Item>
              <Form.Item label='音色模式'>
                <Select value={voiceMode} disabled={!enabled}
                  onChange={(val) => { setVoiceMode(val); save('tts.voiceMode', val); }}>
                  <Select.Option value='preset'>预设音色</Select.Option>
                  <Select.Option value='clone'>声音克隆</Select.Option>
                </Select>
              </Form.Item>

              {voiceMode === 'preset' && (
                <Form.Item label='语音'>
                  <Select value={voice} disabled={!enabled}
                    onChange={(val) => { setVoice(val); save('tts.voice', val); }}>
                    {PRESET_VOICES.map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              {voiceMode === 'clone' && (
                <>
                  <Form.Item label='参考音频'>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{
                        display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 16px',
                        border: '1px solid var(--color-border-2)', borderRadius: 8,
                        background: 'var(--fill-0)', color: 'var(--text-primary)',
                        fontSize: 13, cursor: enabled ? 'pointer' : 'not-allowed',
                        opacity: enabled ? 1 : 0.5, whiteSpace: 'nowrap',
                      }}>
                        选择文件
                        <input type='file' accept='audio/*' disabled={!enabled} style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              const base64 = (reader.result as string).split(',')[1];
                              setPromptSpeech(base64);
                              save('tts.promptSpeech', base64);
                            };
                            reader.readAsDataURL(file);
                          }} />
                      </label>
                      {promptSpeech && promptSpeech.length > 200 && (
                        <span style={{ fontSize: 12, color: 'var(--color-primary)' }}>已上传</span>
                      )}
                    </div>
                  </Form.Item>
                  <Form.Item label='参考文本'>
                    <Input value={promptText} placeholder='参考音频对应的文本内容' disabled={!enabled}
                      onChange={(val) => { setPromptText(val); save('tts.promptText', val); }} />
                  </Form.Item>
                </>
              )}
            </>
          ) : (
            <Form.Item label='语音'>
              <Select value={voice} disabled={!enabled}
                onChange={(val) => { setVoice(val); save('tts.voice', val); }}>
                {browserVoices.map((v) => (
                  <Select.Option key={v.name} value={v.name}>{v.name} ({v.lang})</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item label={`语速 (${speed}x)`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type='range' min='0.25' max='4.0' step='0.25' value={speed} disabled={!enabled}
                onChange={(e) => { const val = parseFloat(e.target.value); setSpeed(val); save('tts.speed', val); }}
                style={{ width: 160, accentColor: 'var(--color-primary)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{speed}x</span>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default TtsSettings;
