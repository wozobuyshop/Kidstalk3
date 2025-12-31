import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResult, ReplyResult } from "../types";

/**
 * Helper to safely parse JSON from Gemini response which might contain markdown formatting.
 */
function parseGeminiJson(responseText: string | undefined): any {
  if (!responseText) {
    throw new Error("The AI response was empty. Please try speaking again.");
  }
  
  // Remove potential markdown wrappers like ```json ... ```
  let cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // Basic check for JSON structure
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    console.error("Non-JSON response received:", cleaned);
    throw new Error("AI returned an unexpected format.");
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON content:", cleaned);
    throw new Error("Failed to process the AI response data.");
  }
}

/**
 * Transcribes audio and provides translations in one step using Gemini 3 Flash.
 */
export async function processAudio(audioBase64: string, mimeType: string): Promise<TranslationResult> {
  const apiKey = process.env.API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `
              Transcribe the provided audio carefully. 
              Identify the language (English, French, or Arabic/Darija).
              Translate the text into English, Arabic (Modern Standard), and French.
              Return ONLY a valid JSON object with this structure:
              {
                "originalText": "string",
                "detectedLanguage": "string",
                "translations": {
                  "en": "string",
                  "ar": "string",
                  "fr": "string"
                }
              }
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalText: { type: Type.STRING },
            detectedLanguage: { type: Type.STRING },
            translations: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING },
                ar: { type: Type.STRING },
                fr: { type: Type.STRING }
              }
            }
          },
          required: ["originalText", "detectedLanguage", "translations"]
        }
      }
    });

    return parseGeminiJson(response.text);
  } catch (err: any) {
    console.error("Gemini API Error (Process Audio):", err);
    throw new Error(err.message || "Communication with Gemini failed.");
  }
}

/**
 * Specifically handles a child's reply in Darija/Arabic and translates to a target language.
 */
export async function processReply(audioBase64: string, mimeType: string, targetLang: string): Promise<ReplyResult> {
  const apiKey = process.env.API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `
              The speaker is a child speaking in Moroccan Darija or Arabic.
              1. Transcribe the audio exactly.
              2. Translate it into ${targetLang}.
              Return ONLY a valid JSON object:
              {
                "childOriginalText": "string",
                "translatedReply": "string",
                "targetLanguage": "${targetLang}"
              }
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            childOriginalText: { type: Type.STRING },
            translatedReply: { type: Type.STRING },
            targetLanguage: { type: Type.STRING }
          },
          required: ["childOriginalText", "translatedReply", "targetLanguage"]
        }
      }
    });

    return parseGeminiJson(response.text);
  } catch (err: any) {
    console.error("Gemini API Error (Process Reply):", err);
    throw new Error(err.message || "Failed to process reply.");
  }
}

/**
 * Generates child-friendly TTS audio using Gemini 2.5 Flash TTS.
 */
export async function generateSpeech(text: string, langCode: string): Promise<string> {
  const apiKey = process.env.API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  const voices = {
    en: 'Kore', 
    ar: 'Kore', 
    fr: 'Puck'  
  };
  
  const voiceName = (voices as any)[langCode] || 'Kore';

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say with a happy, friendly child-like voice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    let audioData = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          audioData = part.inlineData.data;
          break;
        }
      }
    }

    if (!audioData) {
      throw new Error("No audio was generated.");
    }
    
    return audioData;
  } catch (err: any) {
    console.error("Gemini TTS Error:", err);
    throw new Error(err.message || "Speech generation failed.");
  }
}