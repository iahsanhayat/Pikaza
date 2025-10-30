export interface CharacterProfile {
  name: string;
  appearance: string;
}

export interface GeneratedResult {
  characterSheet: string;
  storyScript?: string;
  prompts: string[];
  voiceover?: string;
  voiceoverAudio?: string;
  thumbnailPrompt?: string;
}