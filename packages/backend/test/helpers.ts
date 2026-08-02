import { PREVIEW_VOICES } from '@avp/shared';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export const TEST_INSTANCE_ID = 'test-instance-id';

/** 音声レジストリから動的に生成(音声の増減でテストが壊れないようにする) */
export const TEST_FLOW_MAP: Record<string, string> = Object.fromEntries(
  PREVIEW_VOICES.map((voice) => [voice.id, `flow-id-${voice.id}`]),
);

/** 検証済みの代表的な音声ID */
export const VALID_VOICE_ID = PREVIEW_VOICES[0]?.id ?? '';

export function setTestEnv(): void {
  process.env.CONNECT_INSTANCE_ID = TEST_INSTANCE_ID;
  process.env.VOICE_FLOW_MAP = JSON.stringify(TEST_FLOW_MAP);
}

export function makeEvent(
  routeKey: string,
  options: {
    body?: unknown;
    rawBody?: string;
    isBase64Encoded?: boolean;
    pathParameters?: Record<string, string>;
  } = {},
): APIGatewayProxyEventV2 {
  const [method = 'GET', path = '/'] = routeKey.split(' ');
  const body =
    options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  return {
    version: '2.0',
    routeKey,
    rawPath: path,
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.example.com',
      domainPrefix: 'test',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
      requestId: 'test-request-id',
      routeKey,
      stage: '$default',
      time: '2026-07-31T00:00:00Z',
      timeEpoch: 0,
    },
    body,
    pathParameters: options.pathParameters,
    isBase64Encoded: options.isBase64Encoded ?? false,
  } as APIGatewayProxyEventV2;
}
