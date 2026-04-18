import { QWEN_REDACTOR_PROMPT } from './Prompts';

export class QwenRedactor {
  static getPayload(message: string, history: any[], ragContext: string, currentDateContext: string) {
    let finalMessage = message;
    
    if (ragContext) {
      finalMessage += `\n\n[INFORMAÇÃO DA BASE DE CONHECIMENTO (RAG)]\n${ragContext}`;
    }

    const systemPrompt = QWEN_REDACTOR_PROMPT + currentDateContext;

    return { 
      systemPrompt, 
      finalMessage 
    };
  }
}
