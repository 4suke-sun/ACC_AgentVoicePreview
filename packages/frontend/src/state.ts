/**
 * 画面ステータスの状態遷移(memo.txt 6.3)。
 * 純粋関数として実装し、DOMやAPIから独立してテストできるようにする。
 */

export type PreviewStatus =
  | 'IDLE'
  | 'STARTING'
  | 'CONNECTING'
  | 'PLAYING'
  | 'STOPPING'
  | 'COMPLETED'
  | 'ERROR';

export interface PreviewState {
  status: PreviewStatus;
  contactId?: string;
  errorMessage?: string;
}

export type PreviewEvent =
  | { type: 'PLAY_REQUESTED' }
  | { type: 'START_SUCCEEDED'; contactId: string }
  | { type: 'START_FAILED'; message: string }
  | { type: 'CONNECTED' }
  | { type: 'CONNECTION_FAILED'; message: string }
  | { type: 'PLAYBACK_ENDED' }
  | { type: 'STOP_REQUESTED' }
  | { type: 'STOP_FINISHED' }
  | { type: 'RESET' };

export const INITIAL_STATE: PreviewState = { status: 'IDLE' };

/**
 * 状態遷移。定義外の遷移は null を返し、呼び出し側で無視する
 * (例: 停止処理中に切断イベントが届いた場合など)。
 */
export function reduce(state: PreviewState, event: PreviewEvent): PreviewState | null {
  switch (event.type) {
    case 'PLAY_REQUESTED':
      return state.status === 'IDLE' ? { status: 'STARTING' } : null;

    case 'START_SUCCEEDED':
      return state.status === 'STARTING'
        ? { status: 'CONNECTING', contactId: event.contactId }
        : null;

    case 'START_FAILED':
      return state.status === 'STARTING' ? { status: 'ERROR', errorMessage: event.message } : null;

    case 'CONNECTED':
      return state.status === 'CONNECTING'
        ? { status: 'PLAYING', contactId: state.contactId }
        : null;

    case 'CONNECTION_FAILED':
      return state.status === 'CONNECTING' || state.status === 'PLAYING'
        ? { status: 'ERROR', contactId: state.contactId, errorMessage: event.message }
        : null;

    case 'PLAYBACK_ENDED':
      // 短い文章では CONNECTED の通知前に再生が終わることがある
      return state.status === 'CONNECTING' || state.status === 'PLAYING'
        ? { status: 'COMPLETED' }
        : null;

    case 'STOP_REQUESTED':
      return state.status === 'CONNECTING' || state.status === 'PLAYING'
        ? { status: 'STOPPING', contactId: state.contactId }
        : null;

    case 'STOP_FINISHED':
      return state.status === 'STOPPING' ? { status: 'IDLE' } : null;

    case 'RESET':
      return state.status === 'COMPLETED' || state.status === 'ERROR' ? { status: 'IDLE' } : null;

    default:
      return null;
  }
}

export function statusLabel(status: PreviewStatus): string {
  switch (status) {
    case 'IDLE':
      return '待機中';
    case 'STARTING':
      return '開始中';
    case 'CONNECTING':
      return '接続中';
    case 'PLAYING':
      return '再生中';
    case 'STOPPING':
      return '停止中';
    case 'COMPLETED':
      return '完了';
    case 'ERROR':
      return 'エラー';
  }
}

/** 連続クリック対策(memo.txt 6.5): 処理中は再生ボタンを無効化する */
export function buttonStates(status: PreviewStatus): {
  playEnabled: boolean;
  stopEnabled: boolean;
} {
  return {
    playEnabled: status === 'IDLE' || status === 'COMPLETED' || status === 'ERROR',
    stopEnabled: status === 'CONNECTING' || status === 'PLAYING',
  };
}
