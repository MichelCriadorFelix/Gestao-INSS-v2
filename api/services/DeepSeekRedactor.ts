import { DEEPSEEK_REDACTOR_PROMPT } from './Prompts';

export class DeepSeekRedactor {
  static getPayload(message: string, history: any[], ragContext: string, currentDateContext: string) {
    let finalMessage = message;
    
    if (ragContext) {
      finalMessage += `\n\n[INFORMAÇÃO DA BASE DE CONHECIMENTO (RAG)]\n${ragContext}`;
    }

    const systemPrompt = DEEPSEEK_REDACTOR_PROMPT + currentDateContext;

    return { 
      systemPrompt, 
      finalMessage 
    };
  }
}
