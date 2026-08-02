import * as fs from 'node:fs';
import * as path from 'node:path';
import { PREVIEW_VOICES } from '@avp/shared';
import {
  Annotations,
  Aws,
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import { buildPreviewFlowContent, previewFlowName } from './contact-flow';

export interface PreviewStackProps extends StackProps {
  /** 既存のAmazon ConnectインスタンスID(Agentic voice対応・Connect Customer有効であること) */
  connectInstanceId: string;
  /** CloudFrontドメイン以外に許可するCORSオリジン(ローカル開発用など) */
  additionalCorsOrigins?: string[];
}

export class PreviewStack extends Stack {
  constructor(scope: Construct, id: string, props: PreviewStackProps) {
    super(scope, id, props);

    const { connectInstanceId, additionalCorsOrigins = [] } = props;

    const instanceArn = `arn:${Aws.PARTITION}:connect:${Aws.REGION}:${Aws.ACCOUNT_ID}:instance/${connectInstanceId}`;

    // ---------------------------------------------------------------
    // コンタクトフロー: ロケールごとに1本の動的フロー。
    // 音声名はLambdaがコンタクト属性 previewVoice で渡し、フロー側で動的に解決する
    // (2026-08-02 実機検証済み)。音声の追加ではフローは増えない。
    // ---------------------------------------------------------------
    const voiceFlowMap: Record<string, string> = {};
    const locales = [...new Set(PREVIEW_VOICES.map((voice) => voice.locale))];
    for (const locale of locales) {
      const flow = new connect.CfnContactFlow(this, `PreviewFlow-${locale}`, {
        instanceArn,
        name: previewFlowName(locale),
        description: `Agentic Voice プレビュー用の動的フロー(${locale})。previewVoice属性の音声でpreviewTextを読み上げて自動切断する。`,
        type: 'CONTACT_FLOW',
        content: buildPreviewFlowContent(locale),
      });
      // ARN形式: .../instance/{instanceId}/contact-flow/{flowId} → flowIdを抽出
      const flowId = Fn.select(3, Fn.split('/', flow.attrContactFlowArn));
      for (const voice of PREVIEW_VOICES.filter((v) => v.locale === locale)) {
        voiceFlowMap[voice.id] = flowId;
      }
    }

    // ---------------------------------------------------------------
    // フロントエンド配信: S3 + CloudFront(OAC・非公開バケット)
    // ---------------------------------------------------------------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'Agentic Voice Preview frontend',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // ---------------------------------------------------------------
    // バックエンド: Lambda + HTTP API
    // ---------------------------------------------------------------
    const previewFunction = new NodejsFunction(this, 'PreviewFunction', {
      entry: path.join(__dirname, '../../backend/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup: new logs.LogGroup(this, 'PreviewFunctionLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        CONNECT_INSTANCE_ID: connectInstanceId,
        VOICE_FLOW_MAP: JSON.stringify(voiceFlowMap),
      },
      bundling: {
        format: OutputFormat.CJS,
        target: 'node22',
        minify: true,
        sourcesContent: false,
      },
      depsLockFilePath: path.join(__dirname, '../../../package-lock.json'),
    });

    // 最小権限: プレビューの開始と停止のみ(memo.txt 10.3)
    previewFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['connect:StartWebRTCContact', 'connect:StopContact'],
        resources: [instanceArn, `${instanceArn}/*`],
      }),
    );

    const corsOrigins = [
      `https://${distribution.distributionDomainName}`,
      ...additionalCorsOrigins,
    ];

    const api = new apigwv2.HttpApi(this, 'PreviewApi', {
      apiName: 'agentic-voice-preview',
      corsPreflight: {
        allowOrigins: corsOrigins,
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ['content-type'],
        maxAge: Duration.minutes(10),
      },
    });

    const integration = new HttpLambdaIntegration('PreviewIntegration', previewFunction);
    api.addRoutes({
      path: '/v1/voices',
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });
    api.addRoutes({
      path: '/v1/preview-contacts',
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });
    api.addRoutes({
      path: '/v1/preview-contacts/{contactId}/stop',
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    // レート制限(memo.txt 16章)
    const defaultStage = api.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    defaultStage.defaultRouteSettings = {
      throttlingRateLimit: 10,
      throttlingBurstLimit: 20,
    };

    // ---------------------------------------------------------------
    // フロントエンド資産のデプロイ(ビルド済みの場合のみ)
    // ---------------------------------------------------------------
    const frontendDist = path.join(__dirname, '../../frontend/dist');
    if (fs.existsSync(frontendDist)) {
      new s3deploy.BucketDeployment(this, 'DeploySite', {
        destinationBucket: siteBucket,
        distribution,
        sources: [
          s3deploy.Source.asset(frontendDist),
          // フロントエンドは起動時に ./config.json からAPIのURLを読み込む
          s3deploy.Source.jsonData('config.json', { apiBaseUrl: api.apiEndpoint }),
        ],
      });
    } else {
      Annotations.of(this).addWarningV2(
        'avp:frontend-dist-missing',
        'packages/frontend/dist がありません。デプロイ前に `npm run build -w @avp/frontend` を実行してください。',
      );
    }

    new CfnOutput(this, 'ApiEndpoint', { value: api.apiEndpoint });
    new CfnOutput(this, 'WebUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'PreviewFlowIds', { value: JSON.stringify(voiceFlowMap) });
  }
}
