import type { Language } from './types';

// 지원 언어
export const LANGUAGES: Language[] = [
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
];

// 음성 스타일
export const VOICE_STYLES = [
  { id: 'M1', name: '민준', description: '활기차고 자신감 넘치는 에너지, 명확하고 표준적인 톤의 남성 음성', gender: 'male' as const },
  { id: 'M2', name: '서준', description: '깊고 묵직한 저음, 차분하고 진지하며 안정감 있는 남성 음성', gender: 'male' as const },
  { id: 'M3', name: '도윤', description: '세련되고 권위 있는 톤, 신뢰감과 프레젠테이션에 적합한 남성 음성', gender: 'male' as const },
  { id: 'M4', name: '예준', description: '부드럽고 중립적인 톤, 친근하고 젊은 느낌의 남성 음성', gender: 'male' as const },
  { id: 'M5', name: '시우', description: '따뜻하고 나지막한 톤, 차분하고 편안한 내레이션 스타일의 남성 음성', gender: 'male' as const },
  { id: 'F1', name: '서연', description: '차분하고 약간 낮은 톤, 안정적이고 침착한 여성 음성', gender: 'female' as const },
  { id: 'F2', name: '서윤', description: '밝고 쾌활한 톤, 생기 있고 발랄하며 젊은 에너지의 여성 음성', gender: 'female' as const },
  { id: 'F3', name: '지우', description: '명확하고 전문적인 아나운서 스타일, 방송에 적합한 여성 음성', gender: 'female' as const },
  { id: 'F4', name: '하윤', description: '또렷하고 자신감 있는 톤, 뚜렷하고 표현력이 강한 여성 음성', gender: 'female' as const },
  { id: 'F5', name: '하은', description: '친절하고 부드러운 톤, 나지막하고 차분하며 자연스럽게 편안한 여성 음성', gender: 'female' as const },
];

// TTS 기본 설정
export const DEFAULT_SETTINGS = {
  totalSteps: 5,
  speed: 1.0,
  language: 'ko',
  voiceStyle: 'M1',
};

// 오디오 설정
export const AUDIO_CONFIG = {
  sampleRate: 44100,
  latentDim: 24,
  chunkCompressFactor: 6,
  baseChunkSize: 512,
};
