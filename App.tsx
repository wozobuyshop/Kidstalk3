import React, { useState, useRef } from 'react';
import { AppLanguage, AppState } from './types';
import { UI_STRINGS } from './translations';
import { processAudio, processReply, generateSpeech } from './services/geminiService';
import { 
  Mic, 
  Square, 
  Languages, 
  Moon, 
  Sun, 
  Volume2, 
  Share2, 
  Loader2, 
  FileUp,
  MessageCircle,
  Undo2,
  Send,
  X,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    uiLanguage: AppLanguage.ARABIC,
    darkMode: false,
    isRecording: false,
    replyTargetLanguage: null,
    audioBlob: null,
    transcription: null,
    replyResult: null,
    isLoading: false,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const strings = UI_STRINGS[state.uiLanguage];
  const isRTL = state.uiLanguage === AppLanguage.ARABIC;

  const toggleDarkMode = () => setState(prev => ({ ...prev, darkMode: !prev.darkMode }));
  const setLanguage = (lang: AppLanguage) => setState(prev => ({ ...prev, uiLanguage: lang }));

  const startRecording = async (isReply: boolean = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (isReply && state.replyTargetLanguage) {
          handleProcessReply(audioBlob, state.replyTargetLanguage);
        } else {
          handleProcessAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setState(prev => ({ ...prev, isRecording: true, error: null }));
    } catch (err) {
      console.error("Mic access error:", err);
      setState(prev => ({ ...prev, error: "Could not access microphone." }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setState(prev => ({ ...prev, isRecording: false }));
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const checkApiKey = () => {
    const key = process.env.API_KEY;
    if (!key || key === "undefined" || key === "") {
      throw new Error("API_KEY_MISSING");
    }
  };

  const handleProcessAudio = async (blob: Blob) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, transcription: null, replyResult: null }));
    try {
      checkApiKey();
      const base64 = await blobToBase64(blob);
      const result = await processAudio(base64, blob.type);
      setState(prev => ({ ...prev, transcription: result, isLoading: false }));
    } catch (err: any) {
      console.error("Gemini Error:", err);
      let msg = "Something went wrong. Please try speaking again.";
      if (err.message === "API_KEY_MISSING") msg = "API Key is missing from Vercel settings.";
      setState(prev => ({ ...prev, isLoading: false, error: msg }));
    }
  };

  const handleProcessReply = async (blob: Blob, target: AppLanguage) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, replyResult: null }));
    try {
      checkApiKey();
      const base64 = await blobToBase64(blob);
      const result = await processReply(base64, blob.type, target === AppLanguage.ENGLISH ? 'English' : 'French');
      setState(prev => ({ ...prev, replyResult: result, isLoading: false }));
      playTTS(result.translatedReply, target);
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false, error: "Reply failed. Try again." }));
    }
  };

  const playTTS = async (text: string, lang: string) => {
    try {
      checkApiKey();
      const base64Audio = await generateSpeech(text, lang);
      const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const dataInt16 = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
      const float32Data = new Float32Array(dataInt16.length);
      for (let i = 0; i < dataInt16.length; i++) float32Data[i] = dataInt16[i] / 32768.0;
      const buffer = ctx.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.error("TTS Error:", err);
    }
  };

  const shareToWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${state.darkMode ? 'bg-indigo-950 text-white' : 'bg-blue-50 text-indigo-950'} ${isRTL ? 'rtl-force' : 'ltr-force'}`}>
      
      {/* Header */}
      <header className="p-4 flex justify-between items-center max-w-4xl mx-auto sticky top-0 bg-blue-50/80 dark:bg-indigo-950/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-400 p-2 rounded-2xl shadow-lg transform -rotate-3">
            <Languages size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase">{strings.title}</h1>
            <p className="hidden md:block text-[10px] opacity-75">{strings.subtitle}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={toggleDarkMode} className={`p-2 rounded-2xl ${state.darkMode ? 'bg-indigo-800' : 'bg-white shadow-md'}`}>
            {state.darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-indigo-600" />}
          </button>
          <div className="flex bg-white dark:bg-indigo-900 rounded-2xl p-1 shadow-md">
            {(Object.values(AppLanguage)).map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${state.uiLanguage === lang ? 'bg-indigo-600 text-white' : 'text-indigo-600 dark:text-indigo-300'}`}
              >
                {lang === AppLanguage.ARABIC ? 'ع' : lang.toUpperCase().substring(0, 2)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main UI */}
      <main className="max-w-xl mx-auto px-6 pb-44 pt-4 space-y-8">
        
        {state.replyTargetLanguage ? (
          <section className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-[2.5rem] p-8 shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setState(p => ({ ...p, replyTargetLanguage: null }))} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full"><X size={20} /></button>
            <div className="flex flex-col items-center gap-6">
              <h2 className="text-xl font-bold">{strings.speakDarija}</h2>
              <button
                onClick={state.isRecording ? stopRecording : () => startRecording(true)}
                className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl ${state.isRecording ? 'bg-red-500 animate-pulse' : 'bg-white text-indigo-600'}`}
              >
                {state.isRecording ? <Square size={48} fill="white" /> : <Mic size={48} />}
              </button>
              
              {state.replyResult && !state.isLoading && (
                <div className="w-full space-y-4">
                   <div className="bg-white/20 p-4 rounded-2xl border border-white/30">
                      <p className="text-xs font-bold opacity-70 uppercase mb-1">Translation</p>
                      <p className="text-xl font-bold ltr-force">{state.replyResult.translatedReply}</p>
                   </div>
                   <button onClick={() => shareToWhatsApp(state.replyResult!.translatedReply)} className="w-full bg-green-500 py-4 rounded-2xl font-black flex items-center justify-center gap-2"><Send /> {strings.share}</button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="bg-indigo-900/10 dark:bg-indigo-900 rounded-[2.5rem] p-8 shadow-inner border-2 border-indigo-100 dark:border-indigo-800 text-center">
              <button
                onClick={state.isRecording ? stopRecording : () => startRecording(false)}
                className={`w-36 h-36 mx-auto rounded-full flex items-center justify-center shadow-2xl transition-all ${state.isRecording ? 'bg-red-500 scale-110' : 'bg-indigo-600'}`}
              >
                {state.isRecording ? <Square size={48} fill="white" /> : <Mic size={56} className="text-white" />}
              </button>
              <h2 className="text-xl font-bold mt-6">{state.isRecording ? strings.recording : strings.tapToSpeak}</h2>
              <label className="mt-4 inline-flex items-center gap-2 cursor-pointer text-sm font-bold text-indigo-500">
                <FileUp size={16} /> {strings.uploadAudio}
                <input type="file" className="hidden" accept="audio/*" onChange={(e) => e.target.files?.[0] && handleProcessAudio(e.target.files[0])} />
              </label>
            </section>

            {state.isLoading && <div className="text-center py-12"><Loader2 size={56} className="animate-spin text-indigo-500 mx-auto" /></div>}

            {state.error && (
              <div className="bg-red-50 p-8 rounded-3xl border-2 border-red-200 text-center space-y-4">
                <AlertCircle size={48} className="text-red-500 mx-auto" />
                <p className="text-red-700 font-bold">{state.error}</p>
                <button onClick={() => setState(p => ({ ...p, error: null }))} className="bg-red-500 text-white px-8 py-3 rounded-xl font-black">{strings.retry}</button>
              </div>
            )}

            {state.transcription && !state.isLoading && (
              <div className="grid gap-6">
                <TranslationCard label={strings.original} text={state.transcription.originalText} langCode={state.transcription.detectedLanguage} onPlay={() => playTTS(state.transcription!.originalText, state.transcription!.detectedLanguage)} color="border-indigo-400" />
                <TranslationCard label={strings.english} text={state.transcription.translations.en} langCode="en" onPlay={() => playTTS(state.transcription!.translations.en, 'en')} onReply={() => setState(p => ({ ...p, replyTargetLanguage: AppLanguage.ENGLISH }))} color="border-sky-400" showReply />
                <TranslationCard label={strings.french} text={state.transcription.translations.fr} langCode="fr" onPlay={() => playTTS(state.transcription!.translations.fr, 'fr')} onReply={() => setState(p => ({ ...p, replyTargetLanguage: AppLanguage.FRENCH }))} color="border-violet-400" showReply />
              </div>
            )}
          </>
        )}
      </main>

      {/* Nav */}
      <footer className="fixed bottom-6 left-0 right-0 px-6 max-w-xl mx-auto">
        <div className="bg-white/95 dark:bg-indigo-900/95 backdrop-blur-md rounded-[2.5rem] p-3 shadow-2xl flex justify-around items-center border border-indigo-50 dark:border-indigo-800">
          <div className="opacity-40"><Languages /></div>
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-xl"><Mic /></div>
          <div className="opacity-40"><MessageCircle /></div>
        </div>
      </footer>
    </div>
  );
};

const TranslationCard: React.FC<any> = ({ label, text, langCode, onPlay, onReply, showReply, color }) => {
  const isArabic = langCode === 'ar' || /[\u0600-\u06FF]/.test(text);
  return (
    <div className={`bg-white dark:bg-indigo-900/50 p-6 rounded-[2.5rem] shadow-xl border-l-[10px] ${color} transition-all`}>
      <span className="text-[10px] font-black uppercase px-3 py-1 bg-indigo-900 text-white rounded-full">{label}</span>
      <p className={`text-xl font-bold my-6 ${isArabic ? 'rtl-force text-right' : 'ltr-force text-left'}`}>{text}</p>
      <div className="flex justify-between">
        {showReply && <button onClick={onReply} className="flex items-center gap-2 bg-pink-500 text-white px-4 py-2 rounded-xl font-black text-xs"><Undo2 size={16}/> Reply</button>}
        <button onClick={onPlay} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-xs ml-auto"><Volume2 size={16}/> Listen</button>
      </div>
    </div>
  );
};

export default App;