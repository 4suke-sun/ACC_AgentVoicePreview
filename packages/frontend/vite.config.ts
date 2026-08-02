import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    // amazon-chime-sdk-js(約1.3MB)は audio.ts の動的importで分割済みで、
    // 初回の再生操作時にのみ読み込まれる。初期表示はエントリ約9KBのみ。
    // SDKがモノリシックでこれ以上削れないため、警告閾値だけ引き上げる。
    chunkSizeWarningLimit: 1500,
  },
});
