/**
 * フロントエンド⇔バックエンド間のAPI型定義(memo.txt 7章)。
 */

export interface VoiceSummary {
  id: string;
  displayName: string;
  locale: string;
}

export interface VoicesResponse {
  voices: VoiceSummary[];
}

export interface StartPreviewRequest {
  text: string;
  voiceId: string;
}

/** StartWebRTCContact が返す ConnectionData(Meeting / Attendee)をそのまま格納する */
export interface PreviewConnectionData {
  meeting: unknown;
  attendee: unknown;
}

export interface StartPreviewResponse {
  previewId: string;
  contactId: string;
  connectionData: PreviewConnectionData;
}

export interface StopPreviewResponse {
  contactId: string;
  status: 'STOPPED';
}

export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_TEXT'
  | 'TEXT_TOO_LONG'
  | 'INVALID_VOICE'
  | 'INVALID_CONTACT_ID'
  | 'NOT_FOUND'
  | 'PREVIEW_START_FAILED'
  | 'PREVIEW_STOP_FAILED'
  | 'CONNECT_API_FAILED'
  | 'PREVIEW_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
}
