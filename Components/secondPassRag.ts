// SEGUNDA RODADA DE RAG ("loop"): depois que o relatório sai, procura na base os itens que o PRÓPRIO modelo marcou como
// "[AUSENTE — SOLICITAR ADIÇÃO]", troca o rótulo quando acha e anexa o texto literal dos dispositivos recuperados.
//
// Por quê: a 1ª busca (planner + vetorial + título) nunca é perfeita e o relatório lista justamente o que o modelo
// considera essencial e não recebeu. Esses itens costumam existir na base (Súmula 47, Lei 14.331/2022, Tema 905...),
// então buscá-los de forma DIRIGIDA, por número/identificador exato, fecha a lacuna sem o advogado reenviar o comando.
//
// Segurança: não há geração por IA aqui — só correspondência exata de identificador (súmula/tema/lei/decreto/EC/IN) com
// títulos reais da base e transcrição literal do texto. Se o identificador não casa com título algum, o item continua
// "AUSENTE" (ex.: Estatuto da OAB, Resolução CJF), sem relabel por palavra solta.

export interface BaseTitle { title: string; areas?: string[] }

export interface SecondPassDeps {
  getTitles: () => Promise<BaseTitle[]>;
  /** Busca trechos por título; `query` ajuda a escolher artigos específicos (mesma função usada na busca de títulos). */
  fetchChunks: (titles: string[], perTitle: number, query?: string) => Promise<Array<{ content: string; metadata?: any }>>;
}

export interface SecondPassResult {
  text: string;
  recovered: Array<{ title: string; chunks: number }>;
  stillMissing: string[];
  changed: boolean;
  /** Trechos recuperados no formato do contexto RAG ("FONTE: título [Recuperação Exata]
texto"). */
  pieces: string[];
}

type RefKind = 'sumula' | 'tema' | 'lei' | 'lc' | 'decreto' | 'ec' | 'in' | 'resolucao';
interface ItemRef { kind: RefKind; num: string; court?: string; raw: string }

const MARKER_RE = /\[AUSENTE[^\]\n]*\]/g;

function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
const digits = (s: string) => s.replace(/\D/g, '');

/** Extrai os identificadores normativos citados num bloco de texto (já sem acentos/minúsculo). */
export function extractRefs(blockRaw: string): ItemRef[] {
  const t = norm(blockRaw.replace(/[*_`>#]/g, ' '));
  const refs: ItemRef[] = [];
  const push = (r: ItemRef) => { if (!refs.some(x => x.kind === r.kind && digits(x.num) === digits(r.num) && (x.court || '') === (r.court || ''))) refs.push(r); };
  const courtAfter = (idx: number, len: number): string | undefined => {
    const near = t.slice(idx + len, idx + len + 28);
    const m = near.match(/\b(tnu|stj|stf|tst|tjrj|trf\d?|tcu)\b/);
    return m ? m[1] : undefined;
  };

  for (const m of t.matchAll(/sumulas?\s*(?:vinculante\s*)?(?:n[ºo°.]*\s*)?(\d{1,4})(?:\s*(?:,|e)\s*(\d{1,4}))*/g)) {
    const court = courtAfter(m.index!, m[0].length);
    // lista "Súmulas 47, 80 e 88" → todos os números
    for (const n of m[0].match(/\d{1,4}/g) || []) push({ kind: 'sumula', num: n, court, raw: m[0] });
  }
  for (const m of t.matchAll(/temas?\s*(?:n[ºo°.]*\s*)?(\d{1,4}(?:\.\d{3})?)/g)) {
    push({ kind: 'tema', num: m[1], court: courtAfter(m.index!, m[0].length), raw: m[0] });
  }
  for (const m of t.matchAll(/\blei\s+complementar\s*(?:n[ºo°.]*\s*)?(\d{1,3}(?:\.\d{3})?)/g)) push({ kind: 'lc', num: m[1], raw: m[0] });
  for (const m of t.matchAll(/\blei\s*(?!complementar)(?:federal\s*)?(?:n[ºo°.]*\s*)?(\d{1,2}\.?\d{3})/g)) push({ kind: 'lei', num: m[1], raw: m[0] });
  for (const m of t.matchAll(/\bdecreto(?:-lei)?\s*(?:n[ºo°.]*\s*)?(\d{1,2}\.?\d{3})/g)) push({ kind: 'decreto', num: m[1], raw: m[0] });
  for (const m of t.matchAll(/(?:emenda constitucional|\bec\b)\s*(?:n[ºo°.]*\s*)?(\d{1,3})\b/g)) push({ kind: 'ec', num: m[1], raw: m[0] });
  for (const m of t.matchAll(/instrucao normativa[^0-9]{0,24}?(\d{1,4})\b/g)) push({ kind: 'in', num: m[1], raw: m[0] });
  for (const m of t.matchAll(/resolucao[^0-9]{0,18}?(\d{1,4})\b/g)) push({ kind: 'resolucao', num: m[1], raw: m[0] });
  return refs;
}

/** Título real da base que corresponde EXATAMENTE ao identificador (ou null). */
export function resolveRefToTitle(ref: ItemRef, titles: BaseTitle[]): string | null {
  const n = ref.num;
  const dotted = n.replace(/\./g, '').split('').join('\\.?'); // 14331 → 1\.?4\.?3\.?3\.?1 (aceita pontuação opcional)
  for (const { title } of titles) {
    const t = norm(title);
    switch (ref.kind) {
      case 'sumula': {
        if (!new RegExp(`(^|\\s)sumula\\s*(?:vinculante\\s*)?${digits(n)}(?!\\d)`).test(t)) break;
        if (ref.court && !t.includes(ref.court)) break;
        return title;
      }
      case 'tema': {
        const m = t.match(/tema\s*(\d{1,4}(?:\.\d{3})?)/);
        if (!m || digits(m[1]) !== digits(n)) break;
        if (ref.court && !t.includes(ref.court)) break;
        return title;
      }
      case 'lei':
        if (new RegExp(`(?:^|[^a-z])lei\\s*(?!complementar)(?:n[ºo°.]*\\s*)?${dotted}(?!\\d)`).test(t)) return title;
        break;
      case 'lc':
        if (new RegExp(`lei complementar\\s*(?:n[ºo°.]*\\s*)?${dotted}(?!\\d)`).test(t)) return title;
        break;
      case 'decreto':
        if (new RegExp(`decreto(?:-lei)?\\s*(?:n[ºo°.]*\\s*)?${dotted}(?!\\d)`).test(t)) return title;
        break;
      case 'ec':
        if (new RegExp(`(?:\\bec\\b|emenda constitucional)\\s*(?:n[ºo°.]*\\s*)?0*${digits(n)}(?!\\d)`).test(t)) return title;
        break;
      case 'in':
        if (new RegExp(`instrucao normativa[^0-9]{0,24}?0*${digits(n)}(?!\\d)`).test(t)) return title;
        break;
      case 'resolucao':
        if (new RegExp(`resolucao[^0-9]{0,18}?0*${digits(n)}(?!\\d)`).test(t)) return title;
        break;
    }
  }
  return null;
}

interface Found { start: number; end: number; marker: string; block: string }

/** Localiza cada marcador [AUSENTE ...] e o bloco de texto (item + justificativa) que o antecede. */
export function findAbsentMarkers(report: string): Found[] {
  const out: Found[] = [];
  let prevEnd = 0;
  for (const m of report.matchAll(MARKER_RE)) {
    const end = m.index! + m[0].length;
    // Bloco = SÓ o item deste marcador: começa depois do marcador anterior, do último parágrafo em branco e do último
    // "FONTE:" (itens vêm colados, um por linha — antes o bloco engolia os itens vizinhos e a Resolução CJF, que não existe na
    // base, saía rotulada "parcialmente disponível" por causa do Tema 905 do item ao lado). Teto de ~900 chars.
    const lookbackStart = Math.max(0, m.index! - 900, prevEnd);
    const lookback = report.slice(lookbackStart, m.index!);
    const lastBlank = lookback.lastIndexOf('\n\n');
    const lastFonte = lookback.lastIndexOf('FONTE:');
    const lastLineBreak = lookback.lastIndexOf('\n');
    // Item numa linha só (início da linha) ou em várias linhas até o parágrafo em branco: usa a fronteira mais próxima.
    let startRel = Math.max(lastBlank >= 0 ? lastBlank + 2 : 0, lastFonte >= 0 ? lastFonte : 0);
    if (startRel === 0 && lastLineBreak >= 0 && /\S/.test(lookback.slice(lastLineBreak + 1))) startRel = lastLineBreak + 1;
    const block = lookback.slice(startRel) + ' ' + m[0];
    out.push({ start: m.index!, end, marker: m[0], block });
    prevEnd = end;
  }
  return out;
}

const SEP = '\n\n---\n\n';

const KIND_LABEL: Record<RefKind, string> = { sumula: 'Súmula', tema: 'Tema', lei: 'Lei', lc: 'Lei Complementar', decreto: 'Decreto', ec: 'EC', in: 'Instrução Normativa', resolucao: 'Resolução' };
const refLabel = (r: ItemRef) => `${KIND_LABEL[r.kind]} ${r.num}${r.court ? ' ' + r.court.toUpperCase() : ''}`;
/** Nome curto para o rótulo: "Honorários Periciais… (Lei nº 14.331/2022)" → "Lei nº 14.331/2022"; súmulas/temas: parte antes do 1º " — ". */
const shortName = (title: string) => {
  const paren = title.match(/\(([^)]+)\)\s*$/);
  if (paren) return paren[1].slice(0, 70);
  return title.split(/\s[—-]\s/)[0].slice(0, 70);
};

/**
 * Roda a segunda rodada. `areas` restringe os títulos candidatos às áreas da persona (quando houver metadado de área).
 */
export async function runSecondPassRag(report: string, areas: string[] | undefined, deps: SecondPassDeps): Promise<SecondPassResult> {
  const markers = findAbsentMarkers(report);
  if (markers.length === 0) return { text: report, recovered: [], stillMissing: [], changed: false, pieces: [] };

  const allTitles = await deps.getTitles();
  const titles = (areas && areas.length > 0)
    ? allTitles.filter(t => !t.areas || t.areas.length === 0 || t.areas.some(a => areas.includes(a)))
    : allTitles;

  const recoveredByTitle = new Map<string, Array<{ content: string }>>();
  const replacements: Array<{ start: number; end: number; label: string }> = [];
  const stillMissing: string[] = [];

  for (const f of markers) {
    const refs = extractRefs(f.block);
    if (refs.length === 0) { stillMissing.push(f.block.replace(/\s+/g, ' ').slice(0, 120)); continue; }

    const resolved: Array<{ ref: ItemRef; title: string }> = [];
    const unresolved: ItemRef[] = [];
    for (const ref of refs) {
      const title = resolveRefToTitle(ref, titles);
      if (title) resolved.push({ ref, title }); else unresolved.push(ref);
    }
    if (resolved.length === 0) { stillMissing.push(f.block.replace(/\s+/g, ' ').slice(0, 120)); continue; }

    // Busca os trechos de cada título resolvido (uma vez por título).
    for (const { title } of resolved) {
      if (recoveredByTitle.has(title)) continue;
      try {
        const chunks = await deps.fetchChunks([title], 8, f.block);
        const usable = (chunks || []).filter(c => c && typeof c.content === 'string' && c.content.trim().length > 0);
        if (usable.length > 0) recoveredByTitle.set(title, usable.map(c => ({ content: c.content })));
      } catch { /* título não recuperado: o item continua marcado */ }
    }
    const okTitles = resolved.filter(r => recoveredByTitle.has(r.title));
    if (okTitles.length === 0) { stillMissing.push(f.block.replace(/\s+/g, ' ').slice(0, 120)); continue; }

    const names = Array.from(new Set(okTitles.map(r => shortName(r.title))));
    if (unresolved.length === 0 && okTitles.length === resolved.length) {
      replacements.push({ start: f.start, end: f.end, label: `[DISPONÍVEL NA BASE — recuperado na 2ª busca: ${names.join('; ')}]` });
    } else {
      const falta = unresolved.map(refLabel).join('; ') || 'parte do item';
      replacements.push({ start: f.start, end: f.end, label: `[PARCIALMENTE DISPONÍVEL — recuperado na 2ª busca: ${names.join('; ')} | continua ausente na base: ${falta}]` });
    }
  }

  if (recoveredByTitle.size === 0) return { text: report, recovered: [], stillMissing, changed: false, pieces: [] };

  // Aplica de trás para frente para não invalidar os índices.
  let text = report;
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, r.start) + r.label + text.slice(r.end);
  }

  // Adendo com o texto LITERAL dos dispositivos recuperados.
  const lines: string[] = [];
  lines.push('');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## ADENDO AUTOMÁTICO — DISPOSITIVOS RECUPERADOS NA 2ª BUSCA');
  lines.push('_Itens marcados como ausentes na 1ª busca que constam da Base de Conhecimento. O texto abaixo é a transcrição literal da base (sem redação gerada por IA)._');
  lines.push('');
  for (const [title, chunks] of recoveredByTitle) {
    lines.push(`**FONTE: ${title}**`);
    lines.push('');
    for (const c of chunks.slice(0, 6)) {
      const body = c.content.trim().slice(0, 1800) + (c.content.trim().length > 1800 ? ' […]' : '');
      lines.push(body.split('\n').map(l => `> ${l}`).join('\n'));
      lines.push('');
    }
  }
  text = text.trimEnd() + lines.join('\n');

  const pieces: string[] = [];
  for (const [title, chunks] of recoveredByTitle) {
    for (const c of chunks.slice(0, 6)) pieces.push(`FONTE: ${title} [Recuperação Exata]
${c.content.trim()}`);
  }

  return {
    text,
    recovered: Array.from(recoveredByTitle.entries()).map(([title, chunks]) => ({ title, chunks: chunks.length })),
    stillMissing,
    changed: true,
    pieces,
  };
}

export { SEP as SECOND_PASS_SEP };
