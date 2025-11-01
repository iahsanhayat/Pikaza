import { GoogleGenAI, Type, GenerateContentResponse, HarmCategory, HarmBlockThreshold, Modality } from "@google/genai";
import type { CharacterProfile, ScenePrompt, IntermediateResult, ExtractedCharacter } from '../types';

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

interface GenerateStoryOptions {
  mode: 'detail' | 'quick';
  sceneOrTitle: string;
  numPrompts: number;
}

export async function generateStoryAndExtractCharacters(options: GenerateStoryOptions): Promise<IntermediateResult> {
    const { mode, sceneOrTitle, numPrompts } = options;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            storyScript: {
                type: Type.STRING,
                description: `A creative and engaging story. For 'quick' mode, it should be a complete narrative based on the title. For 'detail' mode, it should be an expanded, vivid description of the single scene. The story must be detailed enough to support ${numPrompts} distinct visual prompts.`
            },
            characters: {
                type: Type.ARRAY,
                description: "A list of all characters identified in the story.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "The character's name." },
                        description: { type: Type.STRING, description: "A brief description of the character based ONLY on details mentioned in the generated storyScript." }
                    },
                    required: ['name', 'description']
                }
            }
        },
        required: ['storyScript', 'characters']
    };

    const storyPrompt = mode === 'quick' 
        ? `Write a complete, short story based on the title: "${sceneOrTitle}". The story must have a smooth, cinematic flow where each scene logically and seamlessly transitions to the next. Avoid repetitive scenes or descriptions. The narrative must be engaging, creative, and detailed enough to be broken down into ${numPrompts} distinct visual scenes.`
        : `Expand the following scene description into a vivid and detailed narrative moment: "${sceneOrTitle}". The narrative should be rich enough to inspire ${numPrompts} distinct visual prompts.`;

    const masterPrompt = `
        You are a professional story writer and a visionary 3D movie director with an expert eye for cinematic detail. Your first task is to write a story based on the user's request.
        Your second task is to carefully read the story you just wrote and identify all the characters mentioned.
        
        **Story Request:**
        ${storyPrompt}

        **Instructions:**
        1. Write the story and place it in the \`storyScript\` field. **CRITICAL RULE: In the story, you MUST always use a character's full name. DO NOT use pronouns (like he, she, they, him, her) to refer to them.** This is essential for consistency.
        2. After writing the story, identify every character. For each character, extract a brief, one-sentence description based *only* on what is written in the story.
        3. Place the character information in the \`characters\` array.
        4. Return a single JSON object that conforms to the provided schema.
    `;

    try {
        const response = await aiGlobal.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: masterPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                safetySettings: safetySettings,
            },
        });
        
        const jsonText = response.text.trim();
        if (!jsonText) throw new Error("The AI returned an empty response.");

        return JSON.parse(jsonText);
    } catch (error) {
        throw handleApiError(error, 'story generation and character extraction');
    }
}


interface GenerateFinalOptions {
  characters: CharacterProfile[];
  storyScript: string;
  numPrompts: number;
  videoStyle: string;
}

