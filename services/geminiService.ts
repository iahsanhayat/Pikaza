
import { GoogleGenAI, Type, GenerateContentResponse, HarmCategory, HarmBlockThreshold, Modality } from "@google/genai";
import type { CharacterProfile, GeneratedResult } from '../types';

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
  mode: 'detail' | 'fromTitle' | 'fromVoiceover';
  sceneOrTitleOrVoiceover: string;
  videoStyle: string;
  storyLength: 'Short' | 'Medium' | 'Long';
}

export async function generateStoryAndPrompts(
  options: GenerateOptions
): Promise<GeneratedResult> {
  
  const { characters, numPrompts, mode, sceneOrTitleOrVoiceover, videoStyle, storyLength } = options;

  const fromTitleSchema = {
    type: Type.OBJECT,
    properties: {
        characterSheet: {
            type: Type.STRING,
            description: "A single Markdown document containing the detailed, reusable character sheets for all characters invented by the AI."
        },
        storyScript: {
            type: Type.STRING,
            description: "The full story script, written out as a narrative in English, translated from the original Roman Urdu version."
        },
        characters: {
            type: Type.ARRAY,
            description: "A list of JSON objects, each representing a generated character with their name and a detailed, copyable prompt-style description.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the generated character." },
                    description: { type: Type.STRING, description: "A detailed, self-contained description of the character's appearance, suitable for use as a prompt." }
                },
                required: ['name', 'description']
            }
        },
        storyScriptRomanUrdu: {
            type: Type.STRING,
            description: "The full story script, originally written in Roman Urdu based on the provided title."
        }
    },
    required: ['characterSheet', 'storyScript', 'characters', 'storyScriptRomanUrdu']
  };

  const detailSchema = {
    type: Type.OBJECT,
    properties: {
      characterSheet: {
        type: Type.STRING,
        description: "A single Markdown document containing the detailed, reusable character sheets for all characters."
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
    required: ['characterSheet', 'prompts']
  };

  const fromVoiceoverSchema = {
    type: Type.OBJECT,
    properties: {
        characterSheet: {
            type: Type.STRING,
            description: "A single Markdown document containing the detailed, reusable character sheets for all characters identified from the voiceover script (those mentioned more than once)."
        },
        storyScript: {
            type: Type.STRING,
            description: "The full story script, written as a narrative in English, translated from the original Roman Urdu version."
        },
        characters: {
            type: Type.ARRAY,
            description: "A list of JSON objects, each representing a generated character with their name and a detailed, copyable prompt-style description.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the generated character." },
                    description: { type: Type.STRING, description: "A detailed, self-contained description of the character's appearance, suitable for use as a prompt." }
                },
                required: ['name', 'description']
            }
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
        },
        storyScriptRomanUrdu: {
            type: Type.STRING,
            description: "The full story script, originally written in Roman Urdu based on the provided voiceover script."
        }
    },
    required: ['characterSheet', 'storyScript', 'characters', 'prompts', 'storyScriptRomanUrdu']
};
  
  let schema;
  let masterPrompt;
  
  const characterDetails = characters.map(c => `- Name: ${c.name || 'Unnamed'}\n  - Key Physical Appearance Details: ${c.appearance}`).join('\n');

  switch (mode) {
    case 'fromVoiceover':
        schema = fromVoiceoverSchema;
        masterPrompt = `
          You are an expert prompt engineer and a creative storyteller for kids, specializing in Roman Urdu content. Your task is to generate content based on a provided voiceover script.
          The final output must be a JSON object matching the provided schema.
          Desired Video Style for any visual descriptions: ${videoStyle}
  
          **Mode: From Voiceover**
          - Voiceover Script Provided: "${sceneOrTitleOrVoiceover}"
          - Number of Image Prompts to Generate: ${numPrompts}
  
          1.  **Analyze Script & Identify Characters:** Read the voiceover script carefully. Identify all characters that are mentioned more than one time.
          2.  **Invent & Create Character Sheets:** For each identified character, invent a detailed visual appearance. Write a highly descriptive "Character Sheet" in **English** for **EACH** invented character. This is crucial for visual consistency for an AI image generator. Combine all character sheets into a single markdown string.
          3.  **Write Story Script in Roman Urdu:** Based on the voiceover, write a full narrative story script in **Roman Urdu** that expands on the events. This is the primary story.
          4.  **Translate Story to English:** Translate the entire Roman Urdu story script into English.
          5.  **Generate Character Descriptions:** For each character you invented, create a separate JSON object in **English** containing their name and a detailed, self-contained, prompt-style description of their appearance.
          6.  **Generate Video Prompts:** Break down the story into ${numPrompts} sequential scenes. For each scene, create a JSON prompt object. The prompts must be in **English**.
          7.  **CRITICAL RULE for each prompt object:**
              -   \`scene_number\`, \`start_time_seconds\`, \`end_time_seconds\`: Calculate these based on an 8-second duration for each scene (e.g., scene 1 is 0-8s, scene 2 is 8-16s, etc.).
              -   \`prompt\`: This string MUST begin with "${videoStyle}". Then, for **ANY** character mentioned by name, you **MUST** include their detailed appearance from their character sheet to maintain consistency. This is followed by a description of the action, environment, lighting, and mood. The prompt string MUST end with "--ar 16:9".
          8.  **Final JSON:** Populate all fields: 'characterSheet', 'storyScript' (the English translation), 'characters', 'prompts', and 'storyScriptRomanUrdu' (the original Roman Urdu story).
        `;
        break;
    case 'fromTitle': {
        const storyLengthToCharCount = {
            'Short': 900,
            'Medium': 2400,
            'Long': 3600
        };
        const characterCount = storyLengthToCharCount[storyLength];
        schema = fromTitleSchema;
        masterPrompt = `
            You are an expert prompt engineer and a creative storyteller for kids, specializing in Roman Urdu content.
            Your task is to generate content based on user input.
            The final output must be a JSON object matching the provided schema.
            Desired Video Style for any visual descriptions: ${videoStyle}
        
            **Mode: From Title**
            - Story Title: "${sceneOrTitleOrVoiceover}"
            - Desired Story Length: ${storyLength}
        
            1.  **Invent Characters:** Based on the story title, invent at least two compelling characters that fit the theme.
            2.  **Create Character Sheets:** Write a highly detailed, descriptive "Character Sheet" in **English** for **EACH** invented character. This is crucial for visual consistency for an AI image generator. Combine all character sheets into a single markdown string.
            3.  **Write Story Script in Roman Urdu:** Write a compelling story in **Roman Urdu** based on the title and the characters you invented. **CRITICAL:** The story script must be approximately ${characterCount} characters long. This is the primary story.
            4.  **Translate Story to English:** Translate the entire Roman Urdu story script into English.
            5.  **Generate Character Descriptions:** For each character you invented, create a separate JSON object in **English** containing their name and a detailed, self-contained, prompt-style description of their appearance.
            6.  **Final JSON:** Populate all fields: 'characterSheet', 'storyScript' (the English translation), 'characters', and 'storyScriptRomanUrdu' (the original Roman Urdu story). Do NOT generate 'prompts'.
        `;
        break;
    }
    case 'detail':
    default:
        schema = detailSchema;
        masterPrompt = `
            You are an expert prompt engineer and a creative storyteller.
            Your task is to generate content based on user input.
            The final output must be a JSON object matching the provided schema.
            Desired Video Style for any visual descriptions: ${videoStyle}

            **Mode: Detailed Scene**
            - Scene Description: "${sceneOrTitleOrVoiceover}"
            - Character Details Provided:
              ${characterDetails}
            - Number of Image Prompts to Generate: ${numPrompts}
            - Assumed scene duration: 8 seconds.
            
            1.  First, create a highly detailed, descriptive "Character Sheet" for **EACH** character based on the details provided. This sheet is crucial for visual consistency. Use specific keywords for an AI image generator. Break it down into logical categories (e.g., 'Face', 'Hair', 'Attire'). Combine all character sheets into a single markdown string under a main "Character Sheets" heading.
            2.  Then, based on the scene description, generate ${numPrompts} distinct, sequential JSON prompt objects that depict the unfolding action within that scene. Imagine it as a short storyboard.
            3.  **CRITICAL RULE for each JSON prompt object:**
                -   \`scene_number\`: The chronological order of the scene, starting from 1.
                -   \`start_time_seconds\` and \`end_time_seconds\`: Calculate these based on an 8-second duration for each scene (e.g., scene 1 is 0-8s, scene 2 is 8-16s, etc.).
                -   \`prompt\`: This string MUST begin with the video style: "${videoStyle}". Then, for **ANY** character mentioned by name, you **MUST** include their detailed appearance from their character sheet to maintain consistency. This should be followed by a description of the action, environment, lighting, and mood. The prompt string MUST end with "--ar 16:9".
            4.  Populate the 'characterSheet' and 'prompts' fields in the JSON output. Do not generate a 'storyScript' or 'characters'.
        `;
        break;
  }

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

    if(mode === 'detail') {
        if (result.storyScript) delete result.storyScript;
        if (result.characters) delete result.characters;
    }
    if (mode === 'fromTitle' && result.prompts) {
        delete result.prompts;
    }
    
    return result;

  } catch (error) {
    if (error instanceof SyntaxError) {
        throw new Error("The AI returned a malformed response that could not be understood. Please try again.");
    }
    throw handleApiError(error, 'story and prompt generation');
  }
}

