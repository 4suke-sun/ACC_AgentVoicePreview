import { PREVIEW_VOICES } from '@avp/shared';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { PreviewStack } from '../lib/preview-stack';

const TEST_INSTANCE_ID = '12345678-1234-1234-1234-123456789012';

let template: Template;

beforeAll(() => {
  const app = new App({
    // テストではLambdaのesbuildバンドルをスキップして高速化する
    context: { 'aws:cdk:bundling-stacks': [] },
  });
  const stack = new PreviewStack(app, 'TestStack', {
    connectInstanceId: TEST_INSTANCE_ID,
    additionalCorsOrigins: ['http://localhost:5173'],
  });
  template = Template.fromStack(stack);
});

describe('コンタクトフロー', () => {
  it('ロケールごとに1本の動的フローを作成する', () => {
    const localeCount = new Set(PREVIEW_VOICES.map((voice) => voice.locale)).size;
    template.resourceCountIs('AWS::Connect::ContactFlow', localeCount);
  });

  it('フローはpreviewText属性を読み上げる', () => {
    template.allResourcesProperties('AWS::Connect::ContactFlow', {
      Type: 'CONTACT_FLOW',
      Content: Match.stringLikeRegexp('previewText'),
    });
  });
});

describe('Lambda', () => {
  it('インスタンスIDと音声→フローのマッピングを環境変数で受け取る', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          CONNECT_INSTANCE_ID: TEST_INSTANCE_ID,
          VOICE_FLOW_MAP: Match.anyValue(),
        }),
      },
    });
  });

  it('Connect権限はStartWebRTCContactとStopContactのみ(memo.txt 10.3)', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const connectActions: string[] = [];
    for (const policy of Object.values(policies)) {
      const statements = policy.Properties?.PolicyDocument?.Statement ?? [];
      for (const statement of statements) {
        const actions: string[] = Array.isArray(statement.Action)
          ? statement.Action
          : [statement.Action];
        connectActions.push(...actions.filter((action) => action.startsWith('connect:')));
      }
    }
    expect(connectActions.sort()).toEqual(['connect:StartWebRTCContact', 'connect:StopContact']);
  });
});

describe('HTTP API', () => {
  it('必要な3ルートのみ定義する', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 3);
    for (const routeKey of [
      'GET /v1/voices',
      'POST /v1/preview-contacts',
      'POST /v1/preview-contacts/{contactId}/stop',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: routeKey });
    }
  });

  it('CORSオリジンを限定する(memo.txt 17章)', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowOrigins: Match.arrayWith(['http://localhost:5173']),
        AllowMethods: ['GET', 'POST'],
      }),
    });
  });

  it('レート制限を設定する(memo.txt 16章)', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: {
        ThrottlingRateLimit: 10,
        ThrottlingBurstLimit: 20,
      },
    });
  });
});

describe('フロントエンド配信', () => {
  it('S3バケットはパブリックアクセスを全てブロックする', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('CloudFrontはHTTPSへリダイレクトする', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
      }),
    });
  });
});

describe('出力', () => {
  it('APIエンドポイントとWeb URLを出力する', () => {
    template.hasOutput('ApiEndpoint', {});
    template.hasOutput('WebUrl', {});
    template.hasOutput('PreviewFlowIds', {});
  });
});
