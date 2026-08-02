import type { PreviewConnectionData } from '@avp/shared';

/**
 * Chime SDK のミーティングセッションを最小限のインターフェースに抽象化する。
 * テストではフェイク実装を注入する。
 */
export interface MinimalAudioVideo {
  addObserver(observer: { audioVideoDidStart?: () => void; audioVideoDidStop?: () => void }): void;
  bindAudioElement(element: HTMLAudioElement): Promise<void>;
  start(): void;
  stop(): void;
}

export interface MinimalMeetingSession {
  audioVideo: MinimalAudioVideo;
}

export type SessionFactory = (data: PreviewConnectionData) => Promise<MinimalMeetingSession>;

export interface AudioSessionCallbacks {
  onStarted?: () => void;
  onEnded?: () => void;
}

/**
 * StartWebRTCContact の ConnectionData から Chime SDK セッションを生成する
 * 既定のファクトリ(memo.txt 3.1)。
 */
const defaultSessionFactory: SessionFactory = async (data) => {
  const {
    ConsoleLogger,
    DefaultDeviceController,
    DefaultMeetingSession,
    LogLevel,
    MeetingSessionConfiguration,
  } = await import('amazon-chime-sdk-js');

  const logger = new ConsoleLogger('AgenticVoicePreview', LogLevel.WARN);
  const configuration = new MeetingSessionConfiguration(data.meeting, data.attendee);
  const deviceController = new DefaultDeviceController(logger);
  return new DefaultMeetingSession(configuration, logger, deviceController);
};

/**
 * 音声プレビュー1回分のWebRTCセッション。
 * 再生専用のためマイクは要求しない。
 */
export class PreviewAudioSession {
  private session: MinimalMeetingSession | undefined;
  private readonly createSession: SessionFactory;

  constructor(sessionFactory: SessionFactory = defaultSessionFactory) {
    this.createSession = sessionFactory;
  }

  get active(): boolean {
    return this.session !== undefined;
  }

  async start(
    data: PreviewConnectionData,
    audioElement: HTMLAudioElement,
    callbacks: AudioSessionCallbacks = {},
  ): Promise<void> {
    if (this.session) {
      throw new Error('既にセッションが開始されています。先に stop() を呼び出してください。');
    }

    const session = await this.createSession(data);
    this.session = session;

    session.audioVideo.addObserver({
      audioVideoDidStart: () => {
        callbacks.onStarted?.();
      },
      audioVideoDidStop: () => {
        this.session = undefined;
        callbacks.onEnded?.();
      },
    });

    await session.audioVideo.bindAudioElement(audioElement);
    session.audioVideo.start();
  }

  stop(): void {
    this.session?.audioVideo.stop();
    this.session = undefined;
  }
}