export async function generateVoiceoverScript(storyScript: string, targetCharacterCount: number, isUrdu: boolean): Promise<string> {
  const prompt = isUrdu
    ? `
    You are a creative storyteller for children. Your task is to rewrite the following Roman Urdu story script into a captivating voiceover script in Roman Urdu for a kids' video.

    **Instructions:**
    1.  **Engaging Hook:** Start with a hook! Ask a question or present a mysterious statement in Roman Urdu to make kids curious and want to watch the whole video.
    2.  **Simple Language:** Use simple, easy-to-understand Roman Urdu words that a young child can follow. Keep sentences short and clear.
    3.  **Kid-Friendly Tone:** The tone should be friendly, warm, and exciting.
    4.  **Character Limit:** **CRITICAL REQUIREMENT:** The final voiceover script MUST NOT exceed ${targetCharacterCount} characters. You must be concise.
    5.  **Core Story:** Preserve the main events and feelings of the story.
    6.  **Format:** Write it as a single, flowing paragraph in Roman Urdu ready for a voice actor to read. Do not include any headings or scene numbers.

    **Original Roman Urdu Story:**
    ---
    ${storyScript}
    ---

    **Kids' Voiceover Script in Roman Urdu (MAX ${targetCharacterCount} characters):**
  `
    : `
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

export async function translateScriptToEnglish(script: string): Promise<string> {
    const prompt = `
        You are an expert translator. Your task is to translate the following text from Roman Urdu to natural, fluent English.
        - Preserve the tone and intent of the original text.
        - If the text already appears to be in English, return it as-is without any changes or additional text.
        - Your output should ONLY be the translated English text.

        **Text to Translate:**
        ---
        ${script}
        ---

        **English Translation:**
    `;
    try {
        const response = await aiGlobal.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { safetySettings },
        });
        const translatedText = response.text;
        if (!translatedText?.trim()) {
            const blockReason = response.promptFeedback?.blockReason;
            if (blockReason) {
                throw new Error(`Translation was blocked due to ${blockReason}.`);
            }
            throw new Error("Translation resulted in an empty string.");
        }
        return translatedText.trim();
    } catch (error) {
        throw handleApiError(error, 'script translation');
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

async function generateSimpleImagePrompt(characterSheet: string, storyScript: string | undefined, style: '3D Pixar-Style' | 'Realistic High-Quality Photo-Style'): Promise<string> {
    const prompt = `
        You are an expert YouTube Thumbnail Designer for Islamic Kids Stories.
        Your task is to generate a single, high-CTR, kid-friendly image prompt for a thumbnail.

        **Style to Generate:** ${style}

        **Key Rules & Requirements (Follow Strictly):**
        - Create a bright, attractive, emotional, Islamic, and story-based visual.
        - The main character MUST be the focus (big, centered, expressive).
        - Add a strong facial expression (curiosity, happiness, surprise, learning moment, awe, kindness, etc.).
        - The prompt must reflect the exact storyline of the script provided.
        - Use storytelling elements, Islamic values, and emotional connection.
        - The style should attract BOTH kids & parents.
        - Do NOT add any text in the prompt description itself.
        - The final prompt must end with "--ar 16:9".
        - The prompt should describe a 5-7 year old Muslim kid (boy or girl depending on story) with modest & cultural clothing (Shalwar Kameez, Abaya, Hijab, Topi, Kurta, etc.).
        - Use Islamic elements when suitable: Masjid, prayer mat, stars, moon, kindness scenes, morals, family scenes, Eid, dua, Quran, Islamic manners, etc.
        - The output should be ONLY the prompt text, no explanations.

        **Character Sheet (for consistency):**
        ---
        ${characterSheet}
        ---

        **Story Script:**
        ---
        ${storyScript || 'A story based on the character sheet.'}
        ---

        **Image Prompt:**`;

    const response = await aiGlobal.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { safetySettings },
    });
    const imagePrompt = response.text;
    if (!imagePrompt?.trim()) {
        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) {
            throw new Error(`Thumbnail prompt generation was blocked due to ${blockReason}.`);
        }
        throw new Error("Failed to generate thumbnail prompt.");
    }
    return imagePrompt.trim();
}

async function generateImage(prompt: string): Promise<string> {
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
}

async function generateTitles(storyScript: string | undefined): Promise<string[]> {
    const prompt = `
        Based on the provided story script, generate exactly 3 short YouTube video title options suitable for Islamic kids stories (ages 4-10).

        **Title Rules:**
        - Short, simple, kid-friendly (max 55 characters).
        - Add curiosity or a moral element.
        - Should attract kids and parents.
        - Examples: "Little Abdullah Learns to Share", "A Kindness Lesson at the Masjid", "The Lost Toy and a Beautiful Dua"
        - The output should be a JSON array of 3 strings.

        **Story Script:**
        ---
        ${storyScript || 'A story about kindness and faith.'}
        ---

        **Titles (JSON Array):**`;
    
    const response = await aiGlobal.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            safetySettings,
        },
    });
    const jsonText = response.text;
    if (!jsonText?.trim()) {
        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) {
            throw new Error(`Title generation was blocked due to ${blockReason}.`);
        }
        throw new Error("Failed to generate titles.");
    }
    return JSON.parse(jsonText.trim());
}

export async function generateThumbnailsAndTitles(characterSheet: string, storyScript: string | undefined): Promise<{ thumbnail3d: string; thumbnailRealistic: string; titles: string[]; thumbnail3dPrompt: string; thumbnailRealisticPrompt: string; }> {
    try {
        const [prompt3d, promptRealistic, titles] = await Promise.all([
            generateSimpleImagePrompt(characterSheet, storyScript, '3D Pixar-Style'),
            generateSimpleImagePrompt(characterSheet, storyScript, 'Realistic High-Quality Photo-Style'),
            generateTitles(storyScript)
        ]);

        const [image3d, imageRealistic] = await Promise.all([
            generateImage(prompt3d),
            generateImage(promptRealistic)
        ]);

        return {
            thumbnail3d: image3d,
            thumbnailRealistic: imageRealistic,
            titles: titles,
            thumbnail3dPrompt: prompt3d,
            thumbnailRealisticPrompt: promptRealistic,
        };
    } catch (error) {
        throw handleApiError(error, 'thumbnail and title generation');
    }
}

export async function generateStandaloneThumbnail(userPrompt: string): Promise<{ imageB64: string, prompt: string }> {
    const finalPrompt = `
        High-quality YouTube thumbnail for a kids story, 3D Pixar Style, cinematic, vibrant colors, high detail, dramatic lighting, emotionally resonant.
        Subject: ${userPrompt}.
        Focus on a character's expressive face.
        No text on the image.
        --ar 16:9
    `;

    try {
        const response = await aiGlobal.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: finalPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '16:9',
            },
        });
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        if (!base64ImageBytes) {
            throw new Error("The AI failed to generate a standalone thumbnail image.");
        }
        return { imageB64: base64ImageBytes, prompt: finalPrompt };
    } catch (error) {
        throw handleApiError(error, 'standalone thumbnail generation');
    }
}
