import { useState, useEffect, useCallback, useRef } from 'react';
import { LANGUAGES, VOICE_STYLES, DEFAULT_SETTINGS, AUDIO_CONFIG } from '../constants';
// @ts-ignore
import { loadTextToSpeech, loadVoiceStyle, writeWavFile, Style } from '../services/helper.js';
import {
  Play,
  Pause,
  Download,
  Volume2,
  Loader2,
  HelpCircle,
  X,
  Languages,
  Mic,
  Gauge,
  Sparkles,
} from 'lucide-react';

import * as ort from 'onnxruntime-web';
ort.env.wasm.wasmPaths = '/';

// HuggingFace CDN URLs (Git LFS 문제 해결용)
const HF_BASE_URL = 'https://huggingface.co/Supertone/supertonic-2/resolve/main';
const ONNX_BASE_URL = `${HF_BASE_URL}/onnx`;
const VOICE_STYLE_BASE_URL = `${HF_BASE_URL}/voice_styles`;

interface TTSInstance {
  textToSpeech: {
    call: (text: string, lang: string, style: Style, totalStep: number, speed: number, silenceDuration: number, progressCallback: ((step: number, total: number) => void) | null) => Promise<{ wav: number[], duration: number[] }>;
    sampleRate: number;
  };
  cfgs: unknown;
}

