
import React, { useState, useRef, useEffect } from 'react';
import type { CharacterProfile, GeneratedResult } from '../types';
import { LoadingSpinnerIcon, MicIcon, PlayIcon, PauseIcon, DownloadIcon, SparklesIcon, TrashIcon, PhotoIcon } from './icons';
import { generateAudioFromScript } from '../services/geminiService';

interface CharacterInputFormProps {
  characterProfiles: CharacterProfile[];
  setCharacterProfiles: React.Dispatch<React.SetStateAction<CharacterProfile[]>>;
  storyScene: string;
  setStoryScene: React.Dispatch<React.SetStateAction<string>>;
  storyTitle: string;
  setStoryTitle: React.Dispatch<React.SetStateAction<string>>;
  storyMode: 'detail' | 'fromTitle' | 'fromVoiceover';
  setStoryMode: React.Dispatch<React.SetStateAction<'detail' | 'fromTitle' | 'fromVoiceover'>>;
  storyLength: 'Short' | 'Medium' | 'Long';
  setStoryLength: React.Dispatch<React.SetStateAction<'Short' | 'Medium' | 'Long'>>;
  videoLengthMinutes: number;
  setVideoLengthMinutes: React.Dispatch<React.SetStateAction<number>>;
  videoStyle: string;
  setVideoStyle: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
  isLoading: boolean;
  result: GeneratedResult | null;
  onGenerateVoiceover: () => void;
  isVoiceoverLoading: boolean;
  onEnhanceScript: () => void;
  isEnhancingScript: boolean;
  selectedVoice: string;
  setSelectedVoice: React.Dispatch<React.SetStateAction<string>>;
  onGenerateAudio: () => void;
  isAudioLoading: boolean;
  isTranslating: boolean;
  editableVoiceoverScript: string;
  setEditableVoiceoverScript: React.Dispatch<React.SetStateAction<string>>;
  voiceoverScriptInput: string;
  setVoiceoverScriptInput: React.Dispatch<React.SetStateAction<string>>;
  thumbnailPrompt: string;
  setThumbnailPrompt: React.Dispatch<React.SetStateAction<string>>;
  onGenerateStandaloneThumbnail: () => void;
  isStandaloneThumbnailLoading: boolean;
}

const InputField: React.FC<{
  id: string;
  name?: string;
  label: string;
  value: string | number;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  min?: string;
  step?: string;
}> = ({ id, name, label, value, placeholder, onChange, type = "text", ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-text-medium mb-2">
      {label}
    </label>
    <input
      type={type}
      id={id}
      name={name || id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent/50 border-transparent transition-all duration-300"
      {...props}
    />
  </div>
);

const TextareaField: React.FC<{
  id: string;
  name?: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
}> = ({ id, name, label, value, placeholder, onChange, rows = 4, required = false, disabled = false, maxLength }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-text-medium mb-2">
      {label} {required && <span className="text-accent">*</span>}
    </label>
    <textarea
      id={id}
      name={name || id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      maxLength={maxLength}
      className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent/50 border-transparent transition-all duration-300 disabled:opacity-50"
    />
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex-1 py-2 px-4 text-sm font-semibold rounded-full transition-all duration-300 focus:outline-none ${
            active 
            ? 'bg-accent text-dark-bg shadow-md shadow-accent/30' 
            : 'text-text-medium hover:text-text-light'
        }`}
    >
        {children}
    </button>
)

const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
};

const createWavFile = (pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob => {
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const pcm = new Uint8Array(pcmData);
    for (let i = 0; i < dataSize; i++) {
        view.setUint8(44 + i, pcm[i]);
    }
    
    return new Blob([view], { type: 'audio/wav' });
};


export const CharacterInputForm: React.FC<CharacterInputFormProps> = ({
  characterProfiles,
  setCharacterProfiles,
  storyScene,
  setStoryScene,
  storyTitle,
  setStoryTitle,
  storyMode,
  setStoryMode,
  storyLength,
  setStoryLength,
  videoLengthMinutes,
  setVideoLengthMinutes,
  videoStyle,
  setVideoStyle,
  onSubmit,
  isLoading,
  result,
  onGenerateVoiceover,
  isVoiceoverLoading,
  onEnhanceScript,
  isEnhancingScript,
  selectedVoice,
  setSelectedVoice,
  onGenerateAudio,
  isAudioLoading,
  isTranslating,
  editableVoiceoverScript,
  setEditableVoiceoverScript,
  voiceoverScriptInput,
  setVoiceoverScriptInput,
  thumbnailPrompt,
  setThumbnailPrompt,
  onGenerateStandaloneThumbnail,
  isStandaloneThumbnailLoading,
}) => {
  const [activeStep, setActiveStep] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [sampleLoadingVoice, setSampleLoadingVoice] = useState<string | null>(null);
  const VOICEOVER_CHAR_LIMIT = 5000;

  const [audioState, setAudioState] = useState<'paused' | 'playing' | 'stopped'>('stopped');
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const pauseTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  
    const handleAddCharacter = () => {
        setCharacterProfiles(prev => [...prev, { name: '', appearance: '' }]);
    };

    const handleRemoveCharacter = (index: number) => {
        setCharacterProfiles(prev => prev.filter((_, i) => i !== index));
    };


  const handleProfileChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCharacterProfiles(prev => {
        const newProfiles = [...prev];
        newProfiles[index] = { ...newProfiles[index], [name]: value };
        return newProfiles;
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  }

  const predefinedStyles = [
    '3D Pixar style', 'Cinematic', 'Anime', 'Realistic', 'Claymation',
    'Watercolor', 'Comic Book', 'Fantasy Art', 'Cyberpunk', 'Steampunk'
  ];
  const isCustomStyle = !predefinedStyles.includes(videoStyle);
  const selectValue = isCustomStyle ? 'Other' : videoStyle;
  
  const voices = [
    { name: 'Pikaza (Mature Male)', id: 'Fenrir' },
    { name: 'Zephyr', id: 'Zephyr' },
    { name: 'Kore', id: 'Kore' },
    { name: 'Puck', id: 'Puck' },
    { name: 'Charon', id: 'Charon' },
  ];

  const handleStyleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'Other') setVideoStyle('');
    else setVideoStyle(value);
  };

  const handleCustomStyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoStyle(e.target.value);
  }

  useEffect(() => {
    if (result?.voiceoverAudio) {
      if (audioSourceNodeRef.current) {
        audioSourceNodeRef.current.onended = null;
        try { audioSourceNodeRef.current.stop(); } catch (e) { /* ignore */ }
      }
      setAudioState('stopped');
      audioBufferRef.current = null;
      audioSourceNodeRef.current = null;
      pauseTimeRef.current = 0;
    }
  }, [result?.voiceoverAudio]);


  const playAudio = async () => {
    if (!result?.voiceoverAudio) return;
  
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioBufferRef.current = null; // force re-decoding
    }
    const audioContext = audioContextRef.current;
  
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  
    if (!audioBufferRef.current) {
      try {
        audioBufferRef.current = await decodeAudioData(decode(result.voiceoverAudio), audioContext, 24000, 1);
      } catch (e) {
        console.error("Failed to decode audio:", e);
        return;
      }
    }
  
    const source = audioContext.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.playbackRate.value = playbackRate;
    source.connect(audioContext.destination);
  
    source.onended = () => {
      if (audioSourceNodeRef.current === source) {
        setAudioState('stopped');
        pauseTimeRef.current = 0;
        audioSourceNodeRef.current = null;
      }
    };
  
    const offset = pauseTimeRef.current % (audioBufferRef.current?.duration || 1);
    source.start(0, offset);
  
    audioSourceNodeRef.current = source;
    startTimeRef.current = audioContext.currentTime - offset;
    setAudioState('playing');
  };
  
  const pauseAudio = () => {
    if (!audioSourceNodeRef.current || !audioContextRef.current) return;
  
    const elapsedTime = audioContextRef.current.currentTime - startTimeRef.current;
    pauseTimeRef.current = elapsedTime;
  
    audioSourceNodeRef.current.onended = null; 
    try { audioSourceNodeRef.current.stop(); } catch (e) { /* ignore */ }
    audioSourceNodeRef.current = null;
  
    setAudioState('paused');
  };
  
  const handlePlayPause = () => {
    if (audioState === 'playing') {
      pauseAudio();
    } else {
      playAudio();
    }
  };


  const handlePlaySampleVoice = async () => {
    if (sampleLoadingVoice) return;
    setSampleLoadingVoice(selectedVoice);
    try {
        const sampleText = "Hello, you can choose this voice for your story.";
        const audioB64 = await generateAudioFromScript(sampleText, selectedVoice);

        if (!audioContextRef.current) {
            audioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const audioContext = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(audioB64), audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRate;
        source.connect(audioContext.destination);
        source.start();
    } catch (e) {
        console.error("Failed to play sample audio:", e);
    } finally {
        setSampleLoadingVoice(null);
    }
  };

  const handleDownloadVoiceover = () => {
    if (!result?.voiceoverAudio) return;
    const pcmData = decode(result.voiceoverAudio);
    const wavBlob = createWavFile(pcmData, 24000, 1, 16);
    const url = URL.createObjectURL(wavBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'voiceover.wav';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const navItems = [
    { step: 1, title: 'Define Characters & Story' },
    { step: 2, title: 'Define Video Style' },
    { step: 3, title: 'Configure Video Output' },
    { step: 4, title: 'Generate Voiceover & Thumbnail' },
  ];
  
  const isSubmitDisabled = isLoading || (storyMode === 'detail'
      ? !characterProfiles.some(c => c.appearance.trim()) || !storyScene.trim()
      : storyMode === 'fromTitle'
      ? !storyTitle.trim()
      : !voiceoverScriptInput.trim()
  );
  const submitButtonText = 'Generate Story & Prompts';


  const NavItem: React.FC<{ step: number; title: string; disabled?: boolean }> = ({ step, title, disabled = false }) => (
      <button
        type="button"
        onClick={() => setActiveStep(step)}
        disabled={disabled}
        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
          activeStep === step
            ? 'bg-accent/10 text-accent'
            : 'text-text-medium hover:bg-white/5 hover:text-text-light'
        } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
      >
        <span className={`font-bold mr-2 ${activeStep === step ? 'text-accent' : 'text-text-medium'}`}>{step}.</span> {title}
      </button>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-dark-card rounded-3xl p-4 shadow-soft-outset flex h-full transition-shadow duration-300 hover:shadow-accent-glow">
        <nav className="w-1/3 border-r border-white/10 pr-4 flex flex-col space-y-2">
            {navItems.map(item => <NavItem key={item.step} {...item} />)}
        </nav>
        
        <div className="w-2/3 pl-4 flex flex-col">
            <div className="flex-grow space-y-8 overflow-y-auto p-4 -m-4">
                {activeStep === 1 && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display text-text-light">1. Define Characters & Story</h2>
                        
                        <div className="flex bg-dark-input p-1 rounded-full space-x-1 shadow-soft-inset">
                            <TabButton active={storyMode === 'detail'} onClick={() => setStoryMode('detail')}>Detailed Scene</TabButton>
                            <TabButton active={storyMode === 'fromTitle'} onClick={() => setStoryMode('fromTitle')}>From Title</TabButton>
                            <TabButton active={storyMode === 'fromVoiceover'} onClick={() => setStoryMode('fromVoiceover')}>From Voiceover</TabButton>
                        </div>

                        {storyMode === 'detail' && (
                            <div className="space-y-4">
                                {characterProfiles.map((profile, index) => (
                                    <div key={index} className="bg-dark-input rounded-2xl p-4 shadow-soft-inset space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-semibold text-accent">Character {index + 1}</h3>
                                            {characterProfiles.length > 1 && (
                                                <button type="button" onClick={() => handleRemoveCharacter(index)} className="p-2 rounded-full hover:bg-white/10 text-text-medium hover:text-accent">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                        <InputField id={`name-${index}`} name="name" label="Name" value={profile.name} onChange={(e) => handleProfileChange(index, e)} placeholder="e.g., Kaelen" />
                                        <TextareaField id={`appearance-${index}`} name="appearance" label="Appearance Details" value={profile.appearance} onChange={(e) => handleProfileChange(index, e)} placeholder="e.g., silver hair, glowing cybernetic eye, worn leather jacket" rows={3} required />
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddCharacter} className="w-full py-2 px-4 border-2 border-dashed border-text-medium/50 rounded-xl text-text-medium hover:text-text-light hover:border-text-medium transition-colors">
                                    + Add Another Character
                                </button>
                            </div>
                        )}

                        {storyMode === 'detail' && (
                            <TextareaField id="storyScene" label="Story Scene / Plot Point" value={storyScene} placeholder="Describe the action. e.g., 'Kaelen stands on a rain-slicked rooftop at midnight...'" onChange={(e) => setStoryScene(e.target.value)} rows={5} required />
                        )}

                        {storyMode === 'fromTitle' && (
                            <div className="space-y-6">
                                <TextareaField id="storyTitle" label="Story Title" value={storyTitle} placeholder="e.g., 'The Clockwork Alchemist of Neo-Prague'" onChange={(e) => setStoryTitle(e.target.value)} rows={3} required />
                                <div>
                                    <label className="block text-sm font-medium text-text-medium mb-2">Desired Story Length</label>
                                    <div className="flex bg-dark-input p-1 rounded-full space-x-1 shadow-soft-inset">
                                        <TabButton active={storyLength === 'Short'} onClick={() => setStoryLength('Short')}>Short</TabButton>
                                        <TabButton active={storyLength === 'Medium'} onClick={() => setStoryLength('Medium')}>Medium</TabButton>
                                        <TabButton active={storyLength === 'Long'} onClick={() => setStoryLength('Long')}>Long</TabButton>
                                    </div>
                                </div>
                            </div>
                        )}

                        {storyMode === 'fromVoiceover' && (
                           <TextareaField 
                                id="voiceoverScriptInput" 
                                label="Voiceover Script" 
                                value={voiceoverScriptInput} 
                                placeholder="Paste your full voiceover script here. The AI will extract characters, write a story, and generate prompts from it." 
                                onChange={(e) => setVoiceoverScriptInput(e.target.value)} 
                                rows={10} 
                                required 
                            />
                        )}
                    </div>
                )}
                {activeStep === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display text-text-light">2. Define Video Style</h2>
                        <div>
                            <label htmlFor="videoStyleSelect" className="block text-sm font-medium text-text-medium mb-2">Video Style</label>
                            <select id="videoStyleSelect" value={selectValue} onChange={handleStyleSelectChange} className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent/50 border-transparent transition-all duration-300 appearance-none">
                                {predefinedStyles.map(style => <option key={style} value={style}>{style}</option>)}
                                <option value="Other">Other (Specify)</option>
                            </select>
                        </div>
                        {selectValue === 'Other' && (
                            <InputField id="customVideoStyle" label="Custom Style" value={videoStyle} onChange={handleCustomStyleChange} placeholder="e.g., Low-poly, Impressionistic" />
                        )}
                    </div>
                )}
                {activeStep === 3 && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display text-text-light">3. Configure Video Output</h2>
                        <div>
                            <InputField
                                label="Video Length (minutes)"
                                id="videoLength"
                                type="number"
                                value={videoLengthMinutes}
                                onChange={(e) => setVideoLengthMinutes(parseFloat(e.target.value))}
                                min="0.1"
                                step="0.1"
                                placeholder="e.g., 1.5"
                            />
                            <p className="text-xs text-text-medium mt-2 text-right">An 8-second scene is generated for approx. every 0.13 minutes.</p>
                        </div>
                    </div>
                )}
                {activeStep === 4 && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display text-text-light">4. Generate Voiceover & Thumbnail</h2>
                        <>
                            <p className="text-text-medium">Generate a voiceover script from your story, or write your own.</p>
                            <button
                                type="button"
                                onClick={onGenerateVoiceover}
                                disabled={isVoiceoverLoading || !result || !result.storyScript}
                                className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-input shadow-soft-outset hover:text-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                title={!result?.storyScript ? "Generate a story first to enable this" : "Generate voiceover script from story"}
                            >
                                {isVoiceoverLoading ? (
                                    <><LoadingSpinnerIcon /> Generating Script...</>
                                ) : (
                                    <><MicIcon className="w-4 h-4" /> Generate from Story</>
                                )}
                            </button>
                            
                            <div className="relative">
                                <TextareaField
                                    id="voiceover-script"
                                    label="Voiceover Script"
                                    value={editableVoiceoverScript}
                                    onChange={(e) => setEditableVoiceoverScript(e.target.value)}
                                    rows={8}
                                    placeholder="Your voiceover script will appear here, or you can paste your own..."
                                    maxLength={VOICEOVER_CHAR_LIMIT}
                                />
                                <button
                                    type="button"
                                    onClick={onEnhanceScript}
                                    disabled={isEnhancingScript || !editableVoiceoverScript.trim()}
                                    className="absolute bottom-4 right-4 p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition disabled:opacity-50"
                                    title="Auto Enhance Script"
                                >
                                    {isEnhancingScript ? <LoadingSpinnerIcon /> : <SparklesIcon className="w-5 h-5" />}
                                </button>
                            </div>

                            <p className={`text-xs text-right mt-1 px-2 ${editableVoiceoverScript.length > VOICEOVER_CHAR_LIMIT ? 'text-accent' : 'text-text-medium'}`}>
                                {editableVoiceoverScript.length} / {VOICEOVER_CHAR_LIMIT} characters
                            </p>
                            
                            <div>
                                <label htmlFor="voiceSelect" className="block text-sm font-medium text-text-medium mb-2">Character Voice</label>
                                <div className="flex items-center gap-2">
                                    <select id="voiceSelect" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent/50 border-transparent transition-all duration-300 appearance-none">
                                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handlePlaySampleVoice}
                                        disabled={!!sampleLoadingVoice}
                                        className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition disabled:opacity-50"
                                        title={`Play sample for ${voices.find(v => v.id === selectedVoice)?.name}`}
                                    >
                                        {sampleLoadingVoice === selectedVoice ? <LoadingSpinnerIcon /> : <PlayIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="speedControl" className="block text-sm font-medium text-text-medium mb-2">
                                    Playback Speed: {playbackRate.toFixed(1)}x
                                </label>
                                <input
                                    type="range"
                                    id="speedControl"
                                    min="1.0"
                                    max="3.0"
                                    step="0.1"
                                    value={playbackRate}
                                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-dark-input rounded-lg appearance-none cursor-pointer accent-accent"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={onGenerateAudio}
                                    disabled={isAudioLoading || !editableVoiceoverScript.trim() || editableVoiceoverScript.length > VOICEOVER_CHAR_LIMIT}
                                    className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-input shadow-soft-outset hover:text-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {isAudioLoading ? (
                                        <><LoadingSpinnerIcon /> {isTranslating ? 'Translating...' : 'Generating Audio...'}</>
                                    ) : (
                                        <><MicIcon className="w-4 h-4" /> Generate Full Audio</>
                                    )}
                                </button>
                                {result?.voiceoverAudio && (
                                    <>
                                        <button type="button" onClick={handlePlayPause} className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-accent border-2 border-accent/50 hover:bg-accent/10 focus:outline-none transition w-40">
                                            {audioState === 'playing' ? (
                                                <>
                                                    <PauseIcon className="w-4 h-4 mr-1" />
                                                    Pause
                                                </>
                                            ) : (
                                                <>
                                                    <PlayIcon className="w-4 h-4 mr-1" />
                                                    {audioState === 'paused' ? 'Resume' : 'Play'}
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDownloadVoiceover}
                                            className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
                                            title="Download Voiceover (.wav)"
                                        >
                                            <DownloadIcon className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                        <hr className="border-white/10 my-8" />
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold font-display text-text-light">Standalone Thumbnail</h3>
                            <p className="text-text-medium text-sm">Generate a high-quality thumbnail from a title or an idea, independent of the main story.</p>
                            <TextareaField
                                id="thumbnail-prompt"
                                label="Thumbnail Idea or Title"
                                value={thumbnailPrompt}
                                onChange={(e) => setThumbnailPrompt(e.target.value)}
                                rows={3}
                                placeholder="e.g., A small robot discovers a glowing flower in a dark forest"
                            />
                            <button
                                type="button"
                                onClick={onGenerateStandaloneThumbnail}
                                disabled={isStandaloneThumbnailLoading || !thumbnailPrompt.trim()}
                                className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-input shadow-soft-outset hover:text-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                {isStandaloneThumbnailLoading ? (
                                    <><LoadingSpinnerIcon /> Generating Thumbnail...</>
                                ) : (
                                    <><PhotoIcon className="w-4 h-4" /> Generate High-Quality Thumbnail</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="pt-4 flex-shrink-0">
                <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className="w-full flex justify-center items-center py-4 px-4 border-transparent rounded-2xl shadow-lg text-lg font-bold text-dark-bg bg-accent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:bg-accent/40 disabled:cursor-not-allowed transition-all duration-300 shadow-accent/40 hover:shadow-accent/60 hover:scale-105 transform active:scale-100"
                >
                    {isLoading ? (
                    <>
                        <LoadingSpinnerIcon />
                        Generating...
                    </>
                    ) : (
                    submitButtonText
                    )}
                </button>
            </div>
        </div>
    </form>
  );
};
