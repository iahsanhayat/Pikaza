import React, { useState, useEffect } from 'react';
import { CopyIcon, CheckIcon, SparklesIcon, DownloadIcon, PhotoIcon, LoadingSpinnerIcon } from './icons';
import type { GeneratedResult } from '../types';

// Augment the window object with the aistudio property
// FIX: Defined AIStudio interface to resolve TypeScript error about subsequent property declarations.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        aistudio?: AIStudio;
    }
}

interface PromptDisplayProps {
  result: GeneratedResult | null;
  isLoading: boolean;
  error: string | null;
  isThumbnailLoading: boolean;
  onGenerateThumbnail: () => void;
}

const LoadingSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-8">
        <div className="h-6 bg-dark-bg rounded-lg w-1/3"></div>
        <div className="space-y-3">
            <div className="h-4 bg-dark-input rounded w-full"></div>
            <div className="h-4 bg-dark-input rounded w-5/6"></div>
        </div>
        <div className="h-6 bg-dark-bg rounded-lg w-1/4 mt-6"></div>
        <div className="space-y-3">
            <div className="h-4 bg-dark-input rounded w-full"></div>
            <div className="h-4 bg-dark-input rounded w-4/6"></div>
            <div className="h-4 bg-dark-input rounded w-full"></div>
            <div className="h-4 bg-dark-input rounded w-5/6"></div>
        </div>
    </div>
);

const InitialState: React.FC = () => (
    <div className="text-center text-text-medium flex flex-col items-center justify-center h-full">
        <SparklesIcon className="w-16 h-16 mb-4 text-accent-pink" />
        <h3 className="text-xl font-bold font-display text-text-light">Your AI Storyboard Awaits</h3>
        <p className="mt-2 max-w-sm">Fill in the details, then click "Generate Story & Prompts" to see the magic happen here.</p>
    </div>
);

