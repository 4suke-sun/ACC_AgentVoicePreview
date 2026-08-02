import { describe, expect, it, vi } from 'vitest';
import type { MinimalMeetingSession, SessionFactory } from '../src/audio';
import { PreviewAudioSession } from '../src/audio';

interface FakeSession extends MinimalMeetingSession {
  observers: Array<{ audioVideoDidStart?: () => void; audioVideoDidStop?: () => void }>;
  started: boolean;
  stopped: boolean;
  boundElement: unknown;
}

function makeFakeSession(): FakeSession {
  const fake: FakeSession = {
    observers: [],
    started: false,
    stopped: false,
    boundElement: undefined,
    audioVideo: {
      addObserver: (observer) => {
        fake.observers.push(observer);
      },
      bindAudioElement: async (element) => {
        fake.boundElement = element;
      },
      start: () => {
        fake.started = true;
        for (const observer of fake.observers) observer.audioVideoDidStart?.();
      },
      stop: () => {
        fake.stopped = true;
        for (const observer of fake.observers) observer.audioVideoDidStop?.();
      },
    },
  };
  return fake;
}

const connectionData = { meeting: { MeetingId: 'm' }, attendee: { AttendeeId: 'a' } };
const audioElement = {} as HTMLAudioElement;

describe('PreviewAudioSession', () => {
  it('セッションを開始して音声要素へバインドする', async () => {
    const fake = makeFakeSession();
    const session = new PreviewAudioSession(async () => fake);
    const onStarted = vi.fn();

    await session.start(connectionData, audioElement, { onStarted });

    expect(fake.boundElement).toBe(audioElement);
    expect(fake.started).toBe(true);
    expect(onStarted).toHaveBeenCalled();
    expect(session.active).toBe(true);
  });

  it('セッション終了時にonEndedを呼びactiveがfalseになる', async () => {
    const fake = makeFakeSession();
    const session = new PreviewAudioSession(async () => fake);
    const onEnded = vi.fn();

    await session.start(connectionData, audioElement, { onEnded });
    fake.audioVideo.stop();

    expect(onEnded).toHaveBeenCalled();
    expect(session.active).toBe(false);
  });

  it('stop()でChimeセッションを停止する', async () => {
    const fake = makeFakeSession();
    const session = new PreviewAudioSession(async () => fake);

    await session.start(connectionData, audioElement);
    session.stop();

    expect(fake.stopped).toBe(true);
    expect(session.active).toBe(false);
  });

  it('二重開始を拒否する(memo.txt 6.5)', async () => {
    const factory: SessionFactory = async () => makeFakeSession();
    const session = new PreviewAudioSession(factory);

    await session.start(connectionData, audioElement);
    await expect(session.start(connectionData, audioElement)).rejects.toThrow(/既に/);
  });

  it('stop()後は再度start()できる', async () => {
    const session = new PreviewAudioSession(async () => makeFakeSession());

    await session.start(connectionData, audioElement);
    session.stop();
    await expect(session.start(connectionData, audioElement)).resolves.toBeUndefined();
  });
});
