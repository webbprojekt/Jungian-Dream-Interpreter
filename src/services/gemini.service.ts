
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from '@google/genai';
import { DreamAnalysis } from '../models/dream';

// FIX: Assume process.env.API_KEY is available in the execution environment as per guidelines.
// This avoids hardcoding keys or providing mock implementations.
declare const process: {
  env: {
    API_KEY: string;
  }
};


@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai: GoogleGenAI;
  private chatInstance: Chat | null = null;

  constructor() {
    // FIX: Removed check for placeholder API key. The key is expected to be provided by the environment.
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getDreamAnalysis(dreamText: string): Promise<DreamAnalysis> {
    const analysisSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'A creative, insightful title for the dream analysis.' },
        article: { type: Type.STRING, description: 'A detailed, 400+ word article interpreting the dream in Markdown. The article must include several sub-headlines (using ## Markdown syntax) to structure the analysis. Discuss symbols, archetypes (Shadow, Anima/Animus), and individuation.' },
        jungianConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING, description: 'The Jungian concept found in the dream.' },
              explanation: { type: Type.STRING, description: 'A concise explanation of the term and its relevance to the dream.' }
            },
            required: ['term', 'explanation']
          }
        },
        mythologicalConnections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              parallel: { type: Type.STRING, description: 'The myth, fairy tale, or cultural story.' },
              explanation: { type: Type.STRING, description: 'How the story parallels themes in the dream.' }
            },
            required: ['parallel', 'explanation']
          }
        },
        imagePrompt: { type: Type.STRING, description: 'A highly detailed, artistic, and surreal prompt for an image generator that captures the dream\'s core symbolism. E.g., "A colossal tree with glowing roots, visionary art, surrealism...".' }
      },
      required: ['title', 'article', 'jungianConcepts', 'mythologicalConnections', 'imagePrompt']
    };

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: dreamText,
      config: {
        systemInstruction: 'You are an expert Jungian analyst. Analyze the user\'s dream according to the principles of Carl Jung. Provide a deep, insightful interpretation. Your response MUST be in the provided JSON format.',
        responseMimeType: 'application/json',
        responseSchema: analysisSchema
      }
    });

    try {
      const jsonString = response.text;
      return JSON.parse(jsonString) as DreamAnalysis;
    } catch (error) {
      console.error('Error parsing Gemini analysis JSON:', error);
      throw new Error('Failed to get a valid analysis from the AI.');
    }
  }

  async generateDreamImage(prompt: string): Promise<string> {
    const response = await this.ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      }
    });
    
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  }
  
  startChat(dreamText: string): void {
     this.chatInstance = this.ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are the user's dream, speaking from a Jungian perspective. Personify the dream's content and answer their questions with insight and a touch of mystery. The user's dream was: "${dreamText}"`
        },
    });
  }

  async continueChat(message: string): Promise<GenerateContentResponse> {
    if (!this.chatInstance) {
        throw new Error("Chat not initialized");
    }
    return this.chatInstance.sendMessage({ message });
  }
}
