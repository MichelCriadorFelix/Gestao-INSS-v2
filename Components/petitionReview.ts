// REVISÃO AUTOMÁTICA DA PEÇA (18/11/2026)
//
// Por quê: ao conferir a peça da Denize (18/11/2026) contra o dossiê e o Planalto, os desvios eram de redação do modelo
// (ex.: atribuir ao art. 60 §§8-9 da Lei 8.213 o que é do art. 78 do Decreto 3.048; pedir INPC/poupança para atrasados de
// 2026). O chat do claude.ai tem uma etapa "revisar a peça" antes de entregar; aqui ela roda DEPOIS que a peça aparece, em
// segundo plano, e entrega uma lista curta de alertas — nunca reescreve a peça sozinha.
//
// Duas camadas:
//  1. checagens DETERMINÍSTICAS (este arquivo, instantâneas e sem custo): conta do valor da causa, rol de documentos,
//     data da assinatura, marcas internas do sistema, índice de correção desatualizado, Resolução CJF, lacunas;
//  2. revisor de IA (POST /api/peca/review): confere citações com a Base Legal recuperada e fatos com o dossiê.

export type ReviewSeverity = 'alta' | 'media' | 'baixa';
export type ReviewKind = 'citacao' | 'fato' | 'calculo' | 'regra' | 'estrategia' | 'forma';

export interface ReviewAlert {
  severidade: ReviewSeverity;
  tipo: ReviewKind;
  trecho?: string;
  problema: string;
  sugestao?: string;
  fonte?: string;
  origem: 'automatica' | 'ia';
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Só peças iniciais/petições já concluídas (com endereçamento a um juízo e fecho) entram na revisão. */
export function shouldReviewPetition(text: string): boolean {
  if (!text || text.length < 8000) return false;
  if (!/AO\s+JU[ÍI]ZO|EXCELENT[ÍI]SSIM/i.test(text.slice(0, 1500))) return false;
  return /pede\s+(?:e\s+espera\s+)?deferimento/i.test(text);
}

const brl = (s: string): number => Number(s.replace(/\./g, '').replace(',', '.'));
const fmtBRL = (n: number): string => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const clip = (s: string, n = 140): string => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s).replace(/\s+/g, ' ');

/** Confere as contas do tópico "DO VALOR DA CAUSA": cada "N × R$ X = R$ Y" e o "Total" como soma das parcelas. */
function checkValorDaCausa(text: string, out: ReviewAlert[]) {
  const i = text.search(/DO\s+VALOR\s+DA\s+CAUSA/i);
  if (i < 0) return;
  const sec = text.slice(i, i + 4000);
  const contas = [...sec.matchAll(/(\d{1,3})\s*[×x*]\s*R\$\s*([\d.]+,\d{2})\s*=\s*R\$\s*([\d.]+,\d{2})/g)];
  const resultados: number[] = [];
  for (const m of contas) {
    const esperado = Number(m[1]) * brl(m[2]);
    const dito = brl(m[3]);
    resultados.push(dito);
    if (Math.abs(esperado - dito) > 0.011) {
      out.push({
        severidade: 'alta', tipo: 'calculo', origem: 'automatica',
        trecho: clip(m[0]),
        problema: `A conta não fecha: ${m[1]} × ${fmtBRL(brl(m[2]))} = ${fmtBRL(esperado)}, e a peça diz ${fmtBRL(dito)}.`,
        sugestao: `Corrigir para ${fmtBRL(esperado)} e refazer o total.`,
      });
    }
  }
  const totalM = sec.match(/\bTotal[^\n:]{0,40}:\s*\**\s*R\$\s*([\d.]+,\d{2})/i);
  if (totalM && resultados.length >= 2) {
    const soma = resultados.reduce((a, b) => a + b, 0);
    const total = brl(totalM[1]);
    if (Math.abs(soma - total) > 0.011) {
      out.push({
        severidade: 'alta', tipo: 'calculo', origem: 'automatica',
        trecho: clip(totalM[0]),
        problema: `O total do valor da causa (${fmtBRL(total)}) não é a soma das parcelas listadas (${fmtBRL(soma)}).`,
        sugestao: `Conferir as parcelas e ajustar o total para ${fmtBRL(soma)} (ou explicar a diferença).`,
      });
    }
  }
}

