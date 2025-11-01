export interface CharacterProfile {
  name: string;
  appearance: string;
}

export interface ScenePrompt {
  scene_number: number;
  prompt: string;
}

export interface GeneratedResult {
  characterSheet: string;
  storyScript?: string;
  prompts: ScenePrompt[];
  voiceover?: string;
  voiceoverAudio?: string;
  thumbnailPrompt?: string;
  thumbnailImage?: string;
}

export interface ExtractedCharacter {
  name: string;
  description: string;
}

export interface IntermediateResult {
  storyScript: string;
  characters: ExtractedCharacter[];
}