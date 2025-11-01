import React, { useState, useCallback } from 'react';
import type { GeneratedResult, CharacterProfile, IntermediateResult } from './types';
import { CharacterInputForm } from './components/CharacterInputForm';
import { PromptDisplay } from './components/PromptDisplay';
import { generateStoryAndExtractCharacters, generateFinalAssets, generateVoiceoverScript, generateAudioFromScript, enhanceVoiceoverScript, generateThumbnailPrompt, generateThumbnailImage } from './services/geminiService';

type AppStage = 'input' | 'refinement' | 'finalizing';

const App: React.FC = () => {
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>([]);
  const [storyScene, setStoryScene] = useState<string>('');
  const [storyTitle, setStoryTitle] = useState<string>('');
  const [storyMode, setStoryMode] = useState<'detail' | 'quick'>('detail');
  const [numPrompts, setNumPrompts] = useState<number>(5);
  const [videoStyle, setVideoStyle] = useState<string>('3D Pixar style');
  const [selectedVoice, setSelectedVoice] = useState<string>('Fenrir');
  const [voiceoverLanguage, setVoiceoverLanguage] = useState<string>('English');

  const [appStage, setAppStage] = useState<AppStage>('input');
  const [intermediateResult, setIntermediateResult] = useState<IntermediateResult | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [editableVoiceoverScript, setEditableVoiceoverScript] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVoiceoverLoading, setIsVoiceoverLoading] = useState<boolean>(false);
  const [isEnhancingScript, setIsEnhancingScript] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [isThumbnailLoading, setIsThumbnailLoading] = useState<boolean>(false);
  const [isThumbnailImageLoading, setIsThumbnailImageLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateStory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedResult(null);
    setIntermediateResult(null);
    setEditableVoiceoverScript('');
    setCharacterProfiles([]);

    const sceneOrTitle = storyMode === 'detail' ? storyScene : storyTitle;
    if (!sceneOrTitle) {
      setError('Please provide a story scene or title to begin.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await generateStoryAndExtractCharacters({
        mode: storyMode,
        sceneOrTitle,
        numPrompts,
      });
      setIntermediateResult(result);
      setCharacterProfiles(result.characters.map(c => ({ name: c.name, appearance: '' })));
      setAppStage('refinement');
    } catch (e) {
      console.error(e);
      setError('An error occurred while generating the story. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [storyScene, storyTitle, storyMode, numPrompts]);

  const handleFinalize = useCallback(async () => {
    if (!intermediateResult) return;

    setIsLoading(true);
    setAppStage('finalizing');
    setError(null);

    // Combine AI description with user's custom appearance details
    const finalCharacterProfiles = intermediateResult.characters.map((char, index) => ({
        name: char.name,
        appearance: `${char.description} ${characterProfiles[index]?.appearance || ''}`.trim()
    }));

    try {
        const finalAssets = await generateFinalAssets({
            characters: finalCharacterProfiles,
            storyScript: intermediateResult.storyScript,
            numPrompts,
            videoStyle
        });

        setGeneratedResult({
            ...finalAssets,
            storyScript: intermediateResult.storyScript
        });
        // Reset for next run
        setAppStage('input');
        setIntermediateResult(null);
        setCharacterProfiles([]);

    } catch (e) {
        console.error(e);
        setError('An error occurred while generating the final prompts. Please try again.');
        setAppStage('refinement'); // Go back to refinement stage on error
    } finally {
        setIsLoading(false);
    }
  }, [intermediateResult, characterProfiles, numPrompts, videoStyle]);


  const handleGenerateVoiceover = useCallback(async () => {
    if (!generatedResult?.storyScript) return;

    setIsVoiceoverLoading(true);
    setError(null);
    try {
        const voiceover = await generateVoiceoverScript(generatedResult.storyScript, generatedResult.prompts.length, voiceoverLanguage);
        setGeneratedResult(prev => prev ? { ...prev, voiceover, voiceoverAudio: undefined } : null); // Reset audio when script changes
        setEditableVoiceoverScript(voiceover);
    } catch (e) {
        console.error(e);
        setError('An error occurred while generating the voiceover script. Please try again.');
    } finally {
        setIsVoiceoverLoading(false);
    }
  }, [generatedResult, voiceoverLanguage]);

  const handleEnhanceScript = useCallback(async () => {
    if (!editableVoiceoverScript.trim()) return;

    setIsEnhancingScript(true);
    setError(null);
    try {
        const enhancedScript = await enhanceVoiceoverScript(editableVoiceoverScript);
        setEditableVoiceoverScript(enhancedScript);
        if (generatedResult) {
          setGeneratedResult(prev => prev ? { ...prev, voiceover: enhancedScript } : null);
        }
    } catch (e) {
        console.error(e);
        setError('An error occurred while enhancing the voiceover script. Please try again.');
    } finally {
        setIsEnhancingScript(false);
    }
  }, [editableVoiceoverScript, generatedResult]);
  
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
              voiceover: editableVoiceoverScript,
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
      const thumbnailPrompt = await generateThumbnailPrompt(
        generatedResult.characterSheet, 
        generatedResult.storyScript,
        videoStyle
      );
      setGeneratedResult(prev => prev ? { ...prev, thumbnailPrompt } : null);
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Please try again.';
        setError(`An error occurred while generating the thumbnail prompt. ${errorMessage}`);
    } finally {
      setIsThumbnailLoading(false);
    }
  }, [generatedResult, videoStyle]);

  const handleGenerateThumbnailImage = useCallback(async () => {
    if (!generatedResult?.characterSheet) return;
  
    setIsThumbnailImageLoading(true);
    setError(null);
    try {
      const thumbnailImage = await generateThumbnailImage(
        generatedResult.characterSheet, 
        generatedResult.storyScript,
        videoStyle
      );
      setGeneratedResult(prev => prev ? { ...prev, thumbnailImage } : null);
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Please try again.';
        setError(`An error occurred while generating the thumbnail image. ${errorMessage}`);
    } finally {
      setIsThumbnailImageLoading(false);
    }
  }, [generatedResult, videoStyle]);

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
          appStage={appStage}
          characterProfiles={characterProfiles}
          setCharacterProfiles={setCharacterProfiles}
          storyScene={storyScene}
          setStoryScene={setStoryScene}
          storyTitle={storyTitle}
          setStoryTitle={setStoryTitle}
          storyMode={storyMode}
          setStoryMode={setStoryMode}
          numPrompts={numPrompts}
          setNumPrompts={setNumPrompts}
          videoStyle={videoStyle}
          setVideoStyle={setVideoStyle}
          onSubmit={appStage === 'input' ? handleGenerateStory : handleFinalize}
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
          intermediateResult={intermediateResult}
          voiceoverLanguage={voiceoverLanguage}
          setVoiceoverLanguage={setVoiceoverLanguage}
        />
        <PromptDisplay
          result={generatedResult}
          isLoading={appStage === 'finalizing'}
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