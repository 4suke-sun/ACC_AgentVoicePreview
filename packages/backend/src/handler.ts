import { randomUUID } from 'node:crypto';
import type { StartPreviewResponse, StopPreviewResponse, VoicesResponse } from '@avp/shared';
import { countTextLength, findVoice, PREVIEW_VOICES } from '@avp/shared';
import { StartWebRTCContactCommand, StopContactCommand } from '@aws-sdk/client-connect';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { getConfig } from './lib/config';
import { getConnectClient } from './lib/connect-client';
import { logEvent } from './lib/logger';
import { errorResponse, jsonResponse } from './lib/responses';
import { isValidContactId, parseStartRequest } from './lib/validation';

const PARTICIPANT_DISPLAY_NAME = 'Agentic Voice Preview';

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestId = event.requestContext.requestId;
  try {
    switch (event.routeKey) {
      case 'GET /v1/voices':
        return handleVoices();
      case 'POST /v1/preview-contacts':
        return await handleStart(event, requestId);
      case 'POST /v1/preview-contacts/{contactId}/stop':
        return await handleStop(event, requestId);
      default:
        return errorResponse(404, 'NOT_FOUND', '指定されたリソースが見つかりません。', requestId);
    }
  } catch (error) {
    logEvent('UNHANDLED_ERROR', { requestId, errorName: errorName(error) });
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'サーバー内部でエラーが発生しました。しばらく待ってから、もう一度お試しください。',
      requestId,
    );
  }
}

function handleVoices(): APIGatewayProxyStructuredResultV2 {
  const body: VoicesResponse = {
    voices: PREVIEW_VOICES.map(({ id, displayName, locale }) => ({ id, displayName, locale })),
  };
  return jsonResponse(200, body);
}

async function handleStart(
  event: APIGatewayProxyEventV2,
  requestId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const parsed = parseStartRequest(event.body, event.isBase64Encoded);
  if (!parsed.ok) {
    logEvent('VALIDATION_FAILED', { requestId, code: parsed.code });
    return errorResponse(parsed.statusCode, parsed.code, parsed.message, requestId);
  }

  const config = getConfig();
  const voice = findVoice(parsed.voiceId);
  const contactFlowId = config.voiceFlowMap[parsed.voiceId];
  if (!voice || !contactFlowId) {
    // 音声定義には存在するがフローが未デプロイの場合
    logEvent('VALIDATION_FAILED', { requestId, code: 'INVALID_VOICE', voiceId: parsed.voiceId });
    return errorResponse(400, 'INVALID_VOICE', '許可されていない音声IDです。', requestId);
  }

  const previewId = randomUUID();
  const textLength = countTextLength(parsed.text);
  logEvent('START_PREVIEW_REQUESTED', {
    requestId,
    previewId,
    voiceId: parsed.voiceId,
    textLength,
  });

  try {
    const output = await getConnectClient().send(
      new StartWebRTCContactCommand({
        InstanceId: config.instanceId,
        ContactFlowId: contactFlowId,
        // 同一再生操作のリトライで重複Contactを作らないための冪等性キー(memo.txt 14章)
        ClientToken: previewId,
        ParticipantDetails: { DisplayName: PARTICIPANT_DISPLAY_NAME },
        Attributes: {
          previewText: parsed.text,
          previewId,
          // 動的フローのSet Voiceが参照する音声名(音声固定フローでは未使用)
          previewVoice: voice.connectVoiceId,
        },
      }),
    );

    const contactId = output.ContactId;
    if (!contactId || !output.ConnectionData) {
      logEvent('START_PREVIEW_FAILED', { requestId, previewId, reason: 'EMPTY_RESPONSE' });
      return errorResponse(
        502,
        'CONNECT_API_FAILED',
        '音声プレビューを開始できませんでした。',
        requestId,
      );
    }

    logEvent('START_PREVIEW_SUCCEEDED', {
      requestId,
      previewId,
      contactId,
      voiceId: parsed.voiceId,
      textLength,
    });

    const body: StartPreviewResponse = {
      previewId,
      contactId,
      connectionData: {
        meeting: output.ConnectionData.Meeting,
        attendee: output.ConnectionData.Attendee,
      },
    };
    return jsonResponse(201, body);
  } catch (error) {
    const name = errorName(error);
    logEvent('START_PREVIEW_FAILED', { requestId, previewId, errorName: name });
    if (name === 'ThrottlingException' || name === 'TooManyRequestsException') {
      return errorResponse(
        503,
        'PREVIEW_UNAVAILABLE',
        '現在混み合っています。しばらく待ってから、もう一度お試しください。',
        requestId,
      );
    }
    return errorResponse(
      502,
      'CONNECT_API_FAILED',
      '音声プレビューを開始できませんでした。',
      requestId,
    );
  }
}

async function handleStop(
  event: APIGatewayProxyEventV2,
  requestId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const contactId = event.pathParameters?.contactId;
  if (!isValidContactId(contactId)) {
    logEvent('VALIDATION_FAILED', { requestId, code: 'INVALID_CONTACT_ID' });
    return errorResponse(400, 'INVALID_CONTACT_ID', 'コンタクトIDが不正です。', requestId);
  }

  const config = getConfig();
  logEvent('STOP_PREVIEW_REQUESTED', { requestId, contactId });

  try {
    await getConnectClient().send(
      new StopContactCommand({
        InstanceId: config.instanceId,
        ContactId: contactId,
      }),
    );
  } catch (error) {
    const name = errorName(error);
    // 既に終了している場合は成功扱いにする(memo.txt 7.4)
    if (name !== 'ContactNotFoundException') {
      logEvent('STOP_PREVIEW_FAILED', { requestId, contactId, errorName: name });
      return errorResponse(
        502,
        'PREVIEW_STOP_FAILED',
        '音声プレビューを停止できませんでした。',
        requestId,
      );
    }
  }

  logEvent('STOP_PREVIEW_SUCCEEDED', { requestId, contactId });
  const body: StopPreviewResponse = { contactId, status: 'STOPPED' };
  return jsonResponse(200, body);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
