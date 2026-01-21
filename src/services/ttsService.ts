import * as ort from 'onnxruntime-web';
import type { VoiceStyle, TTSResult, ProgressCallback } from '../types';
import { AUDIO_CONFIG } from '../constants';

// WASM 경로 설정
ort.env.wasm.wasmPaths = '/';

// ONNX 세션들
let dpSession: ort.InferenceSession | null = null;
let textEncSession: ort.InferenceSession | null = null;
let vectorEstSession: ort.InferenceSession | null = null;
let vocoderSession: ort.InferenceSession | null = null;

// 유니코드 인덱서 (배열: index=codepoint, value=token_id)
let unicodeIndexer: number[] | null = null;

// 모델 로딩 상태
let isModelLoaded = false;
let currentBackend: 'webgpu' | 'wasm' = 'wasm';

// 사용 가능한 언어
const AVAILABLE_LANGS = ['en', 'ko', 'es', 'pt', 'fr'];

/**
 * ONNX 세션 로딩
 */
async function loadOnnxSession(
  modelPath: string,
  options: ort.InferenceSession.SessionOptions
): Promise<ort.InferenceSession> {
  return await ort.InferenceSession.create(modelPath, options);
}

/**
 * 유니코드 인덱서 로딩 (배열 형태: index=codepoint, value=token_id)
 */
async function loadUnicodeIndexer(basePath: string): Promise<number[]> {
  const response = await fetch(`${basePath}/onnx/unicode_indexer.json`);
  return await response.json();
}

/**
 * 음성 스타일 로딩
 */
export async function loadVoiceStyle(
  basePath: string,
  styleId: string
): Promise<VoiceStyle> {
  const response = await fetch(`${basePath}/voice_styles/${styleId}.json`);
  const data = await response.json();

  // JSON 구조: { "style_ttl": { "data": [...] }, "style_dp": { "data": [...] } }
  const styleTtlData = data.style_ttl.data || data.style_ttl;
  const styleDpData = data.style_dp.data || data.style_dp;

  // 3D 배열을 1D로 평탄화
  const flattenArray = (arr: number[][][]): number[] => {
    const result: number[] = [];
    for (const batch of arr) {
      for (const row of batch) {
        for (const val of row) {
          result.push(val);
        }
      }
    }
    return result;
  };

  return {
    name: styleId,
    id: styleId,
    gender: styleId.startsWith('M') ? 'male' : 'female',
    styleTtl: new Float32Array(flattenArray(styleTtlData)),
    styleDp: new Float32Array(flattenArray(styleDpData)),
    styleTtlShape: [styleTtlData.length, styleTtlData[0].length, styleTtlData[0][0].length],
    styleDpShape: [styleDpData.length, styleDpData[0].length, styleDpData[0][0].length],
  };
}

/**
 * TTS 모델 로딩
 */
export async function loadTTSModels(
  basePath: string = '/assets',
  onProgress?: ProgressCallback
): Promise<{ backend: 'webgpu' | 'wasm' }> {
  if (isModelLoaded) {
    return { backend: currentBackend };
  }

  const modelPaths = [
    { name: 'Duration Predictor', path: `${basePath}/onnx/duration_predictor.onnx` },
    { name: 'Text Encoder', path: `${basePath}/onnx/text_encoder.onnx` },
    { name: 'Vector Estimator', path: `${basePath}/onnx/vector_estimator.onnx` },
    { name: 'Vocoder', path: `${basePath}/onnx/vocoder.onnx` },
  ];

  // WebGPU 먼저 시도, 실패하면 WASM 폴백
  let sessionOptions: ort.InferenceSession.SessionOptions;

  try {
    sessionOptions = {
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all',
    };
    // WebGPU 테스트
    const testSession = await loadOnnxSession(modelPaths[0].path, sessionOptions);
    await testSession.release();
    currentBackend = 'webgpu';
  } catch {
    sessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    };
    currentBackend = 'wasm';
  }

  // 모델 로딩
  for (let i = 0; i < modelPaths.length; i++) {
    const { name, path } = modelPaths[i];
    onProgress?.({
      stage: 'loading',
      progress: ((i + 1) / (modelPaths.length + 1)) * 100,
      message: `${name} 로딩 중...`,
    });

    const session = await loadOnnxSession(path, sessionOptions);

    switch (i) {
      case 0: dpSession = session; break;
      case 1: textEncSession = session; break;
      case 2: vectorEstSession = session; break;
      case 3: vocoderSession = session; break;
    }
  }

  // 유니코드 인덱서 로딩
  onProgress?.({
    stage: 'loading',
    progress: 100,
    message: '텍스트 처리기 로딩 중...',
  });
  unicodeIndexer = await loadUnicodeIndexer(basePath);

  isModelLoaded = true;

  onProgress?.({
    stage: 'complete',
    progress: 100,
    message: '모델 로딩 완료',
  });

  return { backend: currentBackend };
}

