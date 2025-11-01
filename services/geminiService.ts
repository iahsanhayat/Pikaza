import { GoogleGenAI, Type, GenerateContentResponse, HarmCategory, HarmBlockThreshold, Modality } from "@google/genai";
import type { CharacterProfile, ScenePrompt } from '../types';

// This global instance is used for operations not requiring user-specific API keys.
const aiGlobal = new GoogleGenAI({ apiKey: process.env.API_KEY });

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

/**
 * Parses API errors to provide a cleaner, more user-friendly message.
 * @param error The error caught from the API call.
 * @param context A string describing the operation that failed (e.g., 'story generation').
 * @returns A formatted Error object.
 */
function handleApiError(error: unknown, context: string): Error {
    console.error(`Error in ${context}:`, error);
    if (error instanceof Error) {
        // The API error message might already be user-friendly.
        if (error.message.includes('API key not valid')) {
            return new Error('The provided API key is not valid. Please check your credentials.');
        }
        if (error.message.includes('Requested entity was not found.')) {
            return new Error('Requested entity was not found.');
        }
        return new Error(`Failed during ${context}: ${error.message}`);
    }
    return new Error(`An unknown error occurred during ${context}.`);
}

interface GenerateOptions {
  characters: CharacterProfile[];
  numPrompts: number;
  mode: 'detail' | 'quick';
  sceneOrTitle: string;
  videoStyle: string;
}

