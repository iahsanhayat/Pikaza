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
  prompts?: ScenePrompt[];
  characters?: GeneratedCharacter[];
  voiceover?: string;
  voiceoverAudio?: string;
  thumbnailPrompt?: string;
  thumbnailImage?: string;
}