/** Data da assinatura × data de hoje (a peça costuma sair pronta para protocolar no mesmo dia). */
function checkData(text: string, hoje: Date, out: ReviewAlert[]) {
  const cauda = text.slice(-2500);
  const re = new RegExp(`(\\d{1,2})\\s+de\\s+(${MESES.join('|')})\\s+de\\s+(\\d{4})`, 'gi');
  let ultima: RegExpExecArray | null = null, m: RegExpExecArray | null;
  while ((m = re.exec(cauda))) ultima = m;
  if (!ultima) {
    out.push({ severidade: 'media', tipo: 'forma', origem: 'automatica', problema: 'Não encontrei a data da assinatura no final da peça.', sugestao: 'Incluir local e data antes das assinaturas.' });
    return;
  }
  const d = Number(ultima[1]), mes = MESES.indexOf(ultima[2].toLowerCase()), a = Number(ultima[3]);
  if (d !== hoje.getDate() || mes !== hoje.getMonth() || a !== hoje.getFullYear()) {
    out.push({
      severidade: 'baixa', tipo: 'forma', origem: 'automatica',
      trecho: clip(ultima[0]),
      problema: `A peça está datada de ${ultima[0]}, mas hoje é ${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}.`,
      sugestao: 'Atualizar a data (e as datas-limite do valor da causa) para o dia do protocolo.',
    });
  }
}