export async function generateStoryAndPrompts(
  options: GenerateOptions
): Promise<{ characterSheet: string; storyScript?: string; prompts: ScenePrompt[] }> {
  
  const { characters, numPrompts, mode, sceneOrTitle, videoStyle } = options;

  const schema = {
    type: Type.OBJECT,
    properties: {
      characterSheet: {
        type: Type.STRING,
        description: "A single Markdown document containing the detailed, reusable character sheets for all characters."
      },
      storyScript: {
        type: Type.STRING,
        description: "The full story script, written out as a narrative."
      },
      prompts: {
        type: Type.ARRAY,
        description: `A list of exactly ${numPrompts} JSON objects, each representing a scene for image generation.`,
        items: {
          type: Type.OBJECT,
          properties: {
            scene_number: { type: Type.INTEGER, description: "The chronological order of the scene, starting from 1." },
            start_time_seconds: { type: Type.INTEGER, description: "The start time of this scene in the video, in seconds." },
            end_time_seconds: { type: Type.INTEGER, description: "The end time of this scene in the video, in seconds. This should be 8 seconds after the start time." },
            prompt: { type: Type.STRING, description: "A highly detailed, self-contained prompt for an AI image generator, including video style, character descriptions, action, and environment. End with '--ar 16:9'." }
          },
          required: ['scene_number', 'start_time_seconds', 'end_time_seconds', 'prompt']
        }
      }
    },
    required: ['characterSheet', 'storyScript', 'prompts']
  };
  
  const characterDetails = characters.map(c => `- Name: ${c.name || 'Unnamed'}\n  - Key Physical Appearance Details: ${c.appearance}`).join('\n');


  const masterPrompt = `
    You are an expert prompt engineer and a creative storyteller.
    Your task is to generate character sheets, a story, and a series of JSON prompts based on user input for one or more characters.
    The final output must be a JSON object matching the provided schema.
    CRITICAL RULE: For the story script and prompts, ALWAYS use the character's name. DO NOT use pronouns like 'he', 'she', or 'they' to refer to them. This is crucial for consistency.

    **Character Details Provided:**
    ${characterDetails}

    **Task Details:**
    - Desired Video Style: ${videoStyle}
    - Number of Image Prompts to Generate: ${numPrompts}
    - Assumed scene duration: 8 seconds.

    ${mode === 'quick' ? `
    **Mode: Quick Story**
    - Story Premise: "${sceneOrTitle}"
    1.  First, write a short, compelling story based on the premise involving the provided character(s). The story should be detailed enough to be broken into ${numPrompts} distinct scenes.
    2.  Based on the story, create a highly detailed, descriptive "Character Sheet" for **EACH** character. This sheet is crucial for visual consistency. Use specific keywords for an AI image generator. Break it down into logical categories (e.g., 'Face', 'Hair', 'Attire'). Combine all character sheets into a single markdown string under a main "Character Sheets" heading.
    3.  Finally, break your story down into ${numPrompts} chronological scenes and write one detailed JSON object for each scene.
    4.  **CRITICAL RULE for each JSON object:**
        -   \`scene_number\`: The chronological order of the scene, starting from 1.
        -   \`start_time_seconds\` and \`end_time_seconds\`: Calculate these based on an 8-second duration for each scene (e.g., scene 1 is 0-8s, scene 2 is 8-16s, etc.).
        -   \`prompt\`: This string MUST begin with the video style: "${videoStyle}". Then, for **ANY** character mentioned by name, you **MUST** include their detailed appearance from their character sheet to maintain consistency. This should be followed by a description of the action, environment, lighting, and mood. The prompt string MUST end with "--ar 16:9".
    5.  Populate the 'characterSheet', 'storyScript', and 'prompts' fields in the JSON output.
    ` : `
    **Mode: Detailed Scene**
    - Scene Description: "${sceneOrTitle}"
    1.  First, create a highly detailed, descriptive "Character Sheet" for **EACH** character based on the details provided. This sheet is crucial for visual consistency. Use specific keywords for an AI image generator. Break it down into logical categories (e.g., 'Face', 'Hair', 'Attire'). Combine all character sheets into a single markdown string under a main "Character Sheets" heading.
    2.  Then, write a short narrative story script that describes what happens in this scene. The story should be detailed enough to be broken into ${numPrompts} distinct scenes.
    3.  Then, based on the story you just wrote, generate ${numPrompts} distinct, sequential JSON prompt objects that depict the unfolding action within that scene. Imagine it as a short storyboard.
    4.  **CRITICAL RULE for each JSON object:**
        -   \`scene_number\`: The chronological order of the scene, starting from 1.
        -   \`start_time_seconds\` and \`end_time_seconds\`: Calculate these based on an 8-second duration for each scene (e.g., scene 1 is 0-8s, scene 2 is 8-16s, etc.).
        -   \`prompt\`: This string MUST begin with the video style: "${videoStyle}". Then, for **ANY** character mentioned by name, you **MUST** include their detailed appearance from their character sheet to maintain consistency. This should be followed by a description of the action, environment, lighting, and mood. The prompt string MUST end with "--ar 16:9".
    5.  Populate the 'characterSheet', 'storyScript', and 'prompts' fields in the JSON output.
    `}
  `;

  try {
    const response: GenerateContentResponse = await aiGlobal.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: masterPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        safetySettings: safetySettings,
      },
    });
    
    const jsonText = response.text;

    if (!jsonText || jsonText.trim() === '') {
        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) {
            throw new Error(`Request was blocked due to ${blockReason}. Please adjust your prompt to be safer.`);
        }
        throw new Error("The AI returned an empty or invalid response. Please try again.");
    }

    const result = JSON.parse(jsonText.trim());
    
    return result;

  } catch (error) {
    if (error instanceof SyntaxError) {
        throw new Error("The AI returned a malformed response that could not be understood. Please try again.");
    }
    throw handleApiError(error, 'story and prompt generation');
  }
}

export async function generateVoiceoverScript(storyScript: string, numPrompts: number, language: string): Promise<string> {
  const minWords = numPrompts * 20;
  const maxWords = numPrompts * 25;
  const prompt = `
    You are a creative storyteller and an expert voiceover scriptwriter. Your task is to rewrite the following story script into a captivating voiceover script that is perfectly timed for a video. The source script may overuse character names; you should rewrite it to use a natural mix of names and pronouns.

    **Instructions:**
    1.  **Language**: The entire voiceover script MUST be written in ${language}.
    2.  **Natural Language:** Rewrite the story to sound natural when spoken. Use a mix of character names and pronouns (he, she, they) appropriately.
    3.  **Pacing and Timing (NON-NEGOTIABLE):**
        - The video has ${numPrompts} scenes, each lasting 8 seconds.
        - A comfortable speaking pace is about 20-25 words per 8 seconds.
        - Therefore, the total script length MUST be between ${minWords} and ${maxWords} words.
        - **This is the most critical rule. It is better to be slightly under the word count than over. Be concise. Cut any unnecessary words or sentences to meet this timing requirement.**
    4.  **Tone:** The tone should be friendly, warm, and engaging.
    5.  **Core Story:** Preserve the main events and feelings of the story.
    6.  **Format:** Write it as a single, flowing paragraph ready for a voice actor to read. Do not include any headings, scene numbers, or an introductory hook. Start directly with the story's narration.

    **Original Story:**
    ---
    ${storyScript}
    ---

    **${language} Voiceover Script (Between ${minWords} and ${maxWords} words):**
  `;

  try {
    const response: GenerateContentResponse = await aiGlobal.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        safetySettings: safetySettings,
      },
    });
    
    const text = response.text;

    if (text === undefined || text === null) {
        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) {
            throw new Error(`Voiceover generation was blocked due to ${blockReason}.`);
        }
        throw new Error("The AI returned an empty response for the voiceover script.");
    }

    return text;
  } catch (error) {
    throw handleApiError(error, 'voiceover generation');
  }
}

export async function enhanceVoiceoverScript(script: string): Promise<string> {
  const prompt = `
    You are an expert voiceover script editor. Your task is to subtly enhance the following script to improve its spoken flow and pacing for a voice actor.
    The goal is a natural, conversational delivery.

    **Instructions:**
    1.  **Improve Flow:** You may slightly rephrase sentences or break up long sentences to make them easier to read aloud and sound more natural.
    2.  **Add Pauses:** Use punctuation like commas (,), em dashes (—), and ellipses (...) to create natural pauses and improve the rhythm.
    3.  **DO NOT add parenthetical cues:** Do not add instructions in parentheses like (pause) or (excitedly). The pacing should be controlled only through text and punctuation.
    4.  **Preserve Meaning:** The core meaning and intent of the original script must be preserved.

    **Script to Enhance:**
    ---
    ${script}
    ---

    **Enhanced Script:**
  `;

  try {
    const response: GenerateContentResponse = await aiGlobal.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        safetySettings: safetySettings,
      },
    });
    
    const text = response.text;

    if (text === undefined || text === null || text.trim() === '') {
        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) {
            throw new Error(`Script enhancement was blocked due to ${blockReason}.`);
        }
        throw new Error("The AI returned an empty response for script enhancement.");
    }

    return text;
  } catch (error) {
    throw handleApiError(error, 'script enhancement');
  }
}

export async function generateAudioFromScript(script: string, voiceName: string): Promise<string> {
    try {
        const response = await aiGlobal.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: script }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
                safetySettings: safetySettings,
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Audio) {
             const blockReason = response.promptFeedback?.blockReason;
            if (blockReason) {
                throw new Error(`Audio generation was blocked due to ${blockReason}.`);
            }
            throw new Error("The AI failed to generate audio. The response did not contain audio data.");
        }

        return base64Audio;
    } catch (error) {
        throw handleApiError(error, 'audio generation');
    }
}

export async function generateThumbnailPrompt(characterSheet: string, storyScript: string | undefined, videoStyle: string, storyTitle: string): Promise<string> {
    const prompt = `
        You are an expert at creating viral YouTube thumbnails. Your task is to create a single, highly detailed, and visually captivating prompt for an AI image generator. The thumbnail should be **scroll-stopping**, **eye-catching**, and generate high click-through rates.

        **Instructions for the Prompt:**
        1.  **Style:** The prompt MUST begin with the specified style: "${videoStyle}".
        2.  **Character Focus:** The thumbnail MUST feature the main character(s) prominently. Their faces should be clearly visible and expressive, conveying strong emotion (e.g., shock, joy, determination, fear). Use a close-up or medium shot. Incorporate their specific, detailed appearance from the character sheet for consistency.
        3.  **High Drama & Intrigue:** Describe a compelling, action-packed, or emotionally charged moment from the story. Create a sense of mystery or conflict that makes the viewer want to know what happens next.
        4.  **Vibrant & Dynamic Composition:** Use keywords for a dynamic and visually appealing composition. Emphasize vibrant colors, dramatic lighting (e.g., "god rays," "neon glow," "rim lighting"), and a clear focal point. Think "cinematic," "epic," "intense."
        5.  **Title Integration (Optional but Recommended):** If a story title is provided, subtly hint at it visually. Do not write text on the image, but use elements that represent the title. For example, for 'The Last Dragon Rider', show a character with a dragon.
        6.  **Clarity & Detail:** Be extremely descriptive about every element to leave no room for ambiguity for the AI.
        7.  **Aspect Ratio:** The prompt MUST end with "--ar 16:9".
        8.  **Output:** Your entire output should be ONLY the final image prompt text, with no extra explanations or labels.

        **Character Sheet:**
        ---
        ${characterSheet}
        ---

        ${storyTitle ? `
        **Story Title:**
        ---
        ${storyTitle}
        ---
        ` : ''}

        **Story Context:**
        ---
        ${storyScript || 'A story based on the character sheet.'}
        ---

        **Viral Thumbnail Image Prompt:**
    `;

    try {
        const response = await aiGlobal.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                safetySettings: safetySettings,
            },
        });

        const thumbnailPrompt = response.text;
        if (!thumbnailPrompt?.trim()) {
            const blockReason = response.promptFeedback?.blockReason;
            if (blockReason) {
                throw new Error(`Thumbnail prompt generation was blocked due to ${blockReason}.`);
            }
            throw new Error("Failed to generate a thumbnail prompt.");
        }

        return thumbnailPrompt.trim();
    } catch (error) {
        throw handleApiError(error, 'thumbnail prompt generation');
    }
}

export async function generateThumbnailImage(characterSheet: string, storyScript: string | undefined, videoStyle: string, storyTitle: string): Promise<string> {
    try {
        const prompt = await generateThumbnailPrompt(characterSheet, storyScript, videoStyle, storyTitle);

        const response = await aiGlobal.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '16:9',
            },
        });

        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        if (!base64ImageBytes) {
            throw new Error("The AI failed to generate a thumbnail image.");
        }
        return base64ImageBytes;
    } catch (error) {
        throw handleApiError(error, 'thumbnail image generation');
    }
}