/**
 * 모델 로딩 상태 확인
 */
export function isModelsLoaded(): boolean {
  return isModelLoaded;
}

/**
 * 현재 백엔드 가져오기
 */
export function getCurrentBackend(): 'webgpu' | 'wasm' {
  return currentBackend;
}

/**
 * 텍스트 전처리 - 유니코드 정규화 및 토큰화
 */
function preprocessText(text: string, language: string): number[] {
  if (!unicodeIndexer) {
    throw new Error('Unicode indexer not loaded');
  }

  // 유니코드 정규화 (한글을 자모로 분해)
  let normalized = text.normalize('NFKD');

  // 이모지 제거
  normalized = normalized.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
  normalized = normalized.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
  normalized = normalized.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
  normalized = normalized.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '');
  normalized = normalized.replace(/[\u{2600}-\u{26FF}]/gu, '');
  normalized = normalized.replace(/[\u{2700}-\u{27BF}]/gu, '');

  // 공백 정리
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // 언어 태그 추가
  const langTag = `<${language}>`;
  const wrappedText = `${langTag}${normalized}</${language}>`;

  // 토큰화 (codepoint를 인덱스로 사용)
  const tokens: number[] = [];
  for (const char of wrappedText) {
    const codePoint = char.codePointAt(0) || 0;
    const tokenId = codePoint < unicodeIndexer.length ? unicodeIndexer[codePoint] : -1;

    if (tokenId >= 0) {
      tokens.push(tokenId);
    }
    // -1인 경우 (알 수 없는 문자) 건너뜀
  }

  return tokens;
}

/**
 * Box-Muller 변환으로 가우시안 노이즈 생성
 */
function generateGaussianNoise(size: number): Float32Array {
  const noise = new Float32Array(size);
  for (let i = 0; i < size; i += 2) {
    const u1 = Math.random();
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    noise[i] = r * Math.cos(theta);
    if (i + 1 < size) {
      noise[i + 1] = r * Math.sin(theta);
    }
  }
  return noise;
}

/**
 * TTS 추론 실행
 */
