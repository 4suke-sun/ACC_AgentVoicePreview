import { countTextLength, MAX_TEXT_LENGTH, validatePreviewText } from '@avp/shared';
import { ApiClient, ApiError } from './api';
import { PreviewAudioSession } from './audio';
import { loadConfig } from './config';
import {
  buttonStates,
  INITIAL_STATE,
  type PreviewEvent,
  type PreviewState,
  reduce,
  statusLabel,
} from './state';

function mustGet<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`要素が見つかりません: ${selector}`);
  }
  return element;
}

const voiceSelect = mustGet<HTMLSelectElement>('#voice-select');
const textArea = mustGet<HTMLTextAreaElement>('#preview-text');
const charCount = mustGet<HTMLSpanElement>('#char-count');
const charMax = mustGet<HTMLSpanElement>('#char-max');
const playButton = mustGet<HTMLButtonElement>('#play-button');
const stopButton = mustGet<HTMLButtonElement>('#stop-button');
const statusEl = mustGet<HTMLSpanElement>('#status-label');
const errorEl = mustGet<HTMLParagraphElement>('#error-message');
const audioEl = mustGet<HTMLAudioElement>('#preview-audio');

let state: PreviewState = INITIAL_STATE;
const audioSession = new PreviewAudioSession();

function dispatch(event: PreviewEvent): void {
  const next = reduce(state, event);
  if (next === null) return;
  state = next;
  render();
}

function render(): void {
  const { playEnabled, stopEnabled } = buttonStates(state.status);
  playButton.disabled = !playEnabled;
  stopButton.disabled = !stopEnabled;
  statusEl.textContent = statusLabel(state.status);
  if (state.status === 'ERROR' && state.errorMessage) {
    errorEl.textContent = state.errorMessage;
    errorEl.hidden = false;
  } else {
    errorEl.hidden = true;
  }
}

function renderCharCount(): void {
  const length = countTextLength(textArea.value);
  charCount.textContent = String(length);
  charCount.parentElement?.classList.toggle('over', length > MAX_TEXT_LENGTH);
}

function showLocalError(message: string): void {
  // API呼び出し前の入力エラー表示(状態遷移: STARTING → ERROR)
  dispatch({ type: 'PLAY_REQUESTED' });
  dispatch({ type: 'START_FAILED', message });
}

async function handlePlay(client: ApiClient): Promise<void> {
  if (state.status === 'COMPLETED' || state.status === 'ERROR') {
    dispatch({ type: 'RESET' });
  }
  if (state.status !== 'IDLE') return;

  const validation = validatePreviewText(textArea.value);
  if (!validation.ok) {
    showLocalError(validation.reason);
    return;
  }
  const voiceId = voiceSelect.value;
  if (!voiceId) {
    showLocalError('音声を選択してください。');
    return;
  }

  dispatch({ type: 'PLAY_REQUESTED' });

  let contactId: string | undefined;
  try {
    const started = await client.startPreview(validation.text, voiceId);
    contactId = started.contactId;
    dispatch({ type: 'START_SUCCEEDED', contactId });

    await audioSession.start(started.connectionData, audioEl, {
      onStarted: () => dispatch({ type: 'CONNECTED' }),
      onEnded: () => {
        dispatch({ type: 'PLAYBACK_ENDED' });
        dispatch({ type: 'RESET' });
      },
    });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : '音声プレビューを開始できませんでした。しばらく待ってから、もう一度お試しください。';
    if (contactId === undefined) {
      dispatch({ type: 'START_FAILED', message });
    } else {
      dispatch({ type: 'CONNECTION_FAILED', message });
      // WebRTC接続に失敗した場合はContactを残さない(memo.txt 13章)
      void client.stopPreview(contactId).catch(() => {});
    }
    audioSession.stop();
  }
}

async function handleStop(client: ApiClient): Promise<void> {
  const contactId = state.contactId;
  dispatch({ type: 'STOP_REQUESTED' });
  if (state.status !== 'STOPPING') return;

  audioSession.stop();
  if (contactId) {
    try {
      await client.stopPreview(contactId);
    } catch {
      // 停止APIの失敗は無視する。フロー側の切断ブロックで自動終了する(memo.txt 15章)
    }
  }
  dispatch({ type: 'STOP_FINISHED' });
}

async function init(): Promise<void> {
  charMax.textContent = String(MAX_TEXT_LENGTH);
  renderCharCount();
  render();

  let client: ApiClient;
  try {
    const config = await loadConfig();
    client = new ApiClient(config.apiBaseUrl);
    const { voices } = await client.getVoices();
    voiceSelect.innerHTML = '';
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = voice.displayName;
      voiceSelect.appendChild(option);
    }
    voiceSelect.disabled = false;
  } catch (error) {
    statusEl.textContent = 'エラー';
    errorEl.textContent =
      error instanceof Error ? error.message : '初期化に失敗しました。設定を確認してください。';
    errorEl.hidden = false;
    return;
  }

  textArea.addEventListener('input', renderCharCount);
  playButton.addEventListener('click', () => void handlePlay(client));
  stopButton.addEventListener('click', () => void handleStop(client));

  // タブを閉じた場合のベストエフォート停止(memo.txt 15章)
  window.addEventListener('pagehide', () => {
    if (state.contactId && (state.status === 'CONNECTING' || state.status === 'PLAYING')) {
      audioSession.stop();
      client.stopBeacon(state.contactId);
    }
  });
}

void init();
