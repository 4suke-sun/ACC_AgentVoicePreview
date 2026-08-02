import { describe, expect, it } from 'vitest';
import {
  buttonStates,
  INITIAL_STATE,
  type PreviewEvent,
  type PreviewState,
  reduce,
  statusLabel,
} from '../src/state';

function run(events: PreviewEvent[], from: PreviewState = INITIAL_STATE): PreviewState {
  let state = from;
  for (const event of events) {
    const next = reduce(state, event);
    if (next !== null) state = next;
  }
  return state;
}

describe('reduce: 正常系(memo.txt 6.3)', () => {
  it('IDLE → STARTING → CONNECTING → PLAYING → COMPLETED → IDLE', () => {
    let state = run([{ type: 'PLAY_REQUESTED' }]);
    expect(state.status).toBe('STARTING');

    state = run([{ type: 'START_SUCCEEDED', contactId: 'contact-1' }], state);
    expect(state).toEqual({ status: 'CONNECTING', contactId: 'contact-1' });

    state = run([{ type: 'CONNECTED' }], state);
    expect(state).toEqual({ status: 'PLAYING', contactId: 'contact-1' });

    state = run([{ type: 'PLAYBACK_ENDED' }], state);
    expect(state.status).toBe('COMPLETED');

    state = run([{ type: 'RESET' }], state);
    expect(state.status).toBe('IDLE');
  });

  it('短い文章ではCONNECTING中に再生終了してもCOMPLETEDになる', () => {
    const state = run([
      { type: 'PLAY_REQUESTED' },
      { type: 'START_SUCCEEDED', contactId: 'c' },
      { type: 'PLAYBACK_ENDED' },
    ]);
    expect(state.status).toBe('COMPLETED');
  });
});

describe('reduce: エラー系(memo.txt 6.3)', () => {
  it('STARTING でAPI失敗 → ERROR → 確認後 IDLE', () => {
    let state = run([{ type: 'PLAY_REQUESTED' }, { type: 'START_FAILED', message: '失敗' }]);
    expect(state).toEqual({ status: 'ERROR', errorMessage: '失敗' });

    state = run([{ type: 'RESET' }], state);
    expect(state.status).toBe('IDLE');
  });

  it('PLAYING でWebRTCエラー → ERROR', () => {
    const state = run([
      { type: 'PLAY_REQUESTED' },
      { type: 'START_SUCCEEDED', contactId: 'c' },
      { type: 'CONNECTED' },
      { type: 'CONNECTION_FAILED', message: '接続断' },
    ]);
    expect(state.status).toBe('ERROR');
    expect(state.contactId).toBe('c');
  });
});

describe('reduce: 停止系(memo.txt 6.3)', () => {
  it('PLAYING → STOPPING → IDLE', () => {
    let state = run([
      { type: 'PLAY_REQUESTED' },
      { type: 'START_SUCCEEDED', contactId: 'c' },
      { type: 'CONNECTED' },
      { type: 'STOP_REQUESTED' },
    ]);
    expect(state).toEqual({ status: 'STOPPING', contactId: 'c' });

    state = run([{ type: 'STOP_FINISHED' }], state);
    expect(state.status).toBe('IDLE');
  });

  it('STOPPING中の切断イベントは無視する', () => {
    const state: PreviewState = { status: 'STOPPING', contactId: 'c' };
    expect(reduce(state, { type: 'PLAYBACK_ENDED' })).toBeNull();
  });
});

describe('reduce: 不正な遷移を拒否する', () => {
  it('IDLE以外でのPLAY_REQUESTEDは無視する(連打対策, memo.txt 6.5)', () => {
    for (const status of ['STARTING', 'CONNECTING', 'PLAYING', 'STOPPING'] as const) {
      expect(reduce({ status }, { type: 'PLAY_REQUESTED' })).toBeNull();
    }
  });

  it('IDLEでの停止・完了イベントは無視する', () => {
    for (const event of [
      { type: 'STOP_REQUESTED' },
      { type: 'PLAYBACK_ENDED' },
      { type: 'STOP_FINISHED' },
      { type: 'CONNECTED' },
    ] as PreviewEvent[]) {
      expect(reduce(INITIAL_STATE, event)).toBeNull();
    }
  });
});

describe('buttonStates(memo.txt 6.5)', () => {
  it('処理中は再生ボタンを無効化する', () => {
    for (const status of ['STARTING', 'CONNECTING', 'PLAYING', 'STOPPING'] as const) {
      expect(buttonStates(status).playEnabled).toBe(false);
    }
  });

  it('再生中と接続中のみ停止ボタンを有効化する', () => {
    expect(buttonStates('CONNECTING').stopEnabled).toBe(true);
    expect(buttonStates('PLAYING').stopEnabled).toBe(true);
    for (const status of ['IDLE', 'STARTING', 'STOPPING', 'COMPLETED', 'ERROR'] as const) {
      expect(buttonStates(status).stopEnabled).toBe(false);
    }
  });
});

describe('statusLabel', () => {
  it('全ステータスに日本語ラベルがある', () => {
    for (const status of [
      'IDLE',
      'STARTING',
      'CONNECTING',
      'PLAYING',
      'STOPPING',
      'COMPLETED',
      'ERROR',
    ] as const) {
      expect(statusLabel(status)).not.toBe('');
    }
  });
});
