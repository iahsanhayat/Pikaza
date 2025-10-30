import { GoogleGenAI, Type, GenerateContentResponse, HarmCategory, HarmBlockThreshold, Modality } from "@google/genai";
import type { CharacterProfile } from '../types';

// Fix: Use process.env.API_KEY as per the guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
): Promise<{ characterSheet: string; storyScript?: string; prompts: string[] }> {
  
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
        description: "The full story script, written out as a narrative. This should only be generated in 'quick' mode."
      },
      prompts: {
        type: Type.ARRAY,
        description: `A list of exactly ${numPrompts} image generation prompts based on the story.`,
        items: {
          type: Type.STRING,
        }
      }
    },
    required: ['characterSheet', 'prompts']
  };
  
  const characterDetails = characters.map(c => `- Name: ${c.name || 'Unnamed'}\n  - Key Physical Appearance Details: ${c.appearance}`).join('\n');


  const masterPrompt = `
    You are an expert prompt engineer and a creative storyteller.
    Your task is to generate character sheets, a story, and a series of image prompts based on user input for one or more characters.
    The final output must be a JSON object matching the provided schema.

    **Character Details Provided:**
    ${characterDetails}

    **Task Details:**
    - Desired Video Style: ${videoStyle}
    - Number of Image Prompts to Generate: ${numPrompts}

    ${mode === 'quick' ? `
    **Mode: Quick Story**
    - Story Premise: "${sceneOrTitle}"
    1.  First, write a short, compelling story based on the premise involving the provided character(s). The story should be detailed enough to be broken into ${numPrompts} distinct scenes.
    2.  Based on the story, create a highly detailed, descriptive "Character Sheet" for **EACH** character. This sheet is crucial for visual consistency. Use specific keywords for an AI image generator. Break it down into logical categories (e.g., 'Face', 'Hair', 'Attire'). Combine all character sheets into a single markdown string under a main "Character Sheets" heading.
    3.  Finally, break your story down into ${numPrompts} chronological scenes and write one detailed image prompt for each scene.
    4.  **CRITICAL RULE:** Each prompt MUST begin with the video style: "${videoStyle}". Then, for **ANY** character mentioned by name in a prompt, you **MUST** include their detailed appearance from their character sheet to maintain consistency. This should be followed by a description of the action, environment, lighting, and mood. End each prompt with "--ar 16:9".
    5.  Populate the 'characterSheet', 'storyScript', and 'prompts' fields in the JSON output.
    ` : `
    **Mode: Detailed Scene**
    - Scene Description: "${sceneOrTitle}"
    1.  First, create a highly detailed, descriptive "Character Sheet" for **EACH** character based on the details provided. This sheet is crucial for visual consistency. Use specific keywords for an AI image generator. Break it down into logical categories (e.g., 'Face', 'Hair', 'Attire'). Combine all character sheets into a single markdown string under a main "Character Sheets" heading.
    2.  Then, based on the scene description, generate ${numPrompts} distinct, sequential image prompts that depict the unfolding action within that scene. Imagine it as a short storyboard.
    3.  **CRITICAL RULE:** Each prompt MUST begin with the video style: "${videoStyle}". Then, for **ANY** character mentioned by name in a prompt, you **MUST** include their detailed appearance from their character sheet to maintain consistency. This should be followed by a description of the action, environment, lighting, and mood. End each prompt with "--ar 16:9".
    4.  Populate the 'characterSheet' and 'prompts' fields in the JSON output. Do not generate a 'storyScript'.
    `}
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
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

    if(mode === 'detail' && result.storyScript) {
        delete result.storyScript;
    }
    
    return result;

  } catch (error) {
    if (error instanceof SyntaxError) {
        throw new Error("The AI returned a malformed response that could not be understood. Please try again.");
    }
    throw handleApiError(error, 'story and prompt generation');
  }
}

export async function generateVoiceoverScript(storyScript: string, targetCharacterCount: number): Promise<string> {
  const prompt = `
    You are a creative storyteller for children. Your task is to rewrite the following story script into a captivating voiceover script for a kids' video.

    **Instructions:**
    1.  **Engaging Hook:** Start with a hook! Ask a question or present a mysterious statement to make kids curious and want to watch the whole video.
    2.  **Simple Language:** Use simple, easy-to-understand words that a young child can follow. Keep sentences short and clear.
    3.  **Kid-Friendly Tone:** The tone should be friendly, warm, and exciting.
    4.  **Character Limit:** **CRITICAL REQUIREMENT:** The final voiceover script MUST NOT exceed ${targetCharacterCount} characters. You must be concise.
    5.  **Core Story:** Preserve the main events and feelings of the story.
    6.  **Format:** Write it as a single, flowing paragraph ready for a voice actor to read. Do not include any headings or scene numbers.

    **Original Story:**
    ---
    ${storyScript}
    ---

    **Kids' Voiceover Script (MAX ${targetCharacterCount} characters):**
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
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
    You are an expert voiceover director. Your goal is to make the voice actor's performance sound like a calm, conversational, and mature storyteller. The delivery should have a natural flow, not be overly dramatic or deep-voiced.
    Your task is to subtly enhance the following script to guide the voice actor.
    - Insert expressive cues in parentheses to guide the tone towards a calm, conversational style. Examples: (calmly), (thoughtfully), (gently), (as if reminiscing).
    - Use ellipses (...) and strategic commas to create a natural, smooth-flowing pace. Avoid abrupt stops.
    - The focus is on clarity and a pleasant, engaging listening experience, not on a deep, booming narrator voice.
    - **CRITICAL:** You must not change any of the original words of the script. Your role is only to add the parenthetical cues and punctuation for pacing.
    - The goal is a performance that feels authentic, human, and easy to listen to.

    **Script to Enhance:**
    ---
    ${script}
    ---

    **Enhanced Script:**
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
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
        const response = await ai.models.generateContent({
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

export async function generateThumbnail(characterSheet: string, storyScript: string | undefined, videoStyle: string): Promise<string> {
    const promptGenerationPrompt = `
        Based on the following character sheet and story, create a single, highly detailed, and visually captivating prompt for an AI image generator (Imagen) to create a YouTube video thumbnail in a 16:9 aspect ratio.

        **Instructions for the Prompt:**
        1.  **Style:** The style MUST be: "${videoStyle}".
        2.  **Focus:** The thumbnail must feature the main character(s) prominently in a dynamic or emotionally resonant pose.
        3.  **Composition:** Describe a compelling scene that captures the essence of the story. Use strong keywords for composition, lighting, and mood (e.g., "dramatic lighting," "cinematic composition," "action shot," "intense close-up").
        4.  **Clarity:** Be extremely descriptive to ensure the generated image is high-quality and detailed.
        5.  **Output:** Your entire output should be ONLY the final image prompt text, with no extra explanations, labels, or quotation marks.

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
        // Step 1: Generate the perfect prompt for the thumbnail
        const promptResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: promptGenerationPrompt,
            config: {
                safetySettings: safetySettings,
            },
        });

        const imagePrompt = promptResponse.text;
        if (!imagePrompt?.trim()) {
            const blockReason = promptResponse.promptFeedback?.blockReason;
            if (blockReason) {
                throw new Error(`Thumbnail prompt generation was blocked due to ${blockReason}.`);
            }
            throw new Error("Failed to generate a thumbnail prompt.");
        }

        // Step 2: Generate the image using the created prompt
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: imagePrompt.trim(),
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9',
            },
        });

        const base64ImageBytes = imageResponse.generatedImages[0]?.image?.imageBytes;

        if (!base64ImageBytes) {
            throw new Error("The AI failed to generate a thumbnail image. The response may have been blocked for safety reasons.");
        }

        return base64ImageBytes;

    } catch (error) {
        throw handleApiError(error, 'thumbnail generation');
    }
}