/** Marcas internas do sistema que nunca podem ir para o juízo. */
function checkMarcas(text: string, out: ReviewAlert[]) {
  const marcas = text.match(/\(RAG\)|\[RAG\]|Base de Conhecimento|\[DISPONÍVEL NA BASE|\[AUSENTE|\[Título Exato\]|Score:\s*\d+\s*%/gi);
  if (marcas && marcas.length) {
    out.push({
      severidade: 'alta', tipo: 'forma', origem: 'automatica',
      trecho: clip([...new Set(marcas)].join(' | ')),
      problema: 'A peça contém marcas internas do sistema (RAG/Base de Conhecimento/AUSENTE).',
      sugestao: 'Remover essas marcas antes de protocolar.',
    });
  }
  // (sem "XXX" solto: é inciso romano legítimo, ex.: art. 7º, XXX)
  const lacunas = text.match(/\[(?:[A-ZÀ-Ú][A-ZÀ-Ú\s/-]{5,})\]|\?{3,}|R\$\s*[Xx]{2,}|\b[Xx]{2}\/[Xx]{2}\/[Xx]{2,4}\b/g);
  if (lacunas && lacunas.length) {
    out.push({
      severidade: 'alta', tipo: 'forma', origem: 'automatica',
      trecho: clip([...new Set(lacunas)].join(' | ')),
      problema: 'A peça tem lacuna/placeholder não preenchido.',
      sugestao: 'Preencher com o dado real dos autos ou retirar o trecho.',
    });
  }
}

/** Regras fechadas do escritório (decididas pelo Michel) e índice de correção desatualizado. */
function checkRegras(text: string, out: ReviewAlert[]) {
  if (/INPC/.test(text) && /poupan[çc]a/i.test(text)) {
    out.push({
      severidade: 'media', tipo: 'regra', origem: 'automatica',
      problema: 'A peça pede correção pelo INPC e juros da poupança (Tema 905/STJ), regime que só vale até 08/12/2021.',
      sugestao: 'Pedir "correção monetária e juros segundo os critérios legais vigentes em cada período (art. 3º da EC 113/2021, quando aplicável, e Manual de Cálculos da Justiça Federal)".',
      fonte: 'Regra do redator (18/11/2026)',
    });
  }
  const cjf = text.match(/Resolução\s+CJF[^.;\n]{0,30}/i);
  if (cjf) {
    out.push({
      severidade: 'media', tipo: 'regra', origem: 'automatica',
      trecho: clip(cjf[0]),
      problema: 'O Juízo 100% Digital deve ser fundamentado na Resolução CNJ nº 345/2020 (decisão do escritório em 18/11/2026), não na "Resolução CJF nº 10/2020".',
      sugestao: 'Trocar a citação pela Resolução CNJ nº 345/2020.',
      fonte: 'Memória da IA / decisão do advogado',
    });
  }
}

/** Todo "Doc. N" citado no corpo precisa existir no rol de documentos. */
function checkDocs(text: string, out: ReviewAlert[]) {
  const idxRol = text.search(/(?:^|\n)\s*(?:#+\s*)?(?:[IVX]+\.\s*)?(?:DO\s+)?ROL\s+DE\s+DOCUMENTOS/i);
  if (idxRol < 0) {
    out.push({ severidade: 'media', tipo: 'forma', origem: 'automatica', problema: 'Não encontrei o "Rol de Documentos" no final da peça.', sugestao: 'Incluir o rol numerado dos documentos que instruem a inicial.' });
    return;
  }
  const rol = text.slice(idxRol);
  const corpo = text.slice(0, idxRol);
  const noRol = new Set([...rol.matchAll(/Doc\.?\s*(\d{1,3})\s*[-—–:.]/gi)].map(m => Number(m[1])));
  if (noRol.size < 3) return;
  const citados = new Set<number>();
  for (const m of corpo.matchAll(/Docs?\.\s*((?:\d{1,3}(?:\s*(?:,|e|a|\/|–|-)\s*)?)+)/gi)) {
    for (const n of m[1].match(/\d{1,3}/g) || []) citados.add(Number(n));
  }
  const faltando = [...citados].filter(n => !noRol.has(n)).sort((a, b) => a - b);
  if (faltando.length) {
    out.push({
      severidade: 'media', tipo: 'forma', origem: 'automatica',
      trecho: `Doc. ${faltando.join(', Doc. ')}`,
      problema: `O corpo da peça cita documento(s) que não constam do rol: ${faltando.map(n => `Doc. ${n}`).join(', ')}.`,
      sugestao: 'Ajustar a numeração no texto ou incluir o documento no rol.',
    });
  }
}

export function deterministicPetitionChecks(text: string, opts: { hoje?: Date } = {}): ReviewAlert[] {
  const out: ReviewAlert[] = [];
  checkValorDaCausa(text, out);
  checkData(text, opts.hoje || new Date(), out);
  checkMarcas(text, out);
  checkRegras(text, out);
  checkDocs(text, out);
  return out;
}

/** Converte a resposta do revisor de IA (JSON) em alertas, descartando lixo. */
export function parseReviewAlerts(raw: any): ReviewAlert[] {
  const arr = Array.isArray(raw) ? raw : [];
  const sev = new Set(['alta', 'media', 'baixa']);
  const kinds = new Set(['citacao', 'fato', 'calculo', 'regra', 'estrategia', 'forma']);
  const out: ReviewAlert[] = [];
  for (const a of arr) {
    if (!a || typeof a !== 'object' || typeof a.problema !== 'string' || a.problema.trim().length < 8) continue;
    const s = String(a.severidade || '').toLowerCase().replace('média', 'media');
    const t = String(a.tipo || '').toLowerCase().replace('citação', 'citacao').replace('cálculo', 'calculo').replace('estratégia', 'estrategia');
    out.push({
      severidade: (sev.has(s) ? s : 'media') as ReviewSeverity,
      tipo: (kinds.has(t) ? t : 'fato') as ReviewKind,
      trecho: typeof a.trecho === 'string' ? clip(a.trecho, 200) : undefined,
      problema: clip(a.problema, 500),
      sugestao: typeof a.sugestao === 'string' && a.sugestao.trim() ? clip(a.sugestao, 400) : (typeof a.correcao_sugerida === 'string' ? clip(a.correcao_sugerida, 400) : undefined),
      fonte: typeof a.fonte === 'string' && a.fonte.trim() ? clip(a.fonte, 200) : undefined,
      origem: 'ia',
    });
    if (out.length >= 15) break;
  }
  return out;
}

/**
 * O advogado pede para APLICAR a revisão na peça ("aplique a atualização na peça", "aplique os itens 1 e 3 da revisão",
 * "corrija conforme os apontamentos"). Nesse caso o chat anexa o texto da última revisão ao pedido (ela não vai no histórico
 * do modelo) e trata o pedido como correção cirúrgica do artefato.
 */
export function wantsToApplyReview(message: string): boolean {
  if (!message || message.length > 600) return false;
  // "aplique" NÃO contém "aplic" (apli+qu+e): sem o (?:c|qu) a frase mais natural deixava de ser reconhecida.
  const verbo = '(?:apli(?:c|qu)\\w*|atualiz\\w+|corrij\\w+|corrig\\w+|ajust\\w+|incorpor\\w+|implement\\w+|execut\\w+|fa[çc]a)';
  const alvo = '(?:revis[ãa]o|alertas?|apontamentos?|atualiza[çc][ãa]o|atualiza[çc][õo]es|corre[çc][õo]es|sugest[õo]es|itens?\\s+\\d)';
  return new RegExp(`${verbo}[^.\\n]{0,60}${alvo}|${alvo}[^.\\n]{0,40}${verbo}`, 'i').test(message);
}

/**
 * As TRÊS formas de pedir (todas chegam ao mesmo envio de mensagem): (1) chat principal; (2) caixa "Instrução cirúrgica" do
 * painel do artefato; (3) trecho selecionado + "Editar com IA". As formas 2 e 3 embrulham o texto do advogado em
 * "[CORREÇÃO CIRÚRGICA NO ARTEFATO …] … INSTRUÇÃO DE ALTERAÇÃO:\n<texto>"; aqui extraímos o texto dele e dizemos se havia trecho selecionado.
 */
export function reviewApplyRequest(messageText: string): { apply: boolean; hasSelection: boolean } {
  const raw = messageText || '';
  const m = raw.match(/INSTRUÇÃO DE ALTERAÇÃO:\s*\n([\s\S]*)$/);
  const instruction = (m ? m[1] : raw).trim();
  return { apply: wantsToApplyReview(instruction), hasSelection: /TRECHO SELECIONADO A MODIFICAR/.test(raw) };
}

/** Junta as duas camadas sem repetir o mesmo problema: o alerta automático de regra some se o revisor de IA já apontou o mesmo ponto. */
export function mergeReviewAlerts(auto: ReviewAlert[], ia: ReviewAlert[]): ReviewAlert[] {
  const iaTxt = ia.map(a => `${a.trecho || ''} ${a.problema}`).join('\n');
  const kept = auto.filter(a => {
    if (a.tipo !== 'regra') return true;
    if (/INPC/.test(a.problema)) return !/905|INPC|poupan/i.test(iaTxt);
    if (/CNJ nº 345/.test(a.problema)) return !/CJF|345\/2020/.test(iaTxt);
    return true;
  });
  return [...kept, ...ia];
}

const SEV_ORDER: Record<ReviewSeverity, number> = { alta: 0, media: 1, baixa: 2 };
const SEV_ICON: Record<ReviewSeverity, string> = { alta: '🔴', media: '🟠', baixa: '🟡' };
const KIND_LABEL: Record<ReviewKind, string> = { citacao: 'Citação', fato: 'Fato', calculo: 'Cálculo', regra: 'Regra do escritório', estrategia: 'Estratégia', forma: 'Forma' };

/** Mensagem do chat com o resultado da revisão (Markdown curto; nunca contém a peça). */
export function formatReviewMessage(alerts: ReviewAlert[], meta: { ia: 'ok' | 'falhou' | 'indisponivel'; segundos?: number } = { ia: 'ok' }): string {
  const lines: string[] = ['### 🔎 Revisão automática da peça', ''];
  const sorted = [...alerts].sort((a, b) => SEV_ORDER[a.severidade] - SEV_ORDER[b.severidade]);
  if (meta.ia === 'falhou') lines.push('⚠️ O revisor de IA não respondeu; abaixo só as checagens automáticas (contas, rol de documentos, data, regras do escritório). Confira as citações e os fatos na leitura final.', '');
  if (sorted.length === 0) {
    lines.push(meta.ia === 'ok'
      ? '✅ **Nenhum alerta.** Conferi citações com a Base Legal recuperada, fatos com o dossiê, a conta do valor da causa, o rol de documentos e as regras do escritório.'
      : '✅ Nenhum alerta nas checagens automáticas.');
  } else {
    const altas = sorted.filter(a => a.severidade === 'alta').length;
    lines.push(`**${sorted.length} ponto(s) para conferir${altas ? ` (${altas} grave${altas > 1 ? 's' : ''})` : ''}** antes de protocolar:`, '');
    sorted.forEach((a, i) => {
      lines.push(`${i + 1}. ${SEV_ICON[a.severidade]} **${KIND_LABEL[a.tipo]}** — ${a.problema}`);
      if (a.trecho) lines.push(`   - Trecho: “${a.trecho}”`);
      if (a.sugestao) lines.push(`   - Sugestão: ${a.sugestao}`);
      if (a.fonte) lines.push(`   - Conferido em: ${a.fonte}`);
    });
  }
  lines.push('', '_A revisão não altera a peça e não substitui a sua leitura. Para aplicar um ajuste, use “Correção Cirúrgica” citando o item._');
  return lines.join('\n');
}
