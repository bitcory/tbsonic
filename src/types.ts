// TTS 관련 타입 정의

export interface TTSConfig {
  sampleRate: number;
  latentDim: number;
  chunkCompressFactor: number;
  baseChunkSize: number;
}

export interface VoiceStyle {
  name: string;
  id: string;
  gender: 'male' | 'female';
  styleTtl: Float32Array;
  styleDp: Float32Array;
  styleTtlShape: number[];
  styleDpShape: number[];
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export interface TTSResult {
  audio: Float32Array;
  duration: number;
  sampleRate: number;
}

export interface TTSProgress {
  stage: 'loading' | 'processing' | 'generating' | 'complete';
  progress: number;
  message: string;
}

export type ProgressCallback = (progress: TTSProgress) => void;

export interface TTSOptions {
  text: string;
  language: string;
  voiceStyle: VoiceStyle;
  totalSteps: number;
  speed: number;
  onProgress?: ProgressCallback;
}