export default function TTSPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('모델 로딩 중...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ttsRef = useRef<TTSInstance | null>(null);
  const styleRef = useRef<Style | null>(null);

  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_SETTINGS.language);
  const [selectedVoiceId, setSelectedVoiceId] = useState(DEFAULT_SETTINGS.voiceStyle);
  const [totalSteps, setTotalSteps] = useState(DEFAULT_SETTINGS.totalSteps);
  const [speed, setSpeed] = useState(DEFAULT_SETTINGS.speed);

  const [text, setText] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateStep, setGenerateStep] = useState(0);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [showVoiceModal, setShowVoiceModal] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let textToSpeech;
        let cfgs;

        try {
          setLoadingMessage('WebGPU로 모델 로딩 시도 중...');
          const result = await loadTextToSpeech(
            ONNX_BASE_URL,
            { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' },
            (name: string, current: number, total: number) => {
              setLoadingMessage(`${name} 로딩 중...`);
              setLoadingProgress((current / total) * 100);
            }
          );
          textToSpeech = result.textToSpeech;
          cfgs = result.cfgs;
        } catch (webgpuError) {
          console.log('WebGPU not available, falling back to WebAssembly:', webgpuError);
          setLoadingMessage('WebAssembly로 모델 로딩 중...');
          setLoadingProgress(0);

          const result = await loadTextToSpeech(
            ONNX_BASE_URL,
            { executionProviders: ['wasm'], graphOptimizationLevel: 'all' },
            (name: string, current: number, total: number) => {
              setLoadingMessage(`${name} 로딩 중...`);
              setLoadingProgress((current / total) * 100);
            }
          );
          textToSpeech = result.textToSpeech;
          cfgs = result.cfgs;
        }

        ttsRef.current = { textToSpeech, cfgs };

        setLoadingMessage('음성 스타일 로딩 중...');
        const style = await loadVoiceStyle([`${VOICE_STYLE_BASE_URL}/${DEFAULT_SETTINGS.voiceStyle}.json`]);
        styleRef.current = style;

        setIsLoading(false);
      } catch (err) {
        console.error('Model loading error:', err);
        setError(`모델 로딩 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  const handleVoiceChange = useCallback(async (voiceId: string) => {
    try {
      setSelectedVoiceId(voiceId);
      const style = await loadVoiceStyle([`${VOICE_STYLE_BASE_URL}/${voiceId}.json`]);
      styleRef.current = style;
    } catch (err) {
      setError(`음성 스타일 로딩 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim() || !ttsRef.current || !styleRef.current) {
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setGenerateStep(0);

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      const { textToSpeech } = ttsRef.current;

      const result = await textToSpeech.call(
        text,
        selectedLanguage,
        styleRef.current,
        totalSteps,
        speed,
        0.3,
        (step: number, _total: number) => {
          setGenerateStep(step);
        }
      );

      const wavBuffer = writeWavFile(result.wav, AUDIO_CONFIG.sampleRate);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      setAudioUrl(url);
      setAudioDuration(result.duration[0]);
      setIsGenerating(false);
    } catch (err) {
      console.error('TTS generation error:', err);
      setError(`음성 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      setIsGenerating(false);
    }
  }, [text, selectedLanguage, totalSteps, speed, audioUrl]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const voiceName = VOICE_STYLES.find(v => v.id === selectedVoiceId)?.name || selectedVoiceId;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts_${voiceName}_${timestamp}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [audioUrl, selectedVoiceId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter' && !isGenerating && text.trim()) {
      handleGenerate();
    }
  }, [handleGenerate, isGenerating, text]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center z-10 bg-white p-10 rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="relative mb-6">
            <Loader2 className="w-16 h-16 mx-auto text-[#FF6B6B] animate-spin" />
            <Sparkles className="w-6 h-6 absolute -top-2 -right-2 text-[#FFE66D]" />
          </div>
          <h2 className="text-2xl font-black text-black mb-3">TTS 모델 로딩 중...</h2>
          <p className="text-gray-600 mb-4 font-medium">{loadingMessage}</p>
          <div className="w-64 mx-auto bg-gray-200 rounded-full h-4 border-2 border-black overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#FF6B6B] via-[#4ECDC4] to-[#FFE66D] h-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto p-6 flex flex-col lg:flex-row gap-6">
        {/* 사이드바 */}
        <aside className="w-full lg:w-80 bg-white rounded-3xl border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FF6B6B]" />
            TTS 설정
          </h2>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-black mb-2">
              <Languages className="w-4 h-4 text-[#4ECDC4]" />
              언어
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-[#FFFEF0] border-3 border-black rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-4 focus:ring-[#FFE66D] transition-all"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-bold text-black">
                <Mic className="w-4 h-4 text-[#FF6B6B]" />
                음성 스타일
              </label>
              <button
                onClick={() => setShowVoiceModal(true)}
                className="w-6 h-6 rounded-full bg-[#4ECDC4] border-2 border-black text-black text-xs font-bold flex items-center justify-center hover:bg-[#3dbdb5] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {VOICE_STYLES.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => handleVoiceChange(voice.id)}
                  title={voice.description}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition-all border-3 ${
                    selectedVoiceId === voice.id
                      ? voice.gender === 'male'
                        ? 'bg-[#4ECDC4] border-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#FF6B6B] border-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-white border-black text-black hover:bg-gray-100'
                  }`}
                >
                  {voice.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-black mb-2">
              <Gauge className="w-4 h-4 text-[#DDA0DD]" />
              속도: {speed.toFixed(2)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs font-medium text-gray-500 mt-1">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>2.0x</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-bold text-black mb-2">
              <Sparkles className="w-4 h-4 text-[#FFE66D]" />
              품질 (Steps): {totalSteps}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={totalSteps}
              onChange={(e) => setTotalSteps(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs font-medium text-gray-500 mt-1">
              <span>빠름</span>
              <span>고품질</span>
            </div>
          </div>
        </aside>

        {/* 메인 */}
        <main className="flex-1">
          {error && (
            <div className="mb-4 p-4 bg-[#FF6B6B] border-4 border-black rounded-2xl text-white font-medium shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {error}
              <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">
                <X className="w-5 h-5 inline" />
              </button>
            </div>
          )}

          <div className="mb-6 bg-white rounded-3xl border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <label className="block text-sm font-bold text-black mb-3">텍스트 입력</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="변환할 텍스트를 입력하세요..."
              className="w-full h-40 bg-[#FFFEF0] border-3 border-black rounded-2xl px-4 py-3 text-black placeholder-gray-400 font-medium focus:outline-none focus:ring-4 focus:ring-[#FFE66D] resize-none"
            />
            <p className="text-xs text-gray-500 mt-2 font-medium">
              Ctrl+Enter로 생성 | {text.length}자
            </p>
          </div>

          <div className="mb-6">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className={`w-full py-4 px-6 rounded-2xl font-black text-lg transition-all duration-150 flex items-center justify-center gap-3 border-4 border-black ${
                !text.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : isGenerating
                    ? 'btn-loading text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-wait'
                    : 'bg-[#FF6B6B] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px]'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" strokeWidth={3} />
                  <span>생성 중... ({generateStep}/{totalSteps})</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>음성 생성</span>
                </>
              )}
            </button>
          </div>

          {audioUrl && (
            <div className="bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-[#4ECDC4]" />
                  생성된 오디오
                </h3>
                <span className="text-sm font-bold text-gray-600 bg-[#FFFEF0] px-3 py-1 rounded-full border-2 border-black">
                  {formatDuration(audioDuration)} | {AUDIO_CONFIG.sampleRate}Hz
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayPause}
                  className="w-14 h-14 flex items-center justify-center bg-[#4ECDC4] rounded-2xl border-3 border-black hover:bg-[#3dbdb5] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px]"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-black" />
                  ) : (
                    <Play className="w-6 h-6 text-black ml-1" />
                  )}
                </button>

                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="flex-1 h-12"
                />

                <button
                  onClick={handleDownload}
                  className="px-5 py-3 bg-[#FFE66D] rounded-2xl border-3 border-black font-bold hover:bg-[#ffd93d] transition-all flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px]"
                >
                  <Download className="w-5 h-5" />
                  다운로드
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 로딩 오버레이 */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-white rounded-3xl border-4 border-black p-8 max-w-sm w-full mx-4 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="mb-4 relative">
              <div className="w-20 h-20 mx-auto bg-[#FFE66D] rounded-full border-4 border-black flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-black animate-spin" />
              </div>
              <Sparkles className="w-6 h-6 absolute top-0 right-1/4 text-[#FF6B6B] animate-pulse" />
            </div>
            <h3 className="text-2xl font-black text-black mb-2">음성 생성 중</h3>
            <p className="text-gray-600 font-medium mb-4">잠시만 기다려주세요...</p>
            <div className="mb-2">
              <div className="flex items-center justify-between text-sm font-bold text-gray-600 mb-2">
                <span>진행률</span>
                <span>{generateStep}/{totalSteps} ({Math.round((generateStep / totalSteps) * 100)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 border-3 border-black overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#FF6B6B] via-[#FFE66D] to-[#4ECDC4] h-full transition-all duration-300"
                  style={{ width: `${(generateStep / totalSteps) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 음성 스타일 모달 */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border-4 border-black max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between p-5 border-b-4 border-black bg-[#FFE66D]">
              <h2 className="text-xl font-black text-black flex items-center gap-2">
                <Mic className="w-6 h-6" />
                음성 스타일 안내
              </h2>
              <button
                onClick={() => setShowVoiceModal(false)}
                className="w-10 h-10 rounded-xl bg-white border-3 border-black text-black flex items-center justify-center hover:bg-gray-100 transition-colors shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <div className="mb-6">
                <h3 className="text-lg font-black text-black mb-3 flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#4ECDC4] rounded-full border-2 border-black"></div>
                  남성 음성
                </h3>
                <div className="space-y-3">
                  {VOICE_STYLES.filter(v => v.gender === 'male').map((voice) => (
                    <div
                      key={voice.id}
                      className={`p-4 rounded-2xl border-3 transition-all cursor-pointer ${
                        selectedVoiceId === voice.id
                          ? 'bg-[#4ECDC4] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-[#FFFEF0] border-black hover:bg-[#e8e7d8]'
                      }`}
                      onClick={() => {
                        handleVoiceChange(voice.id);
                        setShowVoiceModal(false);
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-black text-lg">{voice.name}</span>
                        {selectedVoiceId === voice.id && (
                          <span className="text-xs bg-black text-white px-2 py-1 rounded-full font-bold">선택됨</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 font-medium">{voice.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-black mb-3 flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#FF6B6B] rounded-full border-2 border-black"></div>
                  여성 음성
                </h3>
                <div className="space-y-3">
                  {VOICE_STYLES.filter(v => v.gender === 'female').map((voice) => (
                    <div
                      key={voice.id}
                      className={`p-4 rounded-2xl border-3 transition-all cursor-pointer ${
                        selectedVoiceId === voice.id
                          ? 'bg-[#FF6B6B] border-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-[#FFFEF0] border-black hover:bg-[#e8e7d8]'
                      }`}
                      onClick={() => {
                        handleVoiceChange(voice.id);
                        setShowVoiceModal(false);
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-black text-lg ${selectedVoiceId === voice.id ? 'text-white' : 'text-black'}`}>{voice.name}</span>
                        {selectedVoiceId === voice.id && (
                          <span className="text-xs bg-white text-[#FF6B6B] px-2 py-1 rounded-full font-bold">선택됨</span>
                        )}
                      </div>
                      <p className={`text-sm font-medium ${selectedVoiceId === voice.id ? 'text-white/90' : 'text-gray-700'}`}>{voice.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t-4 border-black">
              <button
                onClick={() => setShowVoiceModal(false)}
                className="w-full py-3 bg-black text-white rounded-2xl font-black hover:bg-gray-800 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
