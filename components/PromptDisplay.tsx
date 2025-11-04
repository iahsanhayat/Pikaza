import React, { useState, useEffect } from 'react';
import { CopyIcon, CheckIcon, SparklesIcon, DownloadIcon } from './icons';
import type { GeneratedResult, GeneratedCharacter } from '../types';

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

const CharacterPrompt: React.FC<{ character: GeneratedCharacter }> = ({ character }) => {
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (isCopied) {
            const timer = setTimeout(() => setIsCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isCopied]);

    const handleCopy = () => {
        navigator.clipboard.writeText(character.description);
        setIsCopied(true);
    };

    return (
        <div className="p-4 bg-dark-input rounded-xl shadow-soft-inset relative group">
            <p className="text-sm text-accent font-semibold">{character.name}</p>
            <p className="text-text-light mt-2 text-sm leading-relaxed">{character.description}</p>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition opacity-0 group-hover:opacity-100"
                aria-label="Copy character prompt"
                title="Copy prompt"
            >
                {isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
            </button>
        </div>
    );
};

const RomanUrduStoryDisplay: React.FC<{ result: GeneratedResult }> = ({ result }) => {
    const [isCopied, setIsCopied] = useState(false);
    
    const textToCopy = result.storyScriptRomanUrdu || '';

    const handleCopy = () => {
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
            setIsCopied(true);
        }
    };

    useEffect(() => {
        if (isCopied) {
            const timer = setTimeout(() => setIsCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isCopied]);

    return (
        <div>
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-display font-bold text-text-light">Roman Urdu Story</h2>
                <button
                    onClick={handleCopy}
                    className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
                    title="Copy Roman Urdu Story"
                >
                    {isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                </button>
            </div>
            <div className="p-6 bg-dark-input rounded-2xl shadow-soft-inset mt-4 space-y-4">
                <p className="text-text-light/90 leading-relaxed">{result.storyScriptRomanUrdu}</p>
            </div>
        </div>
    )
}

const TitleSuggestionItem: React.FC<{ title: string }> = ({ title }) => {
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (isCopied) {
            const timer = setTimeout(() => setIsCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isCopied]);

    const handleCopy = () => {
        navigator.clipboard.writeText(title);
        setIsCopied(true);
    };

    return (
        <div className="p-3 bg-dark-bg rounded-xl shadow-soft-inset flex items-center justify-between group">
            <p className="text-sm text-text-light">{title}</p>
            <button
                onClick={handleCopy}
                className="p-2 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition opacity-0 group-hover:opacity-100"
                aria-label="Copy title"
                title="Copy title"
            >
                {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
            </button>
        </div>
    );
};


export const PromptDisplay: React.FC<PromptDisplayProps> = ({ result, isLoading, error, isThumbnailLoading, onGenerateThumbnail }) => {
  const [isCharacterSheetCopied, setIsCharacterSheetCopied] = useState(false);
  const [isStoryScriptCopied, setIsStoryScriptCopied] = useState(false);
  const [isPromptsCopied, setIsPromptsCopied] = useState(false);
  
  const LoadingSpinnerIcon: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  useEffect(() => {
    if (isCharacterSheetCopied) {
      const timer = setTimeout(() => setIsCharacterSheetCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCharacterSheetCopied]);

  useEffect(() => {
    if (isStoryScriptCopied) {
      const timer = setTimeout(() => setIsStoryScriptCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isStoryScriptCopied]);
  
  useEffect(() => {
    if (isPromptsCopied) {
      const timer = setTimeout(() => setIsPromptsCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isPromptsCopied]);

  const handleCopy = (text: string | undefined, setCopied: (isCopied: boolean) => void) => {
    if (text) {
        navigator.clipboard.writeText(text);
        setCopied(true);
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
      const promptsText = result.prompts
        .map((p) => `${p.scene_number}. ${p.prompt}`)
        .join('\n');
      const blob = new Blob([promptsText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'prompts.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadThumbnail = (base64Image: string | undefined, filename: string) => {
    if (base64Image) {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64Image}`;
        link.download = filename;
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
                        <div className="flex items-center gap-2">
                           <button
                                onClick={() => handleCopy(result.characterSheet, setIsCharacterSheetCopied)}
                                className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
                                title="Copy character sheet"
                            >
                                {isCharacterSheetCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={handleDownloadCharacterSheet}
                                className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
                                aria-label="Download character sheet"
                                title="Download Character Sheet (.md)"
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="p-6 bg-dark-input rounded-2xl shadow-soft-inset mt-4">
                        {renderMarkdown(result.characterSheet)}
                    </div>
                </div>
            )}

            {result.storyScript && (
                <div>
                     <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-display font-bold text-text-light">Story Script (English)</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleCopy(result.storyScript, setIsStoryScriptCopied)}
                                className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
                                title="Copy story script"
                            >
                                {isStoryScriptCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={handleDownloadStoryScript}
                                className="p-3 rounded-full bg-dark-card shadow-soft-outset text-text-medium hover:text-accent transition"
                                aria-label="Download story script"
                                title="Download Story Script (.txt)"
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                         </div>
                    </div>
                    <div className="p-6 bg-dark-input rounded-2xl shadow-soft-inset mt-4">
                        {renderMarkdown(result.storyScript)}
                    </div>
                </div>
            )}

            {result.storyScriptRomanUrdu && <RomanUrduStoryDisplay result={result} />}

            {result.characters && result.characters.length > 0 && (
                <div>
                    <h2 className="text-2xl font-display font-bold text-text-light">Generated Character Prompts</h2>
                    <div className="space-y-4 mt-4">
                        {result.characters.map((char, index) => (
                            <CharacterPrompt key={index} character={char} />
                        ))}
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
                            title="Download Prompts (.txt)"
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
            
            {(result.characterSheet || result.storyScript || result.thumbnail3d || result.standaloneThumbnail) && (
                 <div>
                    <h2 className="text-2xl font-display font-bold text-text-light">Thumbnails & Titles</h2>
                    <div className="p-6 bg-dark-input rounded-2xl shadow-soft-inset mt-4">
                        <div className="space-y-6">
                            {isThumbnailLoading ? (
                                <div className="flex items-center justify-center text-text-medium py-8">
                                    <LoadingSpinnerIcon />
                                    <span className="ml-2">Generating thumbnails & titles...</span>
                                </div>
                            ) : (
                                <>
                                    {(result.thumbnail3d || result.thumbnailRealistic) && (
                                        <div>
                                            <h3 className="text-lg font-display font-bold text-accent mb-2">Generated Thumbnails</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {result.thumbnail3d && (
                                                    <div className="space-y-2">
                                                        <img src={`data:image/jpeg;base64,${result.thumbnail3d}`} alt="3D Pixar Style Thumbnail" className="rounded-lg w-full shadow-lg" />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadThumbnail(result.thumbnail3d, 'thumbnail_3d.jpeg')}
                                                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold text-text-light bg-dark-bg shadow-soft-outset hover:text-accent transition"
                                                        >
                                                            <DownloadIcon className="w-4 h-4" /> 3D Pixar Style
                                                        </button>
                                                    </div>
                                                )}
                                                {result.thumbnailRealistic && (
                                                    <div className="space-y-2">
                                                        <img src={`data:image/jpeg;base64,${result.thumbnailRealistic}`} alt="Realistic Photo Style Thumbnail" className="rounded-lg w-full shadow-lg" />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadThumbnail(result.thumbnailRealistic, 'thumbnail_realistic.jpeg')}
                                                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold text-text-light bg-dark-bg shadow-soft-outset hover:text-accent transition"
                                                        >
                                                            <DownloadIcon className="w-4 h-4" /> Realistic Photo Style
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {result.titles && (
                                        <div>
                                            <h3 className="text-lg font-display font-bold text-accent mb-2">Title Suggestions</h3>
                                            <div className="space-y-2">
                                                {result.titles.map((title, index) => (
                                                    <TitleSuggestionItem key={index} title={title} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {result.standaloneThumbnail && (
                                <div>
                                    <h3 className="text-lg font-display font-bold text-accent mb-2">Standalone Thumbnail</h3>
                                    <div className="space-y-2">
                                        <img src={`data:image/jpeg;base64,${result.standaloneThumbnail}`} alt="Standalone Thumbnail" className="rounded-lg w-full shadow-lg" />
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadThumbnail(result.standaloneThumbnail, 'standalone_thumbnail.jpeg')}
                                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold text-text-light bg-dark-bg shadow-soft-outset hover:text-accent transition"
                                        >
                                            <DownloadIcon className="w-4 h-4" /> Download Thumbnail
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!(result.thumbnail3d || result.thumbnailRealistic || result.titles) && !isThumbnailLoading && result.characterSheet && (
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4">
                                    <button
                                        type="button"
                                        onClick={onGenerateThumbnail}
                                        disabled={isThumbnailLoading}
                                        className="flex w-full items-center justify-center mx-auto gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-text-light bg-dark-bg shadow-soft-outset hover:text-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        <SparklesIcon className="w-5 h-5" /> Generate Thumbnails & Titles
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
    }
    return <InitialState />;
  };

  return (
    <div className="bg-dark-card rounded-3xl p-8 shadow-soft-outset min-h-[500px] lg:min-h-0 lg:h-full flex flex-col relative transition-shadow duration-300 hover:shadow-accent-glow">
        <div className="flex-grow overflow-y-auto pr-4 -mr-4">
            {renderContent()}
        </div>
    </div>
  );
};