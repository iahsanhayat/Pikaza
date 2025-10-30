import React, { useState, useRef, useEffect } from 'react';
import type { CharacterProfile, GeneratedResult } from '../types';
import { LoadingSpinnerIcon, MicIcon, PlayIcon, PauseIcon, DownloadIcon, SparklesIcon, TrashIcon } from './icons';
import { generateAudioFromScript } from '../services/geminiService';

interface CharacterInputFormProps {
  characterProfiles: CharacterProfile[];
  setCharacterProfiles: React.Dispatch<React.SetStateAction<CharacterProfile[]>>;
  storyScene: string;
  setStoryScene: React.Dispatch<React.SetStateAction<string>>;
  storyTitle: string;
  setStoryTitle: React.Dispatch<React.SetStateAction<string>>;
  storyMode: 'detail' | 'quick';
  setStoryMode: React.Dispatch<React.SetStateAction<'detail' | 'quick'>>;
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
  editableVoiceoverScript: string;
  setEditableVoiceoverScript: React.Dispatch<React.SetStateAction<string>>;
}

const InputField: React.FC<{
  id: string;
  name?: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ id, name, label, value, placeholder, onChange }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-text-medium mb-2">
      {label}
    </label>
    <input
      type="text"
      id={id}
      name={name || id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent-pink/50 border-transparent transition-all duration-300"
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
      {label} {required && <span className="text-accent-pink">*</span>}
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
      className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent-pink/50 border-transparent transition-all duration-300 disabled:opacity-50"
    />
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex-1 py-2 px-4 text-sm font-semibold rounded-full transition-all duration-300 focus:outline-none ${
            active 
            ? 'bg-accent-pink text-white shadow-md shadow-accent-pink/30' 
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
  editableVoiceoverScript,
  setEditableVoiceoverScript,
}) => {
  const [activeStep, setActiveStep] = useState(1);
  const [characterMode, setCharacterMode] = useState<'single' | 'multi'>('single');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [sampleLoadingVoice, setSampleLoadingVoice] = useState<string | null>(null);
  const VOICEOVER_CHAR_LIMIT = 5000;

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioState, setAudioState] = useState<'paused' | 'playing' | 'stopped'>('stopped');
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const pauseTimeRef = useRef(0);
  const startTimeRef = useRef(0);


  const handleProfileChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCharacterProfiles(prev => {
        const newProfiles = [...prev];
        newProfiles[index] = { ...newProfiles[index], [name]: value };
        return newProfiles;
    });
  };

  const addCharacter = () => {
    setCharacterProfiles(prev => [...prev, { name: '', appearance: '' }]);
  };

  const removeCharacter = (index: number) => {
    setCharacterProfiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSceneChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStoryScene(e.target.value);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStoryTitle(e.target.value);
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
    // When a new audio is generated, reset the player state completely.
    if (audioSourceNodeRef.current) {
      audioSourceNodeRef.current.onended = null;
      try { audioSourceNodeRef.current.stop(); } catch (e) { /* ignore */ }
    }
    setAudioState('stopped');
    audioBufferRef.current = null;
    audioSourceNodeRef.current = null;
    pauseTimeRef.current = 0;
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
  
    // Decode audio if not already buffered
    if (!audioBufferRef.current) {
      try {
        audioBufferRef.current = await decodeAudioData(decode(result.voiceoverAudio), audioContext, 24000, 1);
      } catch (e) {
        console.error("Failed to decode audio:", e);
        return;
      }
    }
  
    // Create new source
    const source = audioContext.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.playbackRate.value = playbackRate;
    source.connect(audioContext.destination);
  
    // Event listener for when audio naturally finishes
    source.onended = () => {
      // Only reset state if this source is the current one (prevents race conditions)
      if (audioSourceNodeRef.current === source) {
        setAudioState('stopped');
        pauseTimeRef.current = 0;
        audioSourceNodeRef.current = null;
      }
    };
  
    // Start playing from the correct offset
    const offset = pauseTimeRef.current % audioBufferRef.current.duration;
    source.start(0, offset);
  
    audioSourceNodeRef.current = source;
    startTimeRef.current = audioContext.currentTime - offset;
    setAudioState('playing');
  };
  
  const pauseAudio = () => {
    if (!audioSourceNodeRef.current || !audioContextRef.current) return;
  
    // Calculate how far into the audio we paused
    const elapsedTime = audioContextRef.current.currentTime - startTimeRef.current;
    pauseTimeRef.current = elapsedTime;
  
    // Stop the playback
    audioSourceNodeRef.current.onended = null; // Avoid triggering the 'ended' logic
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

  const isSubmitDisabled = isLoading || !characterProfiles.some(c => c.appearance.trim()) || (storyMode === 'detail' ? !storyScene : !storyTitle);

  const navItems = [
    { step: 1, title: 'Define Your Character(s)' },
    { step: 2, title: 'Define Video Style' },
    { step: 3, title: 'Configure Video Output' },
    { step: 4, title: 'Create Your Story' },
    { step: 5, title: 'Generate Voiceover' },
  ];

  const NavItem: React.FC<{ step: number; title: string; disabled?: boolean }> = ({ step, title, disabled = false }) => (
      <button
        type="button"
        onClick={() => setActiveStep(step)}
        disabled={disabled}
        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
          activeStep === step
            ? 'bg-accent-pink/20 text-accent-pink'
            : 'text-text-medium hover:bg-white/5 hover:text-text-light'
        } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
      >
        <span className={`font-bold mr-2 ${activeStep === step ? 'text-accent-pink' : 'text-text-medium'}`}>{step}.</span> {title}
      </button>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-dark-card rounded-3xl p-4 shadow-soft-outset flex h-full">
        <nav className="w-1/3 border-r border-white/10 pr-4 flex flex-col space-y-2">
            {navItems.map(item => <NavItem key={item.step} {...item} />)}
        </nav>
        
        <div className="w-2/3 pl-4 flex flex-col">
            <div className="flex-grow space-y-8 overflow-y-auto p-4 -m-4">
                {activeStep === 1 && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display text-text-light">1. Define Your Character(s)</h2>
                        <div className="flex bg-dark-input p-1 rounded-full space-x-1 shadow-soft-inset">
                            <TabButton active={characterMode === 'single'} onClick={() => { setCharacterMode('single'); setCharacterProfiles(prev => [prev[0] || {name: '', appearance: ''}]) }}>Single Character</TabButton>
                            <TabButton active={characterMode === 'multi'} onClick={() => setCharacterMode('multi')}>Multi-Character</TabButton>
                        </div>
                        {characterMode === 'single' ? (
                            <div className="space-y-4">
                                <InputField id="name" label="Character Name" value={characterProfiles[0]?.name || ''} placeholder="e.g., Kaelen, The Shadow Weaver" onChange={(e) => handleProfileChange(0, e)} />
                                <TextareaField id="appearance" label="Appearance Details" value={characterProfiles[0]?.appearance || ''} placeholder="Crucial for consistency! e.g., silver hair in a messy bun, one green eye one blue, scar over left eyebrow, wears a dark leather jacket..." onChange={(e) => handleProfileChange(0, e)} rows={5} required />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {characterProfiles.map((profile, index) => (
                                    <div key={index} className="bg-dark-input rounded-2xl p-4 shadow-soft-inset relative">
                                        <h3 className="text-lg font-semibold text-text-light mb-3">Character {index + 1}</h3>
                                        <div className="space-y-4">
                                             <InputField id={`name-${index}`} name="name" label="Character Name" value={profile.name} placeholder={`e.g., Character ${index + 1}`} onChange={(e) => handleProfileChange(index, e)} />
                                            <TextareaField id={`appearance-${index}`} name="appearance" label="Appearance Details" value={profile.appearance} placeholder="e.g., Fiery red hair, emerald green eyes..." onChange={(e) => handleProfileChange(index, e)} rows={4} required />
                                        </div>
                                        {characterProfiles.length > 1 && (
                                            <button type="button" onClick={() => removeCharacter(index)} className="absolute top-3 right-3 p-2 text-text-medium hover:text-accent-pink rounded-full transition">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={addCharacter} className="w-full py-2 px-4 border-2 border-dashed border-white/20 rounded-xl text-text-medium hover:border-accent-pink hover:text-accent-pink transition-all duration-300">
                                    + Add Another Character
                                </button>
                            </div>
                        )}
                    </div>
                )}
                 {activeStep === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display text-text-light">2. Define Video Style</h2>
                        <div>
                            <label htmlFor="videoStyleSelect" className="block text-sm font-medium text-text-medium mb-2">Video Style</label>
                            <select id="videoStyleSelect" value={selectValue} onChange={handleStyleSelectChange} className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent-pink/50 border-transparent transition-all duration-300 appearance-none">
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
                            <label htmlFor="videoLength" className="block text-sm font-medium text-text-medium mb-2">Video Length (minutes)</label>
                            <input type="number" id="videoLength" name="videoLength" value={videoLengthMinutes} onChange={(e) => setVideoLengthMinutes(Math.max(1, parseInt(e.target.value, 10)) || 1)} min="1" className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent-pink/50 border-transparent transition-all duration-300" />
                            <p className="text-xs text-text-medium mt-2">Each prompt generates ~8 seconds of video. Total prompts: {Math.ceil((videoLengthMinutes * 60) / 8)}</p>
                        </div>
                    </div>
                )}
                 {activeStep === 4 && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display text-text-light">4. Create Your Story</h2>
                        <div className="flex bg-dark-input p-1 rounded-full space-x-1 shadow-soft-inset">
                            <TabButton active={storyMode === 'detail'} onClick={() => setStoryMode('detail')}>Detailed Scene</TabButton>
                            <TabButton active={storyMode === 'quick'} onClick={() => setStoryMode('quick')}>Quick Story</TabButton>
                        </div>
                        {storyMode === 'detail' ? (
                            <TextareaField id="storyScene" label="Story Scene / Plot Point" value={storyScene} placeholder="Describe the action. e.g., 'Kaelen stands on a rain-slicked rooftop at midnight, overlooking a neon-lit futuristic city, preparing to leap.'" onChange={handleSceneChange} rows={5} required />
                        ) : (
                            <TextareaField id="storyTitle" label="Story Title or Description" value={storyTitle} placeholder="Provide a title or a short idea. e.g., 'The Last Dragon Rider's Gambit' or 'A detective discovers a magical secret in 1940s New York.'" onChange={handleTitleChange} rows={5} required />
                        )}
                    </div>
                )}
                {activeStep === 5 && (
                     <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display text-text-light">5. Generate Voiceover</h2>
                        <>
                            <div>
                                <p className="text-text-medium mb-4">You can generate a script from your story, or paste your own below.</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={onGenerateVoiceover}
                                        disabled={isVoiceoverLoading || !result?.storyScript}
                                        className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-input shadow-soft-outset hover:text-accent-pink focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        title={!result?.storyScript ? "Generate a 'Quick Story' first to enable this feature" : "Convert story to voiceover script"}
                                    >
                                        {isVoiceoverLoading ? (
                                            <><LoadingSpinnerIcon /> Converting...</>
                                        ) : (
                                            <><MicIcon className="w-4 h-4" /> Convert to Voiceover Script</>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onEnhanceScript}
                                        disabled={isEnhancingScript || !editableVoiceoverScript.trim()}
                                        className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-input shadow-soft-outset hover:text-accent-pink focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        title="Automatically add pauses and expressions to the script"
                                    >
                                        {isEnhancingScript ? (
                                            <><LoadingSpinnerIcon /> Enhancing...</>
                                        ) : (
                                            <><SparklesIcon className="w-4 h-4" /> Auto Enhance Script</>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <TextareaField
                                    id="voiceoverScript"
                                    label="Voiceover Script"
                                    value={editableVoiceoverScript}
                                    onChange={(e) => setEditableVoiceoverScript(e.target.value)}
                                    rows={6}
                                    placeholder="Paste your script here, or click 'Convert' above to generate one."
                                />
                                <p className={`text-xs text-right mt-1 px-2 ${editableVoiceoverScript.length > VOICEOVER_CHAR_LIMIT ? 'text-accent-pink' : 'text-text-medium'}`}>
                                    {editableVoiceoverScript.length} / {VOICEOVER_CHAR_LIMIT} characters
                                </p>
                            </div>
                            <div>
                                <label htmlFor="voiceSelect" className="block text-sm font-medium text-text-medium mb-2">Character Voice</label>
                                <div className="flex items-center gap-2">
                                    <select id="voiceSelect" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-dark-input rounded-xl shadow-soft-inset py-3 px-4 text-text-light focus:outline-none focus:ring-2 focus:ring-accent-pink/50 border-transparent transition-all duration-300 appearance-none">
                                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handlePlaySampleVoice}
                                        disabled={!!sampleLoadingVoice}
                                        className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent-pink transition disabled:opacity-50"
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
                                    className="w-full h-2 bg-dark-input rounded-lg appearance-none cursor-pointer accent-accent-pink"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                    <button
                                    type="button"
                                    onClick={onGenerateAudio}
                                    disabled={isAudioLoading || !editableVoiceoverScript.trim() || editableVoiceoverScript.length > VOICEOVER_CHAR_LIMIT}
                                    className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-input shadow-soft-outset hover:text-accent-pink focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {isAudioLoading ? (
                                        <><LoadingSpinnerIcon /> Generating Audio...</>
                                    ) : (
                                        <><MicIcon className="w-4 h-4" /> Generate Audio</>
                                    )}
                                </button>
                                {result?.voiceoverAudio && (
                                    <>
                                        <button type="button" onClick={handlePlayPause} className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-accent-pink border-2 border-accent-pink/50 hover:bg-accent-pink/10 focus:outline-none transition w-40">
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
                                            className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent-pink transition"
                                            title="Download Voiceover (.wav)"
                                        >
                                            <DownloadIcon className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    </div>
                )}
            </div>
            {activeStep !== 5 && (
                <div className="pt-4 flex-shrink-0">
                    <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="w-full flex justify-center items-center py-4 px-4 border-transparent rounded-2xl shadow-lg text-lg font-bold text-white bg-accent-pink hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-pink disabled:bg-accent-pink/40 disabled:cursor-not-allowed transition-all duration-300 shadow-accent-pink/40 hover:shadow-accent-pink/60 hover:scale-105 transform active:scale-100"
                    >
                        {isLoading ? (
                        <>
                            <LoadingSpinnerIcon />
                            Generating...
                        </>
                        ) : (
                        'Generate Story & Prompts'
                        )}
                    </button>
                </div>
            )}
        </div>
    </form>
  );
};