// Funções utilitárias puras extraídas de api/index.ts (Fase 3 — fatia 1).
// Sem estado de módulo, sem efeito colateral: dependem apenas dos argumentos.

export function parsePetitionTarget(petitionLength?: string): number | null {
  if (!petitionLength || petitionLength === 'Padrão (Livre)') return null;
  const match = petitionLength.match(/(\d{4,5})/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Conta palavras de um texto markdown, ignorando markup.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const clean = text
    .replace(/^>.*$/gm, '')                  // remove blockquotes (citações)
    .replace(/[#*_`\[\](){}|>-]/g, ' ')       // remove caracteres de markdown
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.split(/\s+/).length : 0;
}

/**
 * Decide se o pedido do usuário é correção pontual, adição ou regeneração total.
 * Crítico para evitar a degradação da 2ª petição.
 */
export type RevisionIntent = 'POINT_CORRECTION' | 'ADDITION' | 'FULL_REGENERATION' | 'NEW_GENERATION' | 'NO_ACTION';

/**
 * FIX RESIDUAL #1: fallback alterado de POINT_CORRECTION para NO_ACTION.
 * Antes: qualquer mensagem com draft mas sem keyword de correção caia em POINT_CORRECTION,
 * injetando 40k chars de draft no prompt desnecessariamente (ex: pergunta sobre o caso).
 * Agora: apenas mensagens com keyword explícita de correção/adição/regen injetam o draft.
 * Sem keyword → NO_ACTION: modelo responde normalmente sem o draft no prompt.
 */
export function detectRevisionIntent(message: string, hasDraft: boolean): RevisionIntent {
  if (!hasDraft) return 'NEW_GENERATION';
  const msg = message.toLowerCase();

  if (msg.includes("[correção cirúrgica]") || msg.includes("[correcao cirurgica]") || msg.includes("[geração modular]") || msg.includes("[geracao modular]")) {
    return 'POINT_CORRECTION';
  }

  const isFullRegen = /(refaz|refaça|refaca|gera (de )?novo|reescrev|nova vers[ãa]o|fazer (a |outra )?(pe[çc]a|peti[çc][ãa]o)|gerar (a |outra |nova )?(pe[çc]a|peti[çc][ãa]o))/i.test(msg);
  const isAddition = /(acrescenta|adiciona|inclui|insere|complementa|incluir|adicionar)/i.test(msg);
  const isPointCorrection = /(corrig|ajust|substitui|troca|mud[ae] (o |a |no |na )?t[óo]pico|altera (o |a |no |na ))/i.test(msg);
  if (isFullRegen) return 'FULL_REGENERATION';
  if (isPointCorrection) return 'POINT_CORRECTION';
  if (isAddition) return 'ADDITION';
  // FIX RESIDUAL #1: sem keyword explícita → não injetar draft
  return 'NO_ACTION';
}

/**
 * Detecta repetição entre o trecho atual e o anterior (anti-eco do Gemini).
 * Retorna true se 200+ caracteres consecutivos do novo já apareceram no antigo.
 */
export function hasEchoRepetition(newChunk: string, previousText: string): boolean {
  if (newChunk.length < 200 || previousText.length < 200) return false;
  const sample = newChunk.substring(50, 250); // 200 chars no meio do novo chunk
  return previousText.includes(sample);
}

/**
 * Estima quantidade de tokens de um texto em português (1 token ≈ 3.5 chars).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

/**
 * Comprime contexto pesado (documentContext, customLaws, ragContext) para caber no orçamento de input.
 * Estratégia: prioriza início + final, corta o miolo se for muito grande.
 */
export function smartTruncate(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  const headSize = Math.floor(maxChars * 0.55);
  const tailSize = Math.floor(maxChars * 0.40);
  return text.substring(0, headSize)
    + `\n\n[... ${text.length - headSize - tailSize} caracteres omitidos automaticamente para caber no orçamento de tokens ...]\n\n`
    + text.substring(text.length - tailSize);
}

/**
 * Limites de input por provedor de IA. Garante margem para output.
 * Gemini Flash: 1M tokens contexto, mas com input gigante o output reduz.
 * DeepSeek/Qwen via OpenRouter: 163k tokens total — usar 120k como limite seguro.
 */
export function getInputBudget(modelProvider?: string, _model?: string): number {
  if (modelProvider === 'openrouter') {
    // DeepSeek V3.2 e similares têm contexto de 163k. Deixar 30k para output + system + history.
    return 120_000; // tokens
  }
  // Gemini Flash: input ideal abaixo de 100k tokens para preservar qualidade do output
  return 100_000;
}

/**
 * Detecta se a peça já está completa (tem encerramento jurídico).
 * Se TRUE, não deve continuar mesmo abaixo do alvo de palavras —
 * caso contrário a IA recomeça a petição do zero.
 */
export function isPetitionComplete(text: string): boolean {
  if (!text || text.length < 1500) return false;
  const tail = text.slice(-2500).toLowerCase();
  const hasPedeDeferimento = /pede\s+(e\s+espera\s+)?deferimento/i.test(tail);
  const hasOABorAssinatura = /oab\s*\/?\s*[a-z]{2}\s*\d{3,6}/i.test(tail) || /assinatura/i.test(tail);
  const hasDataLocal = /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}/i.test(tail);
  // Se tem "pede e espera deferimento" + (OAB OU data), a peça encerrou
  return hasPedeDeferimento && (hasOABorAssinatura || hasDataLocal);
}
