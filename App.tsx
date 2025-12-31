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
      console.error("Error accessing mic:", err);
      setState(prev => ({ ...prev, error: "Could not access microphone. Please check permissions." }));
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
        const base64String = result.split(',')[1];
        resolve(base64String);
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
      console.error("Process Audio Error:", err);
      let errorMessage = "Oops! Something went wrong understanding the audio.";
      if (err.message === "API_KEY_MISSING") {
        errorMessage = "API Key is missing. Please set 'API_KEY' in your Vercel settings.";
      }
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
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
      console.error("Process Reply Error:", err);
      let errorMessage = "Failed to process your reply.";
      if (err.message === "API_KEY_MISSING") {
        errorMessage = "API Key is missing. Please check your settings.";
      }
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
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
      for (let i = 0; i < dataInt16.length; i++) {
        float32Data[i] = dataInt16[i] / 32768.0;
      }
      
      const buffer = ctx.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.error("TTS Error:", err);
      setState(prev => ({ ...prev, error: `Speech error: Please check your API key.` }));
    }
  };

  const shareToWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const enterReplyMode = (target: AppLanguage) => {
    setState(prev => ({ ...prev, replyTargetLanguage: target, replyResult: null }));
  };

  const exitReplyMode = () => {
    setState(prev => ({ ...prev, replyTargetLanguage: null, replyResult: null }));
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${state.darkMode ? 'bg-indigo-950 text-white' : 'bg-blue-50 text-indigo-950'} ${isRTL ? 'rtl-force' : 'ltr-force'}`}>
      
      {/* Header */}
      <header className="p-4 md:p-6 flex justify-between items-center max-w-4xl mx-auto sticky top-0 bg-blue-50/80 dark:bg-indigo-950/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-yellow-400 p-2 md:p-3 rounded-2xl shadow-lg transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
            <Languages size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight">{strings.title}</h1>
            <p className="hidden md:block text-[10px] opacity-75 font-medium">{strings.subtitle}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={toggleDarkMode}
            className={`p-2.5 rounded-2xl transition-all shadow-md active:scale-95 ${state.darkMode ? 'bg-indigo-800' : 'bg-white'}`}
            aria-label="Toggle Theme"
          >
            {state.darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-indigo-600" />}
          </button>
          <div className="flex bg-white dark:bg-indigo-900 rounded-2xl p-1 shadow-md gap-0.5">
            {(Object.values(AppLanguage)).map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${state.uiLanguage === lang ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-800'}`}
              >
                {lang === AppLanguage.ARABIC ? 'ع' : lang.toUpperCase().substring(0, 2)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-6 pb-44 pt-4 space-y-8">
        
        {/* Reply Overlay / UI */}
        {state.replyTargetLanguage && (
          <section className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <button onClick={exitReplyMode} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
              <X size={20} />
            </button>
            
            <div className="flex flex-col items-center gap-6">
              <div className="bg-white/20 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                {strings.replyTo} {state.replyTargetLanguage === AppLanguage.ENGLISH ? strings.english : strings.french}
              </div>
              
              <h2 className="text-xl font-bold text-center">{strings.speakDarija}</h2>
              
              <button
                onClick={state.isRecording ? stopRecording : () => startRecording(true)}
                className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative ${
                  state.isRecording ? 'bg-red-500 scale-110' : 'bg-white text-indigo-600 hover:scale-105'
                }`}
              >
                {state.isRecording ? (
                  <Square size={48} className="fill-white" />
                ) : (
                  <Mic size={48} />
                )}
                {state.isRecording && <div className="absolute inset-0 animate-ping rounded-full border-4 border-red-400 opacity-75"></div>}
              </button>
              
              {state.replyResult && !state.isLoading && (
                <div className="w-full space-y-4 animate-in fade-in slide-in-from-top-4">
                   <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                      <p className="text-xs font-bold opacity-60 uppercase mb-1">Darija</p>
                      <p className="text-lg rtl-force">{state.replyResult.childOriginalText}</p>
                   </div>
                   <div className="bg-white/20 p-4 rounded-2xl border border-white/30">
                      <p className="text-xs font-bold opacity-60 uppercase mb-1">{state.replyTargetLanguage.toUpperCase()}</p>
                      <p className="text-xl font-bold ltr-force">{state.replyResult.translatedReply}</p>
                   </div>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => shareToWhatsApp(state.replyResult!.translatedReply)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Send size={20} /> {strings.share}
                      </button>
                      <button 
                         onClick={() => playTTS(state.replyResult!.translatedReply, state.replyTargetLanguage!)}
                         className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center hover:bg-white/30"
                      >
                         <Volume2 />
                      </button>
                   </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Regular Translation Mode */}
        {!state.replyTargetLanguage && (
          <>
            <section className="bg-indigo-900/10 dark:bg-indigo-900 rounded-[2.5rem] p-8 shadow-inner border-2 border-indigo-200/30 dark:border-indigo-800 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 dark:bg-yellow-900/20 rounded-full blur-3xl opacity-50 -mr-16 -mt-16"></div>
              
              <div className="relative z-10 flex flex-col items-center gap-6">
                <button
                  onClick={state.isRecording ? stopRecording : () => startRecording(false)}
                  className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative group ${
                    state.isRecording ? 'bg-red-500 scale-110' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1'
                  }`}
                >
                  {state.isRecording ? <Square size={48} className="text-white fill-white" /> : <Mic size={56} className="text-white group-hover:scale-110 transition-transform" />}
                  {state.isRecording && <div className="absolute inset-0 animate-ping rounded-full border-4 border-red-400 opacity-75"></div>}
                </button>
                
                <div className="space-y-2">
                  <h2 className="text-xl font-bold">
                    {state.isRecording ? strings.recording : strings.tapToSpeak}
                  </h2>
                  {!state.isRecording && (
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-bold text-indigo-500 hover:text-indigo-600 transition-colors">
                      <FileUp size={16} />
                      {strings.uploadAudio}
                      <input type="file" className="hidden" accept="audio/*" onChange={(e) => e.target.files?.[0] && handleProcessAudio(e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>
            </section>

            {state.isLoading && (
              <div className="flex flex-col items-center gap-4 py-12">
                <Loader2 size={56} className="text-indigo-500 animate-spin" />
                <p className="font-black text-indigo-500 animate-pulse tracking-widest uppercase text-xs">{strings.processing}</p>
              </div>
            )}

            {state.error && (
              <div className="bg-red-100 dark:bg-red-950/50 p-8 rounded-3xl border-2 border-red-200 dark:border-red-900 text-center flex flex-col items-center gap-4 shadow-xl animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-red-500 text-white p-3 rounded-full shadow-lg">
                  <AlertCircle size={32} />
                </div>
                <p className="text-red-700 dark:text-red-300 font-bold text-lg leading-snug">
                  {state.error}
                </p>
                <button 
                  onClick={() => setState(prev => ({ ...prev, error: null }))}
                  className="bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95"
                >
                  {strings.retry}
                </button>
              </div>
            )}

            {state.transcription && !state.isLoading && (
              <section className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-2 h-8 bg-pink-500 rounded-full shadow-sm"></div>
                  <h3 className="text-lg font-black uppercase tracking-widest opacity-60">Resultats</h3>
                </div>

                <div className="grid gap-6">
                  <TranslationCard 
                    label={strings.original} 
                    text={state.transcription.originalText} 
                    langCode={state.transcription.detectedLanguage}
                    onPlay={() => playTTS(state.transcription!.originalText, state.transcription!.detectedLanguage)}
                    onShare={() => shareToWhatsApp(state.transcription!.originalText)}
                    colorClass="border-indigo-400"
                    darkMode={state.darkMode}
                  />

                  {state.transcription.translations.ar && (
                    <TranslationCard 
                      label={strings.arabic} 
                      text={state.transcription.translations.ar} 
                      langCode="ar"
                      onPlay={() => playTTS(state.transcription!.translations.ar, 'ar')}
                      onShare={() => shareToWhatsApp(state.transcription!.translations.ar)}
                      colorClass="border-emerald-400"
                      darkMode={state.darkMode}
                    />
                  )}

                  <TranslationCard 
                    label={strings.english} 
                    text={state.transcription.translations.en} 
                    langCode="en"
                    onPlay={() => playTTS(state.transcription!.translations.en, 'en')}
                    onShare={() => shareToWhatsApp(state.transcription!.translations.en)}
                    onReply={() => enterReplyMode(AppLanguage.ENGLISH)}
                    colorClass="border-sky-400"
                    showReply
                    darkMode={state.darkMode}
                  />

                  <TranslationCard 
                    label={strings.french} 
                    text={state.transcription.translations.fr} 
                    langCode="fr"
                    onPlay={() => playTTS(state.transcription!.translations.fr, 'fr')}
                    onShare={() => shareToWhatsApp(state.transcription!.translations.fr)}
                    onReply={() => enterReplyMode(AppLanguage.FRENCH)}
                    colorClass="border-violet-400"
                    showReply
                    darkMode={state.darkMode}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer Nav */}
      {!state.isRecording && !state.isLoading && !state.replyTargetLanguage && (
        <footer className="fixed bottom-6 left-0 right-0 px-6 max-w-xl mx-auto z-40">
          <div className="bg-white/95 dark:bg-indigo-900/95 backdrop-blur-md rounded-[2.5rem] p-3 shadow-2xl flex justify-around items-center border border-indigo-100 dark:border-indigo-800">
            <div className="flex flex-col items-center gap-0.5 opacity-40 cursor-not-allowed group">
              <Languages size={20} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-[9px] font-black tracking-tighter text-indigo-900 dark:text-indigo-200">LEARN</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-indigo-600 dark:text-white group">
              <div className="bg-indigo-600 dark:bg-white text-white dark:text-indigo-900 p-3 rounded-2xl group-active:scale-90 transition-transform shadow-xl">
                <Mic size={24} />
              </div>
              <span className="text-[9px] font-black tracking-tighter text-indigo-900 dark:text-white">SPEAK</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 opacity-40 cursor-not-allowed group">
              <MessageCircle size={20} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-[9px] font-black tracking-tighter text-indigo-900 dark:text-indigo-200">CHAT</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

interface TranslationCardProps {
  label: string;
  text: string;
  langCode: string;
  onPlay: () => void;
  onShare: () => void;
  onReply?: () => void;
  showReply?: boolean;
  colorClass: string;
  darkMode: boolean;
}

const TranslationCard: React.FC<TranslationCardProps> = ({ 
  label, text, langCode, onPlay, onShare, onReply, showReply, colorClass, darkMode
}) => {
  const isArabic = langCode === 'ar' || /[\u0600-\u06FF]/.test(text);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };
  
  return (
    <div className={`bg-white dark:bg-indigo-900/50 p-6 md:p-8 rounded-[2.5rem] shadow-xl border-l-[10px] ${colorClass} group hover:shadow-2xl hover:-translate-y-1 transition-all border border-indigo-50 dark:border-transparent`}>
      <div className="flex justify-between items-start mb-4">
        <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm ${
          darkMode ? 'bg-indigo-800 text-indigo-100' : 'bg-indigo-900 text-white'
        }`}>
          {label}
        </span>
        
        <div className="flex gap-2">
          <button 
            onClick={handleCopy} 
            className={`p-2.5 rounded-xl transition-all active:scale-90 shadow-sm ${
              darkMode ? 'bg-indigo-800 text-indigo-300 hover:bg-indigo-700' : 'bg-indigo-950 text-white hover:bg-indigo-800'
            }`}
            title="Copy to clipboard"
          >
            {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
          </button>
          
          <button 
            onClick={onShare} 
            className={`p-2.5 rounded-xl transition-all active:scale-90 shadow-sm ${
              darkMode ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-800/50' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
            title="Share to WhatsApp"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>
      
      <p className={`text-xl md:text-2xl font-bold leading-relaxed mb-8 ${isArabic ? 'rtl-force text-right' : 'ltr-force text-left'} ${darkMode ? 'text-white' : 'text-indigo-950'}`}>
        {text}
      </p>

      <div className="flex justify-between items-center gap-3">
        {showReply && onReply && (
          <button
            onClick={onReply}
            className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-5 py-3 rounded-2xl font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <Undo2 size={18} />
            <span className="uppercase tracking-tighter">Reply</span>
          </button>
        )}
        <button
          onClick={onPlay}
          className="flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-lg ml-auto"
        >
          <Volume2 size={18} />
          <span className="uppercase tracking-tighter">Listen</span>
        </button>
      </div>
    </div>
  );
};

export default App;