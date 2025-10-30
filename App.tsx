import React, { useState, useCallback, useEffect } from 'react';
import type { CharacterProfile, GeneratedResult } from './types';
import { CharacterInputForm } from './components/CharacterInputForm';
import { PromptDisplay } from './components/PromptDisplay';
import { LoginPage } from './components/LoginPage';
import { generateStoryAndPrompts, generateVoiceoverScript, generateAudioFromScript, enhanceVoiceoverScript, generateThumbnail } from './services/geminiService';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>([{
    name: '',
    appearance: '',
  }]);
  const [storyScene, setStoryScene] = useState<string>('');
  const [storyTitle, setStoryTitle] = useState<string>('');
  const [storyMode, setStoryMode] = useState<'detail' | 'quick'>('detail');
  const [videoLengthMinutes, setVideoLengthMinutes] = useState<number>(1);
  const [videoStyle, setVideoStyle] = useState<string>('3D Pixar style');
  const [selectedVoice, setSelectedVoice] = useState<string>('Zephyr');

  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [editableVoiceoverScript, setEditableVoiceoverScript] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVoiceoverLoading, setIsVoiceoverLoading] = useState<boolean>(false);
  const [isEnhancingScript, setIsEnhancingScript] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [isThumbnailLoading, setIsThumbnailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loggedInStatus = sessionStorage.getItem('isLoggedIn');
    if (loggedInStatus === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('isLoggedIn', 'true');
    setIsLoggedIn(true);
  };


  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedResult(null);
    setEditableVoiceoverScript('');

    const sceneOrTitle = storyMode === 'detail' ? storyScene : storyTitle;
    if (!characterProfiles.some(c => c.appearance.trim()) || !sceneOrTitle) {
      setError('Please provide appearance details for at least one character and a story scene/title.');
      setIsLoading(false);
      return;
    }

    try {
      const numPrompts = Math.ceil((videoLengthMinutes * 60) / 8);
      const result = await generateStoryAndPrompts({
        characters: characterProfiles.filter(c => c.appearance.trim()),
        numPrompts,
        mode: storyMode,
        sceneOrTitle,
        videoStyle,
      });
      setGeneratedResult(result);
    } catch (e) {
      console.error(e);
      setError('An error occurred while generating the content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [characterProfiles, storyScene, storyTitle, storyMode, videoLengthMinutes, videoStyle]);

  const handleGenerateVoiceover = useCallback(async () => {
    if (!generatedResult?.storyScript) return;

    setIsVoiceoverLoading(true);
    setError(null);
    try {
        const targetCharacterCount = videoLengthMinutes * 1000;
        const voiceover = await generateVoiceoverScript(generatedResult.storyScript, targetCharacterCount);
        setGeneratedResult(prev => prev ? { ...prev, voiceover, voiceoverAudio: undefined } : null); // Reset audio when script changes
        setEditableVoiceoverScript(voiceover);
    } catch (e) {
        console.error(e);
        setError('An error occurred while generating the voiceover. Please try again.');
    } finally {
        setIsVoiceoverLoading(false);
    }
  }, [generatedResult, videoLengthMinutes]);

  const handleEnhanceScript = useCallback(async () => {
    if (!editableVoiceoverScript.trim()) return;

    setIsEnhancingScript(true);
    setError(null);
    try {
        const enhancedScript = await enhanceVoiceoverScript(editableVoiceoverScript);
        setEditableVoiceoverScript(enhancedScript);
    } catch (e) {
        console.error(e);
        setError('An error occurred while enhancing the voiceover script. Please try again.');
    } finally {
        setIsEnhancingScript(false);
    }
  }, [editableVoiceoverScript]);
  
  const handleGenerateAudio = useCallback(async () => {
    if (!editableVoiceoverScript.trim()) return;
    
    setIsAudioLoading(true);
    setError(null);
    try {
      const audioB64 = await generateAudioFromScript(editableVoiceoverScript, selectedVoice);
      setGeneratedResult(prev => {
          // If a previous result exists, update it
          if (prev) {
              return { ...prev, voiceoverAudio: audioB64 };
          }
          // Otherwise, create a new minimal result object for the standalone audio
          return {
              characterSheet: '',
              prompts: [],
              voiceoverAudio: audioB64,
          };
      });
    } catch (e) {
      console.error(e);
      setError('An error occurred while generating the audio. Please try again.');
    } finally {
      setIsAudioLoading(false);
    }
  }, [editableVoiceoverScript, selectedVoice]);

  const handleGenerateThumbnail = useCallback(async () => {
    if (!generatedResult?.characterSheet) return;
  
    setIsThumbnailLoading(true);
    setError(null);
    try {
      const thumbnailB64 = await generateThumbnail(
        generatedResult.characterSheet, 
        generatedResult.storyScript,
        videoStyle
      );
      setGeneratedResult(prev => prev ? { ...prev, thumbnailImage: thumbnailB64 } : null);
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.includes('Requested entity was not found.')) {
        setError('Your API key was not found or is invalid. Please select a valid key and try again. (Error: Requested entity was not found.)');
      } else {
        const errorMessage = e instanceof Error ? e.message : 'Please try again.';
        setError(`An error occurred while generating the thumbnail. ${errorMessage}`);
      }
    } finally {
      setIsThumbnailLoading(false);
    }
  }, [generatedResult, videoStyle]);

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-dark-bg text-text-light flex flex-col">
      <header className="py-6 px-6 md:px-8">
        <h1 className="text-2xl md:text-3xl font-bold font-display text-text-light">
          Pikaza
        </h1>
        <p className="text-text-medium mt-1">AI Consistent Character Tool</p>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <CharacterInputForm
          characterProfiles={characterProfiles}
          setCharacterProfiles={setCharacterProfiles}
          storyScene={storyScene}
          setStoryScene={setStoryScene}
          storyTitle={storyTitle}
          setStoryTitle={setStoryTitle}
          storyMode={storyMode}
          setStoryMode={setStoryMode}
          videoLengthMinutes={videoLengthMinutes}
          setVideoLengthMinutes={setVideoLengthMinutes}
          videoStyle={videoStyle}
          setVideoStyle={setVideoStyle}
          onSubmit={handleGenerate}
          isLoading={isLoading}
          result={generatedResult}
          onGenerateVoiceover={handleGenerateVoiceover}
          isVoiceoverLoading={isVoiceoverLoading}
          onEnhanceScript={handleEnhanceScript}
          isEnhancingScript={isEnhancingScript}
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
          onGenerateAudio={handleGenerateAudio}
          isAudioLoading={isAudioLoading}
          editableVoiceoverScript={editableVoiceoverScript}
          setEditableVoiceoverScript={setEditableVoiceoverScript}
        />
        <PromptDisplay
          result={generatedResult}
          isLoading={isLoading}
          error={error}
          isThumbnailLoading={isThumbnailLoading}
          onGenerateThumbnail={handleGenerateThumbnail}
        />
      </main>
    </div>
  );
};

export default App;