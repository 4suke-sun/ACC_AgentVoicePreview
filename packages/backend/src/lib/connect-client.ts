import { ConnectClient } from '@aws-sdk/client-connect';

let client: ConnectClient | undefined;

/**
 * ConnectClient のシングルトン。
 * テストでは aws-sdk-client-mock がプロトタイプの send をモックするため、そのまま利用できる。
 */
export function getConnectClient(): ConnectClient {
  client ??= new ConnectClient({});
  return client;
}
