import React, { useState, useCallback } from 'react';
// FIX: Import CharacterProfile type.
import type { GeneratedResult, CharacterProfile } from './types';
import { CharacterInputForm } from './components/CharacterInputForm';
import { PromptDisplay } from './components/PromptDisplay';
import { generateStoryAndPrompts, generateVoiceoverScript, generateAudioFromScript, enhanceVoiceoverScript, generateThumbnailPrompt, generateThumbnailImage } from './services/geminiService';

const App: React.FC = () => {
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>([{
    name: '',
    appearance: '',
  }]);
  const [storyScene, setStoryScene] = useState<string>('');
  const [storyTitle, setStoryTitle] = useState<string>('');
  const [storyMode, setStoryMode] = useState<'detail' | 'fromTitle'>('detail');
  const [storyLength, setStoryLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
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
  const [isThumbnailImageLoading, setIsThumbnailImageLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedResult(null);
    setEditableVoiceoverScript('');

    if (storyMode === 'detail') {
        if (!characterProfiles.some(c => c.appearance.trim()) || !storyScene.trim()) {
            setError('For "Detailed Scene" mode, please provide appearance details for at least one character and a story scene.');
            setIsLoading(false);
            return;
        }
    } else if (storyMode === 'fromTitle') {
        if (!storyTitle.trim()) {
            setError('For "From Title" mode, please provide a story title.');
            setIsLoading(false);
            return;
        }
    }

    try {
      const numPrompts = Math.ceil((videoLengthMinutes * 60) / 8);
      const sceneOrTitle = storyMode === 'detail' ? storyScene : storyTitle;
      const result = await generateStoryAndPrompts({
        characters: storyMode === 'detail' ? characterProfiles.filter(c => c.appearance.trim()) : [],
        numPrompts,
        mode: storyMode,
        sceneOrTitle,
        videoStyle,
        storyLength,
      });
      setGeneratedResult(result);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An error occurred while generating the content. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [characterProfiles, storyScene, storyTitle, storyMode, videoLengthMinutes, videoStyle, storyLength]);

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
        const errorMessage = e instanceof Error ? e.message : 'An error occurred while generating the voiceover. Please try again.';
        setError(errorMessage);
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
        const errorMessage = e instanceof Error ? e.message : 'An error occurred while enhancing the voiceover script. Please try again.';
        setError(errorMessage);
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
              return { ...prev, voiceover: editableVoiceoverScript, voiceoverAudio: audioB64 };
          }
          // Otherwise, create a new minimal result object for the standalone audio
          return {
              characterSheet: '',
              prompts: [],
              voiceover: editableVoiceoverScript,
              voiceoverAudio: audioB64,
          };
      });
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An error occurred while generating the audio. Please try again.';
      setError(errorMessage);
    } finally {
      setIsAudioLoading(false);
    }
  }, [editableVoiceoverScript, selectedVoice]);

  const handleGenerateThumbnail = useCallback(async () => {
    if (!generatedResult?.characterSheet) return;
  
    setIsThumbnailLoading(true);
    setError(null);
    try {
      const thumbnailPrompt = await generateThumbnailPrompt(
        generatedResult.characterSheet, 
        generatedResult.storyScript,
        videoStyle,
        storyTitle
      );
      setGeneratedResult(prev => prev ? { ...prev, thumbnailPrompt } : null);
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Please try again.';
        setError(`An error occurred while generating the thumbnail prompt. ${errorMessage}`);
    } finally {
      setIsThumbnailLoading(false);
    }
  }, [generatedResult, videoStyle, storyTitle]);

  const handleGenerateThumbnailImage = useCallback(async () => {
    if (!generatedResult?.characterSheet) return;
  
    setIsThumbnailImageLoading(true);
    setError(null);
    try {
      const thumbnailImage = await generateThumbnailImage(
        generatedResult.characterSheet, 
        generatedResult.storyScript,
        videoStyle,
        storyTitle
      );
      setGeneratedResult(prev => prev ? { ...prev, thumbnailImage } : null);
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Please try again.';
        setError(`An error occurred while generating the thumbnail image. ${errorMessage}`);
    } finally {
      setIsThumbnailImageLoading(false);
    }
  }, [generatedResult, videoStyle, storyTitle]);

  return (
    <div className="min-h-screen bg-dark-bg text-text-light flex flex-col">
      <header className="py-6 px-6 md:px-8">
        <h1 className="text-3xl md:text-4xl font-bold font-display text-text-light">
          Pikaza
        </h1>
        <p className="text-text-medium mt-1">AI Consistent Character Tool</p>
      </header>

      <main className="flex-grow max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start w-full">
        <CharacterInputForm
          characterProfiles={characterProfiles}
          setCharacterProfiles={setCharacterProfiles}
          storyScene={storyScene}
          setStoryScene={setStoryScene}
          storyTitle={storyTitle}
          setStoryTitle={setStoryTitle}
          storyMode={storyMode}
          setStoryMode={setStoryMode}
          storyLength={storyLength}
          setStoryLength={setStoryLength}
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
          isThumbnailImageLoading={isThumbnailImageLoading}
          onGenerateThumbnailImage={handleGenerateThumbnailImage}
        />
      </main>
    </div>
  );
};

export default App;