import React, { useState, useEffect } from 'react';
import { CopyIcon, CheckIcon, SparklesIcon, DownloadIcon, PhotoIcon, LoadingSpinnerIcon } from './icons';
import type { GeneratedResult } from '../types';

interface PromptDisplayProps {
  result: GeneratedResult | null;
  isLoading: boolean;
  error: string | null;
  isThumbnailLoading: boolean;
  onGenerateThumbnail: () => void;
  isThumbnailImageLoading: boolean;
  onGenerateThumbnailImage: () => void;
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
        <SparklesIcon className="w-16 h-16 mb-4 text-accent" />
        <h3 className="text-xl font-bold font-display text-text-light">Your AI Storyboard Awaits</h3>
        <p className="mt-2 max-w-sm">Fill in the details, then click "Generate Story & Prompts" to see the magic happen here.</p>
    </div>
);

const renderMarkdown = (markdown: string) => {
    const html = markdown
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent font-semibold">$1</strong>') // Bold
        .replace(/### (.*?)\n/g, '<h3 class="text-xl font-display font-bold mt-4 mb-2 text-text-light">$1</h3>') // h3
        .replace(/## (.*?)\n/g, '<h2 class="text-2xl font-display font-bold mt-8 mb-4 border-b border-white/10 pb-2 text-text-light">$1</h2>') // h2
        .replace(/\n/g, '<br />');
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export const PromptDisplay: React.FC<PromptDisplayProps> = ({ result, isLoading, error, isThumbnailLoading, onGenerateThumbnail, isThumbnailImageLoading, onGenerateThumbnailImage }) => {
  const [isThumbnailPromptCopied, setIsThumbnailPromptCopied] = useState(false);
  const [isPromptsCopied, setIsPromptsCopied] = useState(false);

  useEffect(() => {
    if (isThumbnailPromptCopied) {
      const timer = setTimeout(() => setIsThumbnailPromptCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isThumbnailPromptCopied]);
  
  useEffect(() => {
    if (isPromptsCopied) {
      const timer = setTimeout(() => setIsPromptsCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isPromptsCopied]);

  const handleCopyThumbnailPrompt = () => {
    if (result?.thumbnailPrompt) {
        navigator.clipboard.writeText(result.thumbnailPrompt);
        setIsThumbnailPromptCopied(true);
    }
  };
  
  const handleCopyAllPrompts = () => {
    if (result?.prompts) {
      const allPrompts = result.prompts.map(p => p.prompt).join('\n\n');
      navigator.clipboard.writeText(allPrompts);
      setIsPromptsCopied(true);
    }
  };

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
  
  const handleDownloadPrompts = () => {
    if (result?.prompts) {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.prompts, null, 2));
      const link = document.createElement('a');
      link.href = dataStr;
      link.download = "prompts.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadThumbnailImage = () => {
    if (result?.thumbnailImage) {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${result.thumbnailImage}`;
        link.download = 'thumbnail.jpeg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                            className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
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
                            className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
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

            {result.prompts && result.prompts.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-display font-bold text-text-light">Video Prompts ({result.prompts.length})</h2>
                    <div className="flex items-center gap-2">
                         <button
                            onClick={handleCopyAllPrompts}
                            className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
                            title="Copy all prompts"
                        >
                            {isPromptsCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={handleDownloadPrompts}
                            className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
                            title="Download Prompts (.json)"
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto p-1 -m-1 custom-scrollbar">
                    {result.prompts.map((p) => (
                        <div key={p.scene_number} className="p-4 bg-dark-input rounded-xl shadow-soft-inset">
                            <p className="text-sm text-accent font-semibold">Scene {p.scene_number} ({p.start_time_seconds}s - {p.end_time_seconds}s)</p>
                            <p className="text-text-light mt-2 text-sm leading-relaxed">{p.prompt}</p>
                        </div>
                    ))}
                </div>
              </div>
            )}
            
            {result.characterSheet && (
                 <div>
                    <h2 className="text-2xl font-display font-bold text-text-light">Thumbnail</h2>
                    <div className="p-6 bg-dark-input rounded-2xl shadow-soft-inset mt-4">
                       {isThumbnailImageLoading ? (
                            <div className="flex items-center justify-center text-text-medium py-8">
                                <LoadingSpinnerIcon />
                                <span className="ml-2">Generating 4K thumbnail image...</span>
                            </div>
                        ) : result.thumbnailImage ? (
                            <div className="space-y-4">
                                <img src={`data:image/jpeg;base64,${result.thumbnailImage}`} alt="Generated Thumbnail" className="rounded-lg w-full shadow-lg" />
                                <button
                                    type="button"
                                    onClick={handleDownloadThumbnailImage}
                                    className="flex items-center justify-center w-full gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-bg shadow-soft-outset hover:text-accent focus:outline-none transition"
                                >
                                    <DownloadIcon className="w-5 h-5" /> Download Image
                                </button>
                            </div>
                        ) : isThumbnailLoading ? (
                             <div className="flex items-center justify-center text-text-medium py-2">
                                <LoadingSpinnerIcon />
                                <span className="ml-2">Generating prompt...</span>
                            </div>
                        ) : result.thumbnailPrompt ? (
                            <div className="relative group">
                                <pre className="whitespace-pre-wrap bg-dark-bg p-4 rounded-lg text-sm font-mono text-text-light">
                                    {result.thumbnailPrompt}
                                </pre>
                                <button
                                    onClick={handleCopyThumbnailPrompt}
                                    className="absolute top-2 right-2 p-2 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition opacity-0 group-hover:opacity-100"
                                    aria-label="Copy thumbnail prompt"
                                    title="Copy prompt"
                                >
                                    {isThumbnailPromptCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4">
                                <button
                                    type="button"
                                    onClick={onGenerateThumbnail}
                                    disabled={isThumbnailLoading}
                                    className="flex w-full sm:w-auto items-center justify-center mx-auto gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-bg shadow-soft-outset hover:text-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    <SparklesIcon className="w-5 h-5" /> Generate Prompt
                                </button>
                                <button
                                    type="button"
                                    onClick={onGenerateThumbnailImage}
                                    disabled={isThumbnailImageLoading}
                                    className="flex w-full sm:w-auto items-center justify-center mx-auto gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-dark-bg bg-accent shadow-soft-outset hover:opacity-90 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    <PhotoIcon className="w-5 h-5" /> Generate 4K Image
                                </button>
                            </div>
                        )}
                    </div>
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
    </div>
  );
};