export async function synthesize(
  text: string,
  language: string,
  voiceStyle: VoiceStyle,
  totalSteps: number = 5,
  speed: number = 1.0,
  onProgress?: ProgressCallback
): Promise<TTSResult> {
  if (!isModelLoaded || !dpSession || !textEncSession || !vectorEstSession || !vocoderSession) {
    throw new Error('Models not loaded');
  }

  if (!AVAILABLE_LANGS.includes(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }

  onProgress?.({
    stage: 'processing',
    progress: 0,
    message: '텍스트 처리 중...',
  });

  // 텍스트 전처리
  const tokens = preprocessText(text, language);
  const seqLen = tokens.length;

  // 텐서 생성 - 올바른 입력 이름 사용
  const textIdsTensor = new ort.Tensor('int64', BigInt64Array.from(tokens.map(BigInt)), [1, seqLen]);
  const textMaskTensor = new ort.Tensor('float32', new Float32Array(seqLen).fill(1), [1, 1, seqLen]);
  const styleDpTensor = new ort.Tensor('float32', voiceStyle.styleDp, voiceStyle.styleDpShape);
  const styleTtlTensor = new ort.Tensor('float32', voiceStyle.styleTtl, voiceStyle.styleTtlShape);

  // Duration Predictor 실행
  onProgress?.({
    stage: 'processing',
    progress: 10,
    message: '음성 길이 예측 중...',
  });

  const dpResult = await dpSession.run({
    text_ids: textIdsTensor,
    style_dp: styleDpTensor,
    text_mask: textMaskTensor,
  });

  const durationsRaw = dpResult.duration.data as Float32Array;

  // 속도 조절 및 총 duration 계산
  let totalDur = 0;
  for (let i = 0; i < durationsRaw.length; i++) {
    totalDur += durationsRaw[i] / speed;
  }

  // Latent 길이 계산
  // wavLenMax = totalDur * sampleRate (duration은 초 단위가 아니라 프레임 단위)
  // 실제로는 duration 합계가 직접 latent 길이에 매핑됨
  const latentLen = Math.max(1, Math.ceil(totalDur));
  const latentDimVal = AUDIO_CONFIG.latentDim * AUDIO_CONFIG.chunkCompressFactor; // 24 * 6 = 144

  // Text Encoder 실행
  onProgress?.({
    stage: 'processing',
    progress: 20,
    message: '텍스트 인코딩 중...',
  });

  const textEncResult = await textEncSession.run({
    text_ids: textIdsTensor,
    style_ttl: styleTtlTensor,
    text_mask: textMaskTensor,
  });

  const textEmb = textEncResult.text_emb;

  // 초기 노이즈 생성 - shape: [batch, latentDimVal, latentLen]
  const latentSize = latentDimVal * latentLen;
  let latent = generateGaussianNoise(latentSize);

  // latent mask 생성
  const latentMaskTensor = new ort.Tensor('float32', new Float32Array(latentLen).fill(1), [1, 1, latentLen]);

  // Vector Estimator로 denoising
  onProgress?.({
    stage: 'generating',
    progress: 30,
    message: '음성 생성 중...',
  });

  for (let step = 0; step < totalSteps; step++) {
    // shape: [batch, latentDimVal, latentLen]
    const noisyLatentTensor = new ort.Tensor('float32', latent, [1, latentDimVal, latentLen]);
    const currentStepTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(step)]), [1]);
    const totalStepTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(totalSteps)]), [1]);

    const vecEstResult = await vectorEstSession.run({
      noisy_latent: noisyLatentTensor,
      text_emb: textEmb,
      style_ttl: styleTtlTensor,
      latent_mask: latentMaskTensor,
      text_mask: textMaskTensor,
      current_step: currentStepTensor,
      total_step: totalStepTensor,
    });

    latent = vecEstResult.denoised_latent.data as Float32Array;

    onProgress?.({
      stage: 'generating',
      progress: 30 + ((step + 1) / totalSteps) * 50,
      message: `음성 생성 중... (${step + 1}/${totalSteps})`,
    });
  }

  // Vocoder 실행
  onProgress?.({
    stage: 'generating',
    progress: 85,
    message: '오디오 변환 중...',
  });

  // shape: [batch, latentDimVal, latentLen]
  const finalLatentTensor = new ort.Tensor('float32', latent, [1, latentDimVal, latentLen]);

  const vocoderResult = await vocoderSession.run({
    latent: finalLatentTensor,
  });

  const audio = vocoderResult.wav_tts.data as Float32Array;
  const duration = audio.length / AUDIO_CONFIG.sampleRate;

  onProgress?.({
    stage: 'complete',
    progress: 100,
    message: '완료',
  });

  return {
    audio,
    duration,
    sampleRate: AUDIO_CONFIG.sampleRate,
  };
}

/**
 * 모델 해제
 */
export async function releaseModels(): Promise<void> {
  await dpSession?.release();
  await textEncSession?.release();
  await vectorEstSession?.release();
  await vocoderSession?.release();

  dpSession = null;
  textEncSession = null;
  vectorEstSession = null;
  vocoderSession = null;
  unicodeIndexer = null;
  isModelLoaded = false;
}
