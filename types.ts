export interface CharacterProfile {
  name: string;
  appearance: string;
}

export interface ScenePrompt {
  scene_number: number;
  start_time_seconds: number;
  end_time_seconds: number;
  prompt: string;
}

export interface GeneratedCharacter {
    name: string;
    description: string;
}

export interface GeneratedResult {
  characterSheet: string;
  storyScript?: string;
  storyScriptRomanUrdu?: string;
  prompts?: ScenePrompt[];
  characters?: GeneratedCharacter[];
  voiceover?: string;
  voiceoverAudio?: string;
  thumbnail3d?: string; // base64 string
  thumbnailRealistic?: string; // base64 string
  titles?: string[];
  standaloneThumbnail?: string; // base64 string
  thumbnail3dPrompt?: string;
  thumbnailRealisticPrompt?: string;
  standaloneThumbnailPrompt?: string;
}
