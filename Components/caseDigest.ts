// Resumo do caso (para o RAG) e identificação automática do tipo de caso.
//
// PROBLEMA (teste real no app, 17/11/2026): em "gerar relatório" a busca do RAG usava só o texto da conversa
// ("gerar relatório Tomada de ciência: ..."), e o planner recebeu 859 caracteres sem nenhum dado do caso — ele
// não sabia que se tratava de auxílio por incapacidade com pedido de conversão em aposentadoria, então a busca
// vetorial/título/keyword e a escolha dos fundamentos trabalhavam às cegas. Os documentos (OCR) só iam para o
// modelo de redação, depois do RAG. Aqui extraímos um RESUMO curto e denso do caso a partir dos próprios
// documentos para alimentar a consulta de embedding e o planner.

import { CORE_DISPOSITIVOS_CASE_TYPES } from './coreDispositivosConfig';

export interface DigestDocument {
  name?: string;
  summary?: string;
  fullText?: string;
}

// Linhas com termos que caracterizam o objeto da ação (benefício, requisito, prova, fato gerador).
const CASE_KEY_RE = /(benef[íi]cio|\bNB\b|esp[ée]cie|\bCID\b|incapacidade|incapaz|aux[ií]lio|\bBPC\b|\bLOAS\b|aposentadoria|pens[ãa]o por morte|per[ií]cia|laudo|\bDER\b|\bDCB\b|\bDIB\b|alta m[ée]dica|cessa[çc][ãa]o|indeferi|car[êe]ncia|qualidade de segurado|atividade especial|\bPPP\b|\bLTCAT\b|rural|deficien|transtorno|doen[çc]a|acidente|sal[áa]rio-maternidade|gestante|nascimento|[óo]bito|dependente|tempo de contribui[çc][ãa]o|agente nocivo|ru[íi]do|revis[ãa]o|prorroga[çc][ãa]o|restabelecimento|convers[ãa]o|objeto|requerimento)/gi;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Extrai um resumo curto (≈2,4k chars) com as linhas mais "jurídicas" dos documentos: primeiro o mapeamento
 * de auditoria (summary), se existir; depois as linhas do texto integral com mais termos-chave.
 */
export function buildCaseDigest(docs: DigestDocument[] | undefined | null, maxChars = 2400): string {
  if (!docs || docs.length === 0) return '';

  const candidates: { text: string; score: number; pos: number }[] = [];
  const seen = new Set<string>();
  let pos = 0;

  const consider = (raw: string, bonus = 0) => {
    const t = raw.replace(/\s+/g, ' ').trim();
    if (t.length < 25 || t.length > 420) return;
    const key = t.toLowerCase().slice(0, 90);
    if (seen.has(key)) return;
    const matches = t.match(CASE_KEY_RE);
    if (!matches) return;
    seen.add(key);
    candidates.push({ text: t, score: new Set(matches.map(m => m.toLowerCase())).size + bonus, pos: pos++ });
  };

  for (const d of docs) {
    const summary = (d.summary || '').trim();
    const full = (d.fullText || '').slice(0, 150000);
    // A auditoria/resumo já é curada: bônus. O texto integral entra por pontuação de termos-chave.
    for (const line of summary.split(/\n+|(?<=[.;:])\s+/)) consider(line, 2);
    for (const line of full.split(/\n+|(?<=[.;])\s+/)) consider(line, 0);
  }

  const best = [...candidates].sort((a, b) => b.score - a.score || a.pos - b.pos);
  const picked: typeof candidates = [];
  let total = 0;
  for (const c of best) {
    if (total + c.text.length + 3 > maxChars) continue;
    picked.push(c);
    total += c.text.length + 3;
    if (total >= maxChars - 40) break;
  }
  return picked.sort((a, b) => a.pos - b.pos).map(c => c.text).join(' | ');
}

// Regras de identificação por tipo (chaves de CORE_DISPOSITIVOS_CASE_TYPES). Cada regra pontua termos distintos.
const CASE_TYPE_RULES: Record<string, RegExp[]> = {
  auxilio_doenca: [
    /aux[ií]lio por incapacidade tempor[áa]ria/, /aux[ií]lio[- ]doen[çc]a/, /incapacidade tempor[áa]ria/,
    /esp[ée]cie 31\b/, /restabelecimento d[eo] aux[ií]lio/, /alta m[ée]dica/, /\bDCB\b/, /prorroga[çc][ãa]o/,
  ],
  aposentadoria_invalidez: [
    /aposentadoria por incapacidade permanente/, /aposentadoria por invalidez/, /esp[ée]cie 32\b/,
    /convers[ãa]o em aposentadoria/, /incapacidade permanente/, /incapacidade definitiva/,
  ],
  bpc_deficiencia: [
    /\bBPC\b/, /\bLOAS\b/, /benef[íi]cio assistencial/, /impedimento de longo prazo/, /pessoa com defici[êe]ncia/, /esp[ée]cie 87\b/,
  ],
  bpc_idoso: [/\bBPC\b.*\bidoso/, /\bidoso\b.*\bBPC\b/, /\bLOAS\b.*65 anos/, /esp[ée]cie 88\b/],
  aposentadoria_idade: [/aposentadoria por idade/, /aposentadoria h[íi]brida/, /idade m[íi]nima/, /car[êe]ncia de 180/, /esp[ée]cie 41\b/],
  aposentadoria_tempo_contribuicao: [
    /aposentadoria por tempo de contribui[çc][ãa]o/, /regra de transi[çc][ãa]o/, /ped[áa]gio/, /\bpontos\b.*aposentadoria/, /esp[ée]cie 42\b/,
  ],
  aposentadoria_especial: [/aposentadoria especial/, /atividade especial/, /\bPPP\b/, /\bLTCAT\b/, /agente nocivo/, /insalubr/, /esp[ée]cie 46\b/],
  pensao_morte: [/pens[ãa]o por morte/, /instituidor/, /\b[óo]bito\b/, /dependente/, /esp[ée]cie 21\b/],
  salario_maternidade: [/sal[áa]rio[- ]maternidade/, /gestante/, /\bparto\b/, /esp[ée]cie 80\b/],
};

/**
 * Identifica o(s) tipo(s) de caso INSS pelo texto (mensagem + resumo + início dos documentos).
 * Conservador: exige ao menos 2 sinais distintos e devolve só os tipos próximos do melhor (≥60% dele);
 * um caso "restabelecimento de auxílio + conversão em aposentadoria por incapacidade" devolve os dois.
 */
export function detectCaseTypes(text: string): { types: string[]; scores: Record<string, number> } {
  const t = stripAccents(text || '').toLowerCase();
  const scores: Record<string, number> = {};
  for (const [key, rules] of Object.entries(CASE_TYPE_RULES)) {
    let s = 0;
    for (const r of rules) {
      // As regras são escritas com acento; testa nas duas formas (original e sem acento).
      if (r.test((text || '').toLowerCase()) || r.test(t)) s++;
    }
    scores[key] = s;
  }
  // BPC idoso só vale se também houver BPC (evita sobrepor ao BPC deficiência por palavra solta).
  const valid = new Set(CORE_DISPOSITIVOS_CASE_TYPES.map(c => c.key));
  const entries = Object.entries(scores).filter(([k, v]) => valid.has(k) && v >= 2);
  if (entries.length === 0) return { types: [], scores };
  const top = Math.max(...entries.map(([, v]) => v));
  const types = entries.filter(([, v]) => v >= Math.ceil(top * 0.6)).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3);
  return { types, scores };
}
