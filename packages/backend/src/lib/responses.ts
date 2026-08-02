import type { ApiErrorBody, ApiErrorCode } from '@avp/shared';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

const JSON_HEADERS = { 'content-type': 'application/json' };

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export function errorResponse(
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  requestId?: string,
): APIGatewayProxyStructuredResultV2 {
  const body: ApiErrorBody = { error: { code, message, ...(requestId ? { requestId } : {}) } };
  return jsonResponse(statusCode, body);
}
