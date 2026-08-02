import { PREVIEW_VOICES } from '@avp/shared';
import {
  ConnectClient,
  StartWebRTCContactCommand,
  StopContactCommand,
} from '@aws-sdk/client-connect';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../src/handler';
import { makeEvent, setTestEnv, TEST_FLOW_MAP, TEST_INSTANCE_ID, VALID_VOICE_ID } from './helpers';

const connectMock = mockClient(ConnectClient);

const CONNECTION_DATA = {
  Meeting: {
    MeetingId: 'meeting-id',
    MediaRegion: 'ap-northeast-1',
    MediaPlacement: { AudioHostUrl: 'wss://example' },
  },
  Attendee: { AttendeeId: 'attendee-id', JoinToken: 'join-token' },
};

function parseBody(result: { body?: string }): Record<string, unknown> {
  return JSON.parse(result.body ?? '{}');
}

beforeEach(() => {
  connectMock.reset();
  setTestEnv();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('GET /v1/voices', () => {
  it('音声一覧を返す(ContactFlowIdは含めない)', async () => {
    const result = await handler(makeEvent('GET /v1/voices'));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result);
    const voices = body.voices as Array<Record<string, unknown>>;
    expect(voices.length).toBeGreaterThan(0);
    for (const voice of voices) {
      expect(Object.keys(voice).sort()).toEqual(['displayName', 'id', 'locale']);
    }
  });
});

describe('POST /v1/preview-contacts', () => {
  it('StartWebRTCContact を実行して ConnectionData を返す', async () => {
    connectMock.on(StartWebRTCContactCommand).resolves({
      ContactId: '11111111-2222-3333-4444-555555555555',
      ConnectionData: CONNECTION_DATA,
    });

    const result = await handler(
      makeEvent('POST /v1/preview-contacts', {
        body: { text: 'お電話ありがとうございます。', voiceId: VALID_VOICE_ID },
      }),
    );

    expect(result.statusCode).toBe(201);
    const body = parseBody(result);
    expect(body.contactId).toBe('11111111-2222-3333-4444-555555555555');
    expect(body.previewId).toEqual(expect.any(String));
    expect(body.connectionData).toEqual({
      meeting: CONNECTION_DATA.Meeting,
      attendee: CONNECTION_DATA.Attendee,
    });

    const calls = connectMock.commandCalls(StartWebRTCContactCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input?.InstanceId).toBe(TEST_INSTANCE_ID);
    expect(input?.ContactFlowId).toBe(TEST_FLOW_MAP[VALID_VOICE_ID]);
    expect(input?.Attributes?.previewText).toBe('お電話ありがとうございます。');
    expect(input?.Attributes?.previewId).toBe(body.previewId);
    // 動的フロー用に実音声名を常に渡す
    expect(input?.Attributes?.previewVoice).toBe(PREVIEW_VOICES[0]?.connectVoiceId);
    // 冪等性キーとして previewId を使用する(memo.txt 14章)
    expect(input?.ClientToken).toBe(body.previewId);
  });

  it('voiceIdごとに対応するContactFlowIdを使う', async () => {
    connectMock.on(StartWebRTCContactCommand).resolves({
      ContactId: '11111111-2222-3333-4444-555555555555',
      ConnectionData: CONNECTION_DATA,
    });

    for (const voice of PREVIEW_VOICES) {
      connectMock.resetHistory();
      await handler(
        makeEvent('POST /v1/preview-contacts', {
          body: { text: 'テスト', voiceId: voice.id },
        }),
      );
      const input = connectMock.commandCalls(StartWebRTCContactCommand)[0]?.args[0].input;
      expect(input?.ContactFlowId).toBe(TEST_FLOW_MAP[voice.id]);
      expect(input?.Attributes?.previewVoice).toBe(voice.connectVoiceId);
    }
  });

  it('検証エラー時はConnect APIを呼ばず400を返す', async () => {
    const result = await handler(
      makeEvent('POST /v1/preview-contacts', { body: { text: '', voiceId: VALID_VOICE_ID } }),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result)).toMatchObject({ error: { code: 'INVALID_TEXT' } });
    expect(connectMock.commandCalls(StartWebRTCContactCommand)).toHaveLength(0);
  });

  it('スロットリング時は503 PREVIEW_UNAVAILABLEを返す', async () => {
    const error = new Error('rate exceeded');
    error.name = 'ThrottlingException';
    connectMock.on(StartWebRTCContactCommand).rejects(error);

    const result = await handler(
      makeEvent('POST /v1/preview-contacts', {
        body: { text: 'テスト', voiceId: VALID_VOICE_ID },
      }),
    );
    expect(result.statusCode).toBe(503);
    expect(parseBody(result)).toMatchObject({ error: { code: 'PREVIEW_UNAVAILABLE' } });
  });

  it('Connect APIエラー時は502 CONNECT_API_FAILEDを返す', async () => {
    connectMock.on(StartWebRTCContactCommand).rejects(new Error('boom'));

    const result = await handler(
      makeEvent('POST /v1/preview-contacts', {
        body: { text: 'テスト', voiceId: VALID_VOICE_ID },
      }),
    );
    expect(result.statusCode).toBe(502);
    expect(parseBody(result)).toMatchObject({ error: { code: 'CONNECT_API_FAILED' } });
  });

  it('エラーレスポンスに入力文章を含めない', async () => {
    connectMock.on(StartWebRTCContactCommand).rejects(new Error('boom'));
    const secret = '社外秘のテキスト';
    const result = await handler(
      makeEvent('POST /v1/preview-contacts', {
        body: { text: secret, voiceId: VALID_VOICE_ID },
      }),
    );
    expect(result.body).not.toContain(secret);
  });
});