const renderMarkdown = (markdown: string) => {
    const html = markdown
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent-pink font-semibold">$1</strong>') // Bold
        .replace(/### (.*?)\n/g, '<h3 class="text-xl font-display font-bold mt-4 mb-2 text-text-light">$1</h3>') // h3
        .replace(/## (.*?)\n/g, '<h2 class="text-2xl font-display font-bold mt-8 mb-4 border-b border-white/10 pb-2 text-text-light">$1</h2>') // h2
        .replace(/\n/g, '<br />');
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export const PromptDisplay: React.FC<PromptDisplayProps> = ({ result, isLoading, error, isThumbnailLoading, onGenerateThumbnail }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const keySelected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(keySelected);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (error && error.includes('Requested entity was not found.')) {
      setHasApiKey(false);
    }
  }, [error]);

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const handleCopy = () => {
    if (result && result.prompts.length > 0) {
      const promptsText = result.prompts.join('\n');
      navigator.clipboard.writeText(promptsText);
      setIsCopied(true);
    }
  };

  const handleDownload = () => {
    if (result && result.prompts.length > 0) {
        const fileContent = result.prompts.map((p, i) => `${i + 1}. ${p}`).join('\r\n\r\n');
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'story_prompts.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  }

  const handleDownloadCharacterSheet = () => {
    if (result?.characterSheet) {
        const blob = new Blob([result.characterSheet], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'character_sheet.md';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  }

  const handleDownloadStoryScript = () => {
    if (result?.storyScript) {
        const blob = new Blob([result.storyScript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'story_script.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  }

  const handleDownloadThumbnail = () => {
    if (result?.thumbnailImage) {
        const link = document.createElement('a');
        link.href = result.thumbnailImage;
        const mimeTypeMatch = result.thumbnailImage.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
        const mimeType = mimeTypeMatch && mimeTypeMatch.length > 1 ? mimeTypeMatch[1] : 'image/jpeg';
        const extension = mimeType.split('/')[1] || 'jpeg';
        link.download = `thumbnail.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  }
  
  const handleGenerateThumbnailClick = async () => {
    let keyIsSelected = hasApiKey;
    if (!keyIsSelected) {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        // Assume success after dialog closes, as per guidelines to handle race conditions
        keyIsSelected = true;
        setHasApiKey(true);
      } else {
          // Fallback or error for environments where aistudio is not available
          console.error("API Key selection mechanism is not available.");
          return;
      }
    }
    
    // Proceed with generation only if a key is now considered selected
    if (keyIsSelected) {
      onGenerateThumbnail();
    }
  };


  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }
    if (error) {
      return <div className="text-red-400 bg-red-900/50 p-4 rounded-xl">{error}</div>;
    }
    if (result) {
      return (
        <div className="prose prose-invert prose-sm md:prose-base max-w-none text-text-medium space-y-6">
            {result.characterSheet && (
                <div>
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-display font-bold text-text-light">Character Sheet</h2>
                        <button
                            onClick={handleDownloadCharacterSheet}
                            className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent-pink transition"
                            aria-label="Download character sheet"
                            title="Download Character Sheet (.md)"
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 bg-dark-input rounded-2xl shadow-soft-inset mt-4">
                        {renderMarkdown(result.characterSheet)}
                    </div>
                </div>
            )}

            {result.storyScript && (
                <div>
                     <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-display font-bold text-text-light">Story Script</h2>
                         <button
                            onClick={handleDownloadStoryScript}
                            className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent-pink transition"
                            aria-label="Download story script"
                            title="Download Story Script (.txt)"
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 bg-dark-input rounded-2xl shadow-soft-inset mt-4">
                        {renderMarkdown(result.storyScript)}
                    </div>
                </div>
            )}
            
            {result.characterSheet && (
                 <div>
                    <h2 className="text-2xl font-display font-bold text-text-light">Video Thumbnail</h2>
                    <div className="p-6 bg-dark-input rounded-2xl shadow-soft-inset mt-4">
                        {isThumbnailLoading ? (
                            <div className="aspect-video bg-dark-bg rounded-lg flex items-center justify-center">
                                <LoadingSpinnerIcon />
                                <span className="ml-2">Generating your thumbnail...</span>
                            </div>
                        ) : result.thumbnailImage ? (
                            <div className="relative group">
                                <img src={result.thumbnailImage} alt="Generated Thumbnail" className="w-full h-auto rounded-lg" />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                    <button 
                                        onClick={handleDownloadThumbnail}
                                        className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold text-text-light bg-black/60 backdrop-blur-sm hover:bg-accent-pink transition-colors"
                                        aria-label="Download thumbnail"
                                    >
                                        <DownloadIcon className="w-5 h-5" /> Download
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-4">
                                {!hasApiKey && (
                                    <p className="text-text-medium mb-4 text-sm">
                                        To use your personal quota for thumbnail generation, please select your Gemini API key.
                                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-accent-pink underline ml-1">Learn about billing.</a>
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={handleGenerateThumbnailClick}
                                    disabled={isThumbnailLoading}
                                    className="flex items-center justify-center mx-auto gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-bg shadow-soft-outset hover:text-accent-pink focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    <PhotoIcon className="w-5 h-5" /> {hasApiKey ? 'Generate Thumbnail' : 'Select API Key & Generate'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {result.prompts.length > 0 && (
                <div>
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-display font-bold text-text-light">Image Prompts</h2>
                    </div>
                    <ol className="list-decimal pl-5 space-y-4 mt-4">
                        {result.prompts.map((p, i) => (
                            <li key={i} className="pl-2 leading-relaxed">{p}</li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
      );
    }
    return <InitialState />;
  };

  return (
    <div className="bg-dark-card rounded-3xl p-8 shadow-soft-outset min-h-[500px] lg:min-h-0 lg:h-full flex flex-col relative">
        <div className="flex-grow overflow-y-auto pr-4 -mr-4">
            {renderContent()}
        </div>
        {result && !isLoading && result.prompts.length > 0 && (
            <div className="absolute top-6 right-6 flex flex-col gap-4">
                <button
                    onClick={handleCopy}
                    className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent-pink transition"
                    aria-label="Copy prompts to clipboard"
                    title="Copy prompts"
                >
                    {isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                </button>
                <button
                    onClick={handleDownload}
                    className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent-pink transition"
                    aria-label="Download prompts as a .txt file"
                    title="Download prompts"
                >
                    <DownloadIcon className="w-5 h-5" />
                </button>
            </div>
        )}
    </div>
  );
};