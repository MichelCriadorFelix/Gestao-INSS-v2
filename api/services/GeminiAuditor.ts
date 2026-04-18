import { GEMINI_AUDITOR_PROMPT } from './Prompts';

export class GeminiAuditor {
  static getPayload(message: string, history: any[], ragContext: string, currentDateContext: string) {
    let finalMessage = message;
    
    // Injeta RAG se existir
    if (ragContext) {
      finalMessage += `\n\n[INFORMAÇÃO DA BASE DE CONHECIMENTO (RAG)]\n${ragContext}`;
    }

    const systemPrompt = GEMINI_AUDITOR_PROMPT + currentDateContext;

    return { 
      systemPrompt, 
      finalMessage 
    };
  }
}