export async function generateFinalAssets(
  options: GenerateFinalOptions
): Promise<{ characterSheet: string; prompts: ScenePrompt[] }> {
  
  const { characters, storyScript, numPrompts, videoStyle } = options;

  const schema = {
    type: Type.OBJECT,
    properties: {
      characterSheet: {
        type: Type.STRING,
        description: "A single Markdown document containing the detailed, reusable character sheets for all characters, created from the final character details provided."
      },
      prompts: {
        type: Type.ARRAY,
        description: `A list of exactly ${numPrompts} JSON objects, each representing a scene for image generation based on the story script.`,
        items: {
          type: Type.OBJECT,
          properties: {
            scene_number: { type: Type.INTEGER, description: "The chronological order of the scene, starting from 1." },
            prompt: { type: Type.STRING, description: "A highly detailed, self-contained prompt for an AI image generator, including video style, character descriptions from the sheet, action, and environment. End with '--ar 16:9'." }
          },
          required: ['scene_number', 'prompt']
        }
      }
    },
    required: ['characterSheet', 'prompts']
  };
  
  const characterDetails = characters.map(c => `- Name: ${c.name}\n  - Final Appearance Details: ${c.appearance}`).join('\n');

  const masterPrompt = `
    You are an expert prompt engineer. Your task is to generate a final, detailed character sheet and a series of JSON prompts. You will be given the final, user-approved character descriptions and a complete story script.
    The final output must be a JSON object matching the provided schema. It is MANDATORY that the 'prompts' array in the final JSON contains exactly ${numPrompts} items.

    **Final Character Details Provided:**
    ${characterDetails}
    
    **Full Story Script Provided:**
    ---
    ${storyScript}
    ---

    **Task Details:**
    - Desired Video Style: ${videoStyle}
    - Number of Image Prompts to Generate: ${numPrompts}

    **Instructions:**
    1.  First, using the **Final Character Details**, create a highly detailed, descriptive "Character Sheet" for **EACH** character. This sheet is crucial for visual consistency. Use specific keywords for an AI image generator. Break it down into logical categories (e.g., 'Face', 'Hair', 'Attire'). Combine all character sheets into a single markdown string under a main "Character Sheets" heading.
    2.  Next, read the **Full Story Script** and break it down into exactly ${numPrompts} chronological scenes. For each scene, write one detailed JSON prompt object.
    3.  **CRITICAL RULE for each JSON prompt object:**
        -   \`scene_number\`: The chronological order of the scene, starting from 1.
        -   \`prompt\`: This string MUST be a single, detailed, and self-contained line of text for an AI image generator. It MUST begin with the video style: "${videoStyle}". Then, for ANY character mentioned by name, you MUST inject their complete, detailed appearance from the **Character Sheet** you just created to ensure visual consistency. When describing the action, you MUST use the character's name instead of pronouns (he, she, they). This should be followed by a rich description of the action from the story, the character's specific emotion, the camera angle, shot type, and the environment with specific details about lighting and atmosphere. The prompt string MUST end with "--ar 16:9".
    4.  Populate the 'characterSheet' and 'prompts' fields in the final JSON output.
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
    throw handleApiError(error, 'final asset generation');
  }
}

export async function generateVoiceoverScript(storyScript: string, numPrompts: number, language: string): Promise<string> {
  const prompt = `
    You are a professional screenwriter and voiceover artist. Your task is to write a single, continuous voiceover script based on a story. The script must be perfectly paced to match a video composed of a specific number of scenes, each with a fixed duration.

    **Core Task:**
    Write a voiceover script in **${language}** that narrates the provided story.

    **Pacing Requirements (MANDATORY):**
    - The video consists of exactly **${numPrompts}** scenes.
    - Each scene is exactly **8 seconds** long.
    - The total video length is ${numPrompts * 8} seconds.
    - You MUST write the script so that the narration for each part of the story naturally aligns with its corresponding 8-second visual scene. The total spoken time of the script should be approximately ${numPrompts * 8} seconds.

    **Content & Style:**
    - The script must be a single block of text, without scene numbers or headings.
    - The tone should be engaging, cinematic, and appropriate for the story.
    - Start the narration directly from the first scene. Do not add any introductory hooks or titles.
    - **IMPORTANT:** The provided story script may overuse character names. Your job is to make the narration sound natural for a voiceover. Use a fluid, natural mix of character names and pronouns (he, she, they, etc.) to avoid repetition and improve the flow.

    **Story Script Provided:**
    ---
    ${storyScript}
    ---

    **Final Voiceover Script (single block of text):**
  `;

  try {
    const response: GenerateContentResponse = await aiGlobal.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        safetySettings: safetySettings,
      },
    });
    
    const text = response.text.trim();
    if (!text) {
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
    You are an expert voiceover director. Your goal is to make a script sound more natural and conversational when read by an AI text-to-speech engine.
    Your task is to lightly edit the following script to improve its pacing and delivery for an AI voice model.

    **Instructions:**
    - Break up long, complex sentences into shorter, more digestible ones.
    - Use punctuation like ellipses (...) and commas to create natural pauses and a conversational rhythm.
    - You may slightly rephrase parts for clarity and flow, but you MUST preserve the original meaning and core story events.
    - **CRITICAL:** Do NOT add parenthetical notes like (excitedly) or (pause), as the AI will read them aloud. Your enhancement should be seamless within the text itself.
    - The final output should be a script that sounds authentic, expressive, and easy to listen to when spoken.

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
        const ttsPrompt = `Read the following script in the style of a calm, mature, and engaging storyteller, with natural pacing and warmth: ${script}`;
        const response = await aiGlobal.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: ttsPrompt }] }],
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

export async function generateThumbnailPrompt(characterSheet: string, storyScript: string | undefined, videoStyle: string): Promise<string> {
    const prompt = `
        Based on the following character sheet and story, create a single, highly detailed, and visually captivating prompt for an AI image generator to create a YouTube video thumbnail.

        **Instructions for the Prompt:**
        1.  **Style:** The prompt MUST begin with the specified style: "${videoStyle}".
        2.  **Character Consistency:** For any character mentioned, you MUST incorporate their specific, detailed appearance from the character sheet to ensure consistency.
        3.  **Focus & Composition:** The thumbnail must feature the main character(s) prominently in a dynamic or emotionally resonant pose. Describe a compelling scene that captures the essence of the story. Use strong keywords for composition, lighting, and mood (e.g., "dramatic lighting," "cinematic composition," "action shot," "intense close-up", "rule of thirds").
        4.  **Clarity & Detail:** Be extremely descriptive about every element: the characters' expressions, clothing textures, background details, weather, time of day, and overall atmosphere. The goal is to leave no room for ambiguity for the AI image generator.
        5.  **Aspect Ratio:** The prompt MUST end with "--ar 16:9" to ensure the correct thumbnail dimensions.
        6.  **Output:** Your entire output should be ONLY the final image prompt text, with no extra explanations, labels, or quotation marks.

        **Character Sheet:**
        ---
        ${characterSheet}
        ---

        **Story:**
        ---
        ${storyScript || 'A story based on the character sheet.'}
        ---

        **Image Prompt:**
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

export async function generateThumbnailImage(characterSheet: string, storyScript: string | undefined, videoStyle: string): Promise<string> {
    try {
        const prompt = await generateThumbnailPrompt(characterSheet, storyScript, videoStyle);

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