import { describe, expect, it } from 'vitest';
import { findVoice, PREVIEW_VOICES } from '../src/voices';

describe('PREVIEW_VOICES', () => {
  it('1件以上定義されている', () => {
    expect(PREVIEW_VOICES.length).toBeGreaterThan(0);
  });

  it('論理IDが重複していない', () => {
    const ids = PREVIEW_VOICES.map((voice) => voice.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全項目が空でない', () => {
    for (const voice of PREVIEW_VOICES) {
      expect(voice.id).not.toBe('');
      expect(voice.displayName).not.toBe('');
      expect(voice.connectVoiceId).not.toBe('');
      expect(voice.locale).not.toBe('');
    }
  });

  it('論理IDは英数字とハイフンのみ(コンタクト属性・構築IDで安全に使える形式)', () => {
    for (const voice of PREVIEW_VOICES) {
      expect(voice.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('findVoice', () => {
  it('存在するIDで音声を返す', () => {
    const first = PREVIEW_VOICES[0];
    expect(findVoice(first?.id ?? '')).toEqual(first);
  });

  it('存在しないIDで undefined を返す', () => {
    expect(findVoice('no-such-voice')).toBeUndefined();
  });
});
