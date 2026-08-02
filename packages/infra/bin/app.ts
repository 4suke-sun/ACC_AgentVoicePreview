import { App } from 'aws-cdk-lib';
import { PreviewStack } from '../lib/preview-stack';

const app = new App();

const connectInstanceId =
  app.node.tryGetContext('connectInstanceId') ?? process.env.CONNECT_INSTANCE_ID;
if (typeof connectInstanceId !== 'string' || connectInstanceId === '') {
  throw new Error(
    'Amazon Connect インスタンスIDを指定してください。' +
      '例: npx cdk synth -c connectInstanceId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  );
}

const additionalCorsOrigins = parseCsv(app.node.tryGetContext('additionalCorsOrigins'));

new PreviewStack(app, 'AgenticVoicePreviewStack', {
  description: 'Amazon Connect Agentic Voice 社内音声プレビュー',
  connectInstanceId,
  additionalCorsOrigins,
});

function parseCsv(value: unknown): string[] {
  if (typeof value !== 'string' || value === '') return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
}