describe('POST /v1/preview-contacts/{contactId}/stop', () => {
  const contactId = '8e9ec480-0c2c-4a08-b9e0-0123456789ab';

  it('StopContact を実行して STOPPED を返す', async () => {
    connectMock.on(StopContactCommand).resolves({});

    const result = await handler(
      makeEvent('POST /v1/preview-contacts/{contactId}/stop', {
        pathParameters: { contactId },
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(parseBody(result)).toEqual({ contactId, status: 'STOPPED' });
    const input = connectMock.commandCalls(StopContactCommand)[0]?.args[0].input;
    expect(input).toEqual({ InstanceId: TEST_INSTANCE_ID, ContactId: contactId });
  });

  it('既に終了しているコンタクトは成功扱いにする(memo.txt 7.4)', async () => {
    const error = new Error('not found');
    error.name = 'ContactNotFoundException';
    connectMock.on(StopContactCommand).rejects(error);

    const result = await handler(
      makeEvent('POST /v1/preview-contacts/{contactId}/stop', {
        pathParameters: { contactId },
      }),
    );
    expect(result.statusCode).toBe(200);
    expect(parseBody(result)).toEqual({ contactId, status: 'STOPPED' });
  });

  it('その他のエラーは502を返す', async () => {
    connectMock.on(StopContactCommand).rejects(new Error('boom'));
    const result = await handler(
      makeEvent('POST /v1/preview-contacts/{contactId}/stop', {
        pathParameters: { contactId },
      }),
    );
    expect(result.statusCode).toBe(502);
    expect(parseBody(result)).toMatchObject({ error: { code: 'PREVIEW_STOP_FAILED' } });
  });

  it('不正なcontactIdは400を返す', async () => {
    const result = await handler(
      makeEvent('POST /v1/preview-contacts/{contactId}/stop', {
        pathParameters: { contactId: 'not-a-uuid' },
      }),
    );
    expect(result.statusCode).toBe(400);
    expect(connectMock.commandCalls(StopContactCommand)).toHaveLength(0);
  });
});

describe('ルーティング', () => {
  it('未知のルートは404を返す', async () => {
    const result = await handler(makeEvent('GET /v1/unknown'));
    expect(result.statusCode).toBe(404);
    expect(parseBody(result)).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
