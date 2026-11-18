// TESTE DE REGRESSÃO DO RAG — rodar com:  npm run test:rag
//
// Por quê: o mesmo tipo de bug já voltou mais de uma vez (ordem planner/cliente que regrediu em commit externo;
// em 17/11/2026 a Lei 14.331 e a Súmula 47 sumiam do relatório por corte do contexto). Estes testes são OFFLINE
// (sem rede, sem chaves) e falham com código de saída ≠ 0 se algum item essencial deixar de chegar ao modelo.
//
// Como funciona: o montador de contexto (fitRagContext), a normalização de modelos e o dono do relatório vivem em
// api/index.ts, que NÃO pode importar módulos locais (um import quebrado derrubaria todas as rotas da Vercel). Por
// isso o teste EXTRAI esses trechos do próprio arquivo pelos marcadores abaixo; se alguém renomear um marcador, o
// teste falha avisando — melhor falhar alto do que passar sem testar nada.
//
// Teste opcional contra produção (planner real): defina RAG_BASE_URL (ex.: https://gestao-de-logins-inss.vercel.app)
// e RAG_TOKEN (access_token da sessão do Supabase) — não é salvo nem impresso.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { buildCaseDigest, detectCaseTypes } from '../Components/caseDigest';
import { runSecondPassRag, extractRefs } from '../Components/secondPassRag';
import { buildCrmPayload } from '../Components/crmContext';
import { shouldReviewPetition, deterministicPetitionChecks, parseReviewAlerts, formatReviewMessage, mergeReviewAlerts, wantsToApplyReview, reviewApplyRequest, buildReviewBase } from '../Components/petitionReview';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'api', 'index.ts'), 'utf-8');

function between(startMarker: string, endMarker: string): string {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker);
  if (a < 0 || b < 0 || b <= a) throw new Error(`Marcador não encontrado em api/index.ts: "${startMarker}" … "${endMarker}". Atualize tests/ragRegression.test.ts.`);
  return src.slice(a, b);
}

async function loadFromIndex(code: string, exportsList: string[]): Promise<any> {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ragtest-')), 'extracted.ts');
  fs.writeFileSync(file, `${code}\nexport { ${exportsList.join(', ')} };\n`, 'utf-8');
  return import(pathToFileURL(file).href);
}

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${String(e?.message || e).split('\n').join('\n      ')}`); }
}

// ---------- fixtures ----------
const SEP = '\n\n---\n\n';
const chunk = (title: string, tag: string, i: number, size = 2200) =>
  `FONTE: ${title} [${tag}]\n` + (`Texto ${title} #${i} `).repeat(Math.ceil(size / 20)).slice(0, size);

const T = {
  s47: 'SÚMULA 47 TNU — PREVIDENCIÁRIO — Incapacidade parcial e condições pessoais',
  l14331: 'Honorários Periciais e Requisitos da Petição Inicial Previdenciária (Lei nº 14.331/2022)',
  t905: 'TEMA 905 STJ — PREVIDENCIÁRIO — Correção monetária IPCA-E e juros Selic',
  t1013: 'TEMA 1.013 STJ — PREVIDENCIÁRIO — Trabalho durante aguardo de benefício por incapacidade',
  l8213: 'Lei de Benefícios da Previdência Social (Lei nº 8.213/1991)',
  inquilinato: 'LEI No 8.245, DE 18 DE OUTUBRO DE 1991 - Lei do Inquilinato',
};

/** Cenário que reproduz o raio-X real de 17/11/2026 (406k chars de contexto bruto, orçamento ~184k). */
function realisticContext(): string {
  const core = [0, 1, 2, 3, 4].map(i => chunk(T.s47, 'Dispositivo núcleo pré-cadastrado para este tipo de caso', 900 + i, 1200));
  const client: string[] = [];
  for (let i = 0; i < 10; i++) client.push(chunk(T.l8213, `Score: ${60 - i}%`, 100 + i));
  for (let i = 0; i < 18; i++) client.push(chunk(T.inquilinato, 'Score: 28%', i));
  for (let i = 0; i < 12; i++) client.push(chunk('Código Civil (Lei nº 10.406/2002)', 'Keyword Match', i));
  const planner: string[] = [];
  for (const [t, n] of [['Constituição Federal', 18], [T.l8213, 18], ['Código de Processo Civil (Lei nº 13.105/2015)', 12],
    ['Regulamento da Previdência Social (Decreto nº 3.048/1999)', 12], ['Regulamento da Previdência Social — Alterações (Decreto nº 10.410/2020)', 12],
    ['INSTRUÇÃO NORMATIVA PRES/INSS Nº 128, DE 28 DE MARÇO DE 2022', 14], ['Estatuto da Pessoa com Deficiência — LEI Nº 13.146', 14]] as Array<[string, number]>) {
    for (let i = 0; i < n; i++) planner.push(chunk(t, 'Recuperação Exata', i));
  }
  // 45 súmulas irrelevantes (BPC/pensão) competindo por espaço — o defeito que cortava a Lei 14.331
  for (let i = 0; i < 45; i++) planner.push(chunk(`SÚMULA ${100 + i} TNU — BPC/pensão irrelevante`, 'Recuperação Exata', 0, 1700));
  planner.push(chunk(T.s47, 'Recuperação Exata', 0, 900), chunk(T.t905, 'Recuperação Exata', 0, 1500));
  for (let i = 0; i < 5; i++) planner.push(chunk(T.t1013, 'Recuperação Exata', i, 1500));
  [418, 2632, 2778, 743].forEach((sz, i) => planner.push(chunk(T.l14331, 'Recuperação Exata', i, sz)));
  return [...core, ...client, ...planner].join(SEP);
}

(async () => {
  const ragCode = between('const RAG_PIECE_SEP', 'function normalizeForMatching');
  const { fitRagContext, parseRagPieces } = await loadFromIndex(ragCode, ['fitRagContext', 'parseRagPieces']);
  const modelCode = between('const MODEL_HIERARCHY = [', '/** Posição do modelo na cadeia');
  const { getEffectiveModel, DEFAULT_GEMINI_MODEL } = await loadFromIndex(modelCode, ['getEffectiveModel', 'DEFAULT_GEMINI_MODEL']);

  console.log('\nMontador de contexto (fitRagContext)');
  const BUDGET = 183_750;
  const body = (out: string) => out.split('[Trechos de menor prioridade')[0];

  await test('mantém Súmula 47, Tema 905, Tema 1.013 e Lei 14.331 com contexto bruto de ~400k chars', () => {
    const out = body(fitRagContext(realisticContext(), BUDGET, 'teste'));
    for (const t of [T.s47, T.t905, T.t1013, T.l14331]) assert.ok(out.includes(`FONTE: ${t}`), `faltou no contexto: ${t}`);
  });
  await test('Lei 14.331 entra com os 4 trechos (não pode ser cortada pela cota de súmulas)', () => {
    const out = body(fitRagContext(realisticContext(), BUDGET, 'teste'));
    const n = out.split(`FONTE: ${T.l14331}`).length - 1;
    assert.equal(n, 4, `esperado 4 trechos da Lei 14.331, vieram ${n}`);
  });
  await test('resultados FRACOS do cliente (Inquilinato score 28%, Código Civil keyword) ficam de fora', () => {
    const out = body(fitRagContext(realisticContext(), BUDGET, 'teste'));
    assert.ok(!out.includes(`FONTE: ${T.inquilinato}`), 'Lei do Inquilinato fraca entrou no contexto');
  });
  await test('respeita o orçamento (± índice) e traz o ÍNDICE DAS FONTES no topo', () => {
    const out = fitRagContext(realisticContext(), BUDGET, 'teste');
    assert.ok(out.length <= BUDGET + 8000, `contexto estourou o orçamento: ${out.length}`);
    assert.ok(out.startsWith('[ÍNDICE DAS FONTES RECUPERADAS'), 'índice ausente');
  });
  await test('remove duplicatas cliente×planner (mesmo trecho vira uma cópia)', () => {
    const dup = [chunk(T.s47, 'Score: 70%', 0, 900), chunk(T.s47, 'Recuperação Exata', 0, 900)].join(SEP);
    const pieces = parseRagPieces(dup);
    assert.equal(pieces.length, 1);
    assert.equal(pieces[0].tier, 1, 'a cópia deve ficar com a MELHOR prioridade');
  });
  await test('núcleo por tipo de caso (tier 0) tem prioridade absoluta', () => {
    const pieces = parseRagPieces(chunk(T.s47, 'Dispositivo núcleo pré-cadastrado para este tipo de caso', 0, 500));
    assert.equal(pieces[0].tier, 0);
  });
  await test('contexto que já cabe no orçamento não perde nenhum trecho', () => {
    const small = [chunk(T.s47, 'Recuperação Exata', 0, 900), chunk(T.l14331, 'Recuperação Exata', 0, 800)].join(SEP);
    const out = fitRagContext(small, BUDGET, 'teste');
    assert.ok(out.includes(`FONTE: ${T.s47}`) && out.includes(`FONTE: ${T.l14331}`));
    assert.ok(!out.includes('[Trechos de menor prioridade'), 'não deveria omitir nada');
  });

  console.log('\nModelo (somente Hydrogen)');
  await test('qualquer id Gemini de texto vira gemini-4-hydrogen', () => {
    for (const m of ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash', 'direct:gemini-3.6-flash', 'google/gemini-3.7-flash', 'models/gemini-3.5-flash-lite', 'gemini-1.5-pro', undefined]) {
      assert.equal(getEffectiveModel(m as any), DEFAULT_GEMINI_MODEL, `${m} deveria virar o Hydrogen`);
    }
    assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-4-hydrogen');
  });
  await test('embeddings, TTS e imagem NÃO são redirecionados', () => {
    for (const m of ['gemini-embedding-001', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-image-preview']) assert.equal(getEffectiveModel(m), m);
  });
  await test('modelos não-Gemini (OpenRouter) seguem inalterados', () => assert.equal(getEffectiveModel('deepseek/deepseek-v4-flash'), 'deepseek/deepseek-v4-flash'));

  console.log('\nContexto de CRM (agenda/contratos/clientes) só quando a mensagem é sobre isso');
  const crmCode = between('const CRM_INTENT_RE', 'const QUICK_QUESTION_MAX_CHARS');
  const { needsCrmContext } = await loadFromIndex(crmCode, ['needsCrmContext']);
  await test('mensagens JURÍDICAS não arrastam o CRM inteiro (eram ~100k tokens por mensagem)', () => {
    for (const m of ['gerar relatório', 'Qual foi o motivo do indeferimento da prorrogação e qual a data da DCB?', 'o que diz a Súmula 47 da TNU?',
      'Tomada de ciência: leia e armazene os documentos anexados desta cliente.', 'elabore a petição inicial de auxílio por incapacidade', 'a perícia médica foi regular?']) {
      assert.equal(needsCrmContext(m), false, `não deveria injetar CRM em: "${m}"`);
    }
  });
  await test('mensagens de AGENDA/CONTRATO/CLIENTES continuam recebendo o CRM', () => {
    for (const m of ['quais compromissos tenho hoje na agenda?', 'quantos contratos estão em andamento?', 'marque como resolvido o compromisso de amanhã',
      'qual o status do contrato da Lanetone?', 'lista de clientes arquivados', 'quais clientes têm perícias esta semana?']) {
      assert.equal(needsCrmContext(m), true, `deveria injetar CRM em: "${m}"`);
    }
  });

  console.log('\nBusca específica no CRM (só o que o comando pede)');
  const crmClients = [
    { id: 'c1', name: 'LANETONE TAVARES PIRES DE OLIVEIRA', type: 'AUXÍLIO DOENÇA/A', history: [] },
    { id: 'c2', name: 'DENIZE CRISTINA ANDRADE DE LIMA', type: 'AUXÍLIO DOENÇA/A', history: [] },
    ...Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `MARIA SILVA ${i}`, type: 'BPC', history: [] })),
  ];
  const crmContracts = [
    { id: 'k1', firstName: 'LANETONE', lastName: 'TAVARES PIRES DE OLIVEIRA', status: 'Concluído' },
    { id: 'k2', firstName: 'DENIZE', lastName: 'CRISTINA ANDRADE DE LIMA', status: 'Em Andamento' },
  ];
  const crmAgenda = [{ id: 'a1', title: 'Perícia Lanetone', date: '2026-11-20' }, { id: 'a2', title: 'Audiência Denize', date: '2026-11-21' }];
  const crmIn = { agenda: crmAgenda, clients: crmClients, contracts: crmContracts };

  await test('comando sobre uma PESSOA envia só ela, seus contratos e seus compromissos', () => {
    const r: any = buildCrmPayload('conclua o contrato da Lanetone', crmIn);
    assert.equal(r.clients.length, 1);
    assert.equal(r.clients[0].id, 'c1');
    assert.deepEqual(r.contracts.map((c: any) => c.id), ['k1']);
    assert.deepEqual(r.agenda.map((a: any) => a.id), ['a1']);
  });
  await test('nome com acento/caixa diferente ainda casa (Lanétone)', () => {
    const r: any = buildCrmPayload('qual o status da LANÉTONE?', crmIn);
    assert.equal(r.clients.length, 1);
  });
  await test('"o que temos para essa semana?" envia só a AGENDA', () => {
    const r: any = buildCrmPayload('o que temos para essa semana?', crmIn);
    assert.equal(r.agenda.length, 2);
    assert.equal(r.clients, undefined);
    assert.equal(r.contracts, undefined);
  });
  await test('"quais contratos estão em andamento?" envia só os CONTRATOS', () => {
    const r: any = buildCrmPayload('quais contratos estão em andamento?', crmIn);
    assert.equal(r.contracts.length, 2);
    assert.equal(r.agenda, undefined);
  });
  await test('nome comum que casa com muitos clientes (>8) não vira filtro: cai no comando genérico', () => {
    const r: any = buildCrmPayload('quais clientes silva estão arquivados?', crmIn);
    assert.ok(r.clients.length > 8, 'deveria enviar a lista de clientes, não filtrar por "silva"');
    assert.equal(r.agenda, undefined);
  });

  console.log('\nPeça encerrada pelo modelo sem o fecho obrigatório');
  const closingCode = between('function isPetitionComplete', 'const PETITION_CLOSING_PROMPT');
  const { petitionEndedWithoutClosing } = await loadFromIndex(closingCode, ['petitionEndedWithoutClosing']);
  const corpo = ' Fundamentação detalhada do pedido com análise da prova dos autos. '.repeat(120);
  const pecaSemFecho = `AO JUÍZO DO JUIZADO ESPECIAL FEDERAL DE SÃO JOÃO DE MERITI/RJ\n${corpo}\nIX. DO VALOR DA CAUSA\nTOTAL: R$ 32.420,00`;
  const pecaCompleta = `${pecaSemFecho}\nX. DO ROL DE DOCUMENTOS\n1. Procuração\nNestes termos, pede e espera deferimento.\nSão João de Meriti, 17 de novembro de 2026.\nMichel Santos Felix — OAB/RJ 231.640`;
  await test('peça nova que parou no tópico IX sem "Nestes termos…" é detectada (pede o complemento)', () => {
    assert.equal(petitionEndedWithoutClosing(pecaSemFecho, { hasWordTarget: true, maxTokensHit: false }), true);
  });
  await test('peça completa (Rol de documentos + "Nestes termos, pede e espera deferimento" + OAB) NÃO dispara complemento', () => {
    assert.equal(petitionEndedWithoutClosing(pecaCompleta, { hasWordTarget: true, maxTokensHit: false }), false);
  });
  await test('relatório, edição cirúrgica (sem alvo de palavras) e corte por MAX_TOKENS não disparam complemento', () => {
    assert.equal(petitionEndedWithoutClosing(`RELATÓRIO DE ANÁLISE JURÍDICA\n${corpo}`, { hasWordTarget: true, maxTokensHit: false }), false);
    assert.equal(petitionEndedWithoutClosing(pecaSemFecho, { hasWordTarget: false, maxTokensHit: false }), false);
    assert.equal(petitionEndedWithoutClosing(pecaSemFecho, { hasWordTarget: true, maxTokensHit: true }), false);
  });

  console.log('\nResumo do caso e tipo de caso');
  const denizeText = [
    'Meu INSS: Aposentadoria, pensão por morte, salário-maternidade, BPC e auxílio por incapacidade: consulte aqui todos os serviços; veja também o seguro-desemprego.',
    'Benefícios assistenciais BPC LOAS para pessoa com deficiência e idoso; aposentadoria por idade e pensão por morte; salário-maternidade.',
    'Resultado da perícia médica de prorrogação - INDEFERIMENTO em 16/10/2026 do benefício NB 722.356.189-1 (auxílio por incapacidade temporária).',
    'Laudo psiquiátrico: transtornos mentais graves CID F41.2, F32 e F43.1 com incapacidade para o trabalho; alta médica em 13/03/2026 (DCB).',
  ].join('\n');
  await test('resumo descarta linhas de MENU (≥3 famílias de benefício) e mantém os fatos do caso', () => {
    const d = buildCaseDigest([{ fullText: denizeText }]);
    assert.ok(!/salário-maternidade/i.test(d), 'linha de menu entrou no resumo');
    assert.ok(/INDEFERIMENTO/.test(d) && /CID F41\.2/.test(d), 'fatos do caso ausentes do resumo');
  });
  await test('identifica auxílio-doença no caso da Denize', () => {
    const t = detectCaseTypes('gerar relatório ' + buildCaseDigest([{ fullText: denizeText }])).types;
    assert.ok(t.includes('auxilio_doenca'), `tipos: ${t.join(',')}`);
  });
  await test('conversa solta não classifica tipo de caso', () => assert.deepEqual(detectCaseTypes('olá, tudo bem?').types, []));
  await test('BPC com deficiência é identificado como BPC', () => {
    assert.ok(detectCaseTypes('Pedido de BPC LOAS para pessoa com deficiência, impedimento de longo prazo').types.includes('bpc_deficiencia'));
  });

  console.log('\n2ª rodada de busca (itens AUSENTES)');
  const titles = [T.s47, T.l14331, T.t905, T.t1013, 'SÚMULA 73 TNU — PREVIDENCIÁRIO — Gozo de auxílio-doença', 'Reforma da Previdência (EC nº 103/2019)'].map(t => ({ title: t, areas: ['INSS'] }));
  const deps = { getTitles: async () => titles, fetchChunks: async (ts: string[]) => ts.map(t => ({ content: 'TEXTO LITERAL ' + t })) };
  const report = `**Súmula 47 da TNU**\nJustificativa: x.\n[AUSENTE — SOLICITAR ADIÇÃO]\n\n**Lei nº 14.331/2022**\nJustificativa: y.\n[AUSENTE — SOLICITAR ADIÇÃO]\n\nTema 810 do STF / Tema 905 do STJ (juros); [AUSENTE — SOLICITAR ADIÇÃO]\n\nArt. 22, § 4º, da Lei nº 8.906/1994 (Estatuto da OAB); [AUSENTE — SOLICITAR ADIÇÃO]\n\nResolução CJF nº 10/2020. [AUSENTE — SOLICITAR ADIÇÃO]\n`;
  await test('recupera Súmula 47, Lei 14.331 e Tema 905 que o relatório marcou como ausentes', async () => {
    const r = await runSecondPassRag(report, ['INSS'], deps);
    assert.ok(r.changed);
    const got = r.recovered.map(x => x.title).join('|');
    assert.ok(got.includes('SÚMULA 47') && got.includes('14.331') && got.includes('TEMA 905'), got);
  });
  await test('NÃO inventa: Estatuto da OAB e Resolução CJF (fora da base) continuam AUSENTES', async () => {
    const r = await runSecondPassRag(report, ['INSS'], deps);
    assert.equal((r.text.match(/\[AUSENTE/g) || []).length, 2, 'devem sobrar exatamente 2 marcadores AUSENTE');
    assert.equal(r.stillMissing.length, 2);
  });
  await test('item com parte na base vira PARCIALMENTE DISPONÍVEL (Tema 810 STF não existe)', async () => {
    const r = await runSecondPassRag(report, ['INSS'], deps);
    assert.ok(/PARCIALMENTE DISPONÍVEL[^\]]*TEMA 905|PARCIALMENTE DISPONÍVEL[^\]]*Tema 810/i.test(r.text));
  });
  await test('anexa o texto LITERAL da base em um adendo', async () => {
    const r = await runSecondPassRag(report, ['INSS'], deps);
    assert.ok(r.text.includes('ADENDO AUTOMÁTICO') && r.text.includes('TEXTO LITERAL SÚMULA 47'));
  });
  await test('itens COLADOS (um por linha) não contaminam os vizinhos: Resolução CJF segue AUSENTE ao lado do Tema 905', async () => {
    // Formato real visto em produção (17/11/2026): "FONTE: …[AUSENTE]" um item por linha, sem linha em branco entre eles.
    const glued = [
      'FONTE: Tema 905 STJ: correção monetária e juros. [AUSENTE — SOLICITAR ADIÇÃO]',
      'FONTE: Resolução CJF nº 10/2020: Juízo 100% Digital. [AUSENTE — SOLICITAR ADIÇÃO]',
      'FONTE: Art. 22, § 4º, da Lei nº 8.906/1994: honorários. [AUSENTE — SOLICITAR ADIÇÃO]',
      '',
    ].join('\n');
    const r = await runSecondPassRag(glued, ['INSS'], deps);
    const linhas = r.text.split('\n').filter(l => l.startsWith('FONTE:'));
    assert.ok(/DISPONÍVEL NA BASE[^\]]*TEMA 905/i.test(linhas[0]), 'Tema 905 deveria ser recuperado: ' + linhas[0]);
    assert.ok(/\[AUSENTE/.test(linhas[1]) && !/DISPON/.test(linhas[1]), 'Resolução CJF deveria continuar AUSENTE: ' + linhas[1]);
    assert.ok(/\[AUSENTE/.test(linhas[2]) && !/DISPON/.test(linhas[2]), 'Lei 8.906 deveria continuar AUSENTE: ' + linhas[2]);
  });
  await test('relatório sem AUSENTE não é alterado', async () => {
    const r = await runSecondPassRag('tudo [DISPONÍVEL NA BASE]', ['INSS'], deps);
    assert.equal(r.changed, false);
  });
  await test('extração de identificadores: súmula+tribunal, tema+tribunal, lei', () => {
    const refs = extractRefs('Súmula 47 da TNU; Tema 905 do STJ; Lei nº 14.331/2022');
    assert.ok(refs.some(r => r.kind === 'sumula' && r.num === '47' && r.court === 'tnu'));
    assert.ok(refs.some(r => r.kind === 'tema' && r.num === '905' && r.court === 'stj'));
    assert.ok(refs.some(r => r.kind === 'lei' && r.num.replace(/\D/g, '') === '14331'));
  });

  // ---------- opcional: planner real em produção ----------
  if (process.env.RAG_BASE_URL && process.env.RAG_TOKEN) {
    console.log('\nPlanner em produção (golden case: incapacidade)');
    await test('plano contém Súmula 47, Lei 14.331 e Tema 905 e NÃO traz o cacho de BPC/pensão', async () => {
      const res = await fetch(`${process.env.RAG_BASE_URL}/api/rag/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RAG_TOKEN}` },
        body: JSON.stringify({
          caseContext: '[RESUMO DO CASO]\nRestabelecimento de Auxílio por Incapacidade Temporária (NB 722.356.189-1) com pedido subsidiário de conversão em Aposentadoria por Incapacidade Permanente. Alta médica indeferiu prorrogação. Transtornos mentais graves CID F41.2.\n\ngerar relatório',
          areas: ['INSS'], personaId: 'Dr. Michel Felix',
        }),
      });
      const j: any = await res.json();
      const plano: string[] = (j.diagnostico?.planoFinal || []).map((p: any) => p.titulo);
      for (const needle of ['SÚMULA 47 TNU', '14.331/2022', 'TEMA 905 STJ']) assert.ok(plano.some(t => t.includes(needle)), `plano sem ${needle}`);
      assert.ok(!plano.some(t => /SÚMULA (48|79|80) TNU|TEMA 640 STJ|RE 567985/.test(t)), 'cacho de BPC voltou ao plano');
      assert.ok((j.ragContext || '').length < 200_000, `contexto do planner grande demais: ${(j.ragContext || '').length}`);
    });
  } else {
    console.log('\n(teste do planner em produção ignorado: defina RAG_BASE_URL e RAG_TOKEN para ativá-lo)');
  }

  console.log('\nRedator: regras do prompt (peça da Denize, 17/11/2026)');
  const redatorCode = between('function hasWorkAfterCessationHint', 'const REGRA_CORRECAO_JUROS');
  const { hasWorkAfterCessationHint, shouldInjectTema905 } = await loadFromIndex(redatorCode, ['hasWorkAfterCessationHint', 'shouldInjectTema905']);
  await test('Tema 905 entra no contexto do RELATÓRIO mas é retirado na geração da PEÇA', () => {
    assert.equal(shouldInjectTema905('[RESUMO DO CASO] Restabelecimento de auxílio por incapacidade.\n\ngerar relatório'), true);
    assert.equal(shouldInjectTema905('Restabelecimento NB 722.356.189-1, atrasados desde 14/03/2026.\n\ngerar peça: petição inicial de restabelecimento do auxílio'), false);
    assert.equal(shouldInjectTema905('redigir a petição inicial com os atrasados'), false);
    assert.equal(shouldInjectTema905('qual o prazo para recorrer?'), false);
  });
  await test('Tema 1.013 NÃO dispara só por "trabalho"/"período" (caso comum de incapacidade)', () => {
    const ctxComum = 'Segurada afastada do trabalho desde 04/04/2024; último dia de trabalho declarado pela empregadora; período de graça de 12 meses; perícia de prorrogação indeferida; retorno ao trabalho não indicado.';
    assert.equal(hasWorkAfterCessationHint(ctxComum), false);
  });
  await test('Tema 1.013 dispara quando há indício de atividade depois da cessação', () => {
    assert.equal(hasWorkAfterCessationHint('A cliente voltou a trabalhar informalmente após a cessação do benefício.'), true);
    assert.equal(hasWorkAfterCessationHint('Ela fez bicos como diarista enquanto aguardava o benefício.'), true);
    assert.equal(hasWorkAfterCessationHint('Pedido de reintegração ao emprego.'), true);
  });
  await test('Juízo 100% Digital: prompt cita só a Resolução CNJ nº 345/2020 (CJF nº 10/2020 só aparece na proibição)', () => {
    const todas = src.split('Resolução CJF nº 10/2020').length - 1;
    const proibicoes = src.split('NÃO cite "Resolução CJF nº 10/2020"').length - 1;
    assert.ok(todas >= 1, 'a proibição desapareceu do prompt');
    assert.equal(todas, proibicoes, `há ${todas - proibicoes} citação(ões) de "Resolução CJF nº 10/2020" fora da proibição`);
    assert.ok(src.includes('Resolução CNJ nº 345/2020 (cite APENAS esta'), 'a Resolução CNJ nº 345/2020 sumiu do prompt');
  });
  await test('regra de correção/juros está nos 3 chats que geram peça e Tema 810/905 não são mais "o regime"', () => {
    assert.ok(/const REGRA_CORRECAO_JUROS = `5\. CORREÇÃO MONETÁRIA E JUROS/.test(src), 'constante da regra sumiu');
    const usos = src.split('${REGRA_CORRECAO_JUROS}').length - 1;
    assert.equal(usos, 3, `a regra deveria estar em 3 chats, está em ${usos}`);
    assert.equal(src.split('(Tema 810 STF)').length - 1, 0, 'estrutura ainda indica "(Tema 810 STF)" como índice dos atrasados');
    assert.equal(src.split('correção (Tema 905/STJ)').length - 1, 0, 'estrutura ainda indica "(Tema 905/STJ)" como índice dos atrasados');
    const regra = src.slice(src.indexOf('const REGRA_CORRECAO_JUROS'), src.indexOf('const REGRA_CORRECAO_JUROS') + 1600);
    assert.ok(/08\/12\/2021/.test(regra) && /EC 113\/2021/.test(regra) && /SEM fixar índice único/.test(regra), 'regra incompleta');
  });

  console.log('\nPoda das estruturas de peça (economia de tokens)');
  const poda = await loadFromIndex(between('const MICHEL_STRUCTURE_BY_CASE', 'const DR_MICHEL_SYSTEM_PROMPT = `'), ['pruneMichelStructures']);
  const promptReal = src.slice(src.indexOf('const DR_MICHEL_SYSTEM_PROMPT = `') + 'const DR_MICHEL_SYSTEM_PROMPT = `'.length, src.indexOf('`;\n\nconst CNIS_SYSTEM_PROMPT'));
  const titulos = (t: string) => [...t.matchAll(/^ESTRUTURA OBRIGATÓRIA PARA ([^\n]*?):[ \t]*$/gm)].map(m => m[1]);
  await test('prompt real tem os 12 cabeçalhos de estrutura (se alguém mudar o formato, a poda precisa ser revista)', () => {
    assert.equal(titulos(promptReal).length, 12, titulos(promptReal).join(' | '));
  });
  await test('incapacidade: mantém a estrutura do caso + recursos e corta o resto (≥25% do prompt)', () => {
    const out: string = poda.pruneMichelStructures(promptReal, { caseTypes: ['auxilio_doenca'], message: 'gerar peça: petição inicial de restabelecimento do auxílio por incapacidade temporária com pedido subsidiário de conversão em aposentadoria por incapacidade permanente' });
    const t = titulos(out);
    assert.ok(t.some(x => /INCAPACIDADE/.test(x)), 'estrutura de incapacidade sumiu');
    assert.ok(t.filter(x => /RECURSO/.test(x)).length === 2, 'estruturas de recurso devem ficar sempre');
    assert.ok(!t.some(x => /PENSÃO|SALÁRIO-MATERNIDADE|POR IDADE|BPC|TEMPO DE CONTRIBUI|APOSENTADORIA ESPECIAL/.test(x)), `ficaram estruturas de outros tipos: ${t.join(' | ')}`);
    assert.ok(out.length < promptReal.length * 0.75, `poda insuficiente: ${out.length} de ${promptReal.length}`);
    assert.match(out, /ESTRUTURAS DE OUTROS TIPOS DE AÇÃO OMITIDAS/);
    assert.ok(out.includes('V. DO DIREITO - DA INCAPACIDADE'), 'conteúdo da estrutura do caso foi cortado');
  });
  await test('travas: sem tipo de caso, tipo desconhecido ou mensagem citando outro tipo NÃO podam errado', () => {
    assert.equal(poda.pruneMichelStructures(promptReal, { caseTypes: [], message: 'gerar peça' }), promptReal, 'sem tipo de caso não pode cortar');
    assert.equal(poda.pruneMichelStructures(promptReal, { caseTypes: undefined, message: 'gerar peça' }), promptReal);
    assert.equal(poda.pruneMichelStructures(promptReal, { caseTypes: ['tipo_inexistente'], message: 'gerar peça' }), promptReal, 'tipo desconhecido não pode cortar');
    const mistura = titulos(poda.pruneMichelStructures(promptReal, { caseTypes: ['auxilio_doenca'], message: 'agora preciso de uma petição de pensão por morte' }));
    assert.ok(mistura.some(x => /PENSÃO/.test(x)) && mistura.some(x => /INCAPACIDADE/.test(x)), 'mensagem citando pensão deve manter as duas');
    assert.equal(poda.pruneMichelStructures('prompt curto sem cabeçalhos', { caseTypes: ['auxilio_doenca'], message: '' }), 'prompt curto sem cabeçalhos', 'formato desconhecido não corta');
  });

  console.log('\nRevisão automática da peça — checagens determinísticas');
  const filler = 'O autor demonstra, com base nos documentos acostados, que a incapacidade persiste e que o benefício deve ser restabelecido. '.repeat(70);
  const corpoLimpo = (extra = '', rol = 'Doc. 1 - Procuração.pdf\nDoc. 2 - Declaração de pobreza.pdf\nDoc. 3 - Termo de renúncia.pdf\nDoc. 4 - Identidade.pdf', data = '18 de novembro de 2026') =>
    `AO JUÍZO DO __ JUIZADO ESPECIAL FEDERAL DE SÃO JOÃO DE MERITI/RJ\n\nFULANA DE TAL, qualificada, propõe ação.\n\nI. DOS FATOS\n${filler}(Doc. 2 e Doc. 3). Laudo (Doc. 4, fls. 1/2).\n${extra}\nIX. DO VALOR DA CAUSA\nParcelas vencidas (8 meses): 8 × R$ 1.621,00 = R$ 12.968,00\nParcelas vincendas (12 meses): 12 × R$ 1.621,00 = R$ 19.452,00\nTOTAL DO VALOR DA CAUSA: R$ 32.420,00 (trinta e dois mil, quatrocentos e vinte reais).\n\nNestes termos, pede e espera deferimento.\n\nSão João de Meriti/RJ, ${data}.\n\nMICHEL SANTOS FELIX\nOAB/RJ 231.640\n\nX. DO ROL DE DOCUMENTOS\n${rol}\n`;
  const HOJE = new Date(2026, 10, 18);
  await test('peça correta não gera alerta (sem falso positivo): conta, rol, data e regras ok', () => {
    const peca = corpoLimpo();
    assert.equal(shouldReviewPetition(peca), true);
    assert.deepEqual(deterministicPetitionChecks(peca, { hoje: HOJE }), []);
  });
  await test('relatório e conversa NÃO entram na revisão', () => {
    assert.equal(shouldReviewPetition(`RELATÓRIO DE ANÁLISE JURÍDICA\n${filler}`), false);
    assert.equal(shouldReviewPetition('Sim, pode pedir tutela. Nestes termos, pede deferimento.'), false);
  });
  await test('conta do valor da causa errada e total que não fecha são apontados', () => {
    const errada = corpoLimpo().replace('12 × R$ 1.621,00 = R$ 19.452,00', '12 × R$ 1.621,00 = R$ 19.000,00');
    const a = deterministicPetitionChecks(errada, { hoje: HOJE }).filter(x => x.tipo === 'calculo');
    assert.ok(a.length >= 2, `esperava 2 alertas de cálculo (conta e total), veio ${a.length}`);
    assert.ok(a.every(x => x.severidade === 'alta'));
    const soTotal = corpoLimpo().replace('R$ 32.420,00 (trinta', 'R$ 33.000,00 (trinta');
    assert.equal(deterministicPetitionChecks(soTotal, { hoje: HOJE }).filter(x => x.tipo === 'calculo').length, 1);
  });
  await test('valor da causa limitado ao teto do JEF (total ≠ soma das parcelas, sem linha "Total") não vira falso alarme', () => {
    const teto = corpoLimpo().replace(/TOTAL DO VALOR DA CAUSA: R\$ 32\.420,00/, 'VALOR DA CAUSA: R$ 97.260,00');
    assert.equal(deterministicPetitionChecks(teto, { hoje: HOJE }).filter(x => x.tipo === 'calculo').length, 0);
  });
  await test('data da assinatura diferente de hoje é apontada (baixa); ausência de data também', () => {
    const velha = deterministicPetitionChecks(corpoLimpo('', undefined, '17 de novembro de 2026'), { hoje: HOJE });
    assert.equal(velha.length, 1);
    assert.equal(velha[0].severidade, 'baixa');
    assert.match(velha[0].problema, /17 de novembro de 2026/);
    const semData = deterministicPetitionChecks(corpoLimpo().replace(/São João de Meriti\/RJ, .*\n/, ''), { hoje: HOJE });
    assert.ok(semData.some(x => /data da assinatura/i.test(x.problema)));
  });
  await test('marcas do sistema, lacunas, INPC+poupança e Resolução CJF são apontados', () => {
    const peca = corpoLimpo('Conforme a Base de Conhecimento (RAG) [AUSENTE — SOLICITAR ADIÇÃO]. Valor R$ XX. Juros: INPC e poupança (Tema 905). Juízo 100% Digital: Resolução CJF nº 10/2020.');
    const a = deterministicPetitionChecks(peca, { hoje: HOJE });
    assert.ok(a.some(x => x.tipo === 'forma' && /marcas internas/.test(x.problema)), 'marcas');
    assert.ok(a.some(x => x.tipo === 'forma' && /lacuna/.test(x.problema)), 'lacuna');
    assert.ok(a.some(x => x.tipo === 'regra' && /INPC/.test(x.problema)), 'INPC');
    assert.ok(a.some(x => x.tipo === 'regra' && /CNJ nº 345/.test(x.problema)), 'CJF');
  });
  await test('inciso romano "XXX" (art. 7º, XXX) não é tratado como lacuna', () => {
    const a = deterministicPetitionChecks(corpoLimpo('Art. 7º, XXX, da Constituição.'), { hoje: HOJE });
    assert.equal(a.filter(x => /lacuna/.test(x.problema)).length, 0);
  });
  await test('documento citado no corpo e ausente do rol é apontado (inclusive em "Docs. 17 e 18")', () => {
    const a = deterministicPetitionChecks(corpoLimpo('Vide Docs. 3 e 9 e o Doc. 12.'), { hoje: HOJE }).filter(x => /não constam do rol/.test(x.problema));
    assert.equal(a.length, 1);
    assert.match(a[0].problema, /Doc\. 9, Doc\. 12/);
  });
  await test('parser do revisor de IA descarta lixo, normaliza severidade/tipo e limita a 15', () => {
    const lixo = [{ problema: 'x' }, null, 'texto', { severidade: 'MÉDIA', tipo: 'Citação', problema: 'Art. 60 §§ 8º e 9º não diz isso', trecho: 'abc', correcao_sugerida: 'Citar o art. 78 do Decreto 3.048' }];
    const r = parseReviewAlerts(lixo);
    assert.equal(r.length, 1);
    assert.equal(r[0].severidade, 'media');
    assert.equal(r[0].tipo, 'citacao');
    assert.match(r[0].sugestao || '', /art\. 78/);
    assert.equal(parseReviewAlerts(Array.from({ length: 40 }, (_, i) => ({ problema: `problema número ${i} detalhado` }))).length, 15);
    assert.deepEqual(parseReviewAlerts({ nao: 'array' }), []);
  });
  await test('mesclar camadas não repete o mesmo problema (INPC/Tema 905 já apontado pela IA)', () => {
    const auto = deterministicPetitionChecks(corpoLimpo('Juros: INPC e poupança (Tema 905).'), { hoje: HOJE });
    assert.equal(auto.filter(x => /INPC/.test(x.problema)).length, 1);
    const ia = parseReviewAlerts([{ severidade: 'alta', tipo: 'regra', problema: 'A peça transcreve o Tema 905/STJ (INPC) para débitos de 2026', trecho: 'Tema 905' }]);
    const mesclado = mergeReviewAlerts(auto, ia);
    assert.equal(mesclado.filter(x => /905|INPC/.test(x.problema)).length, 1, 'o alerta de INPC deveria aparecer uma vez só');
    const outro = parseReviewAlerts([{ severidade: 'media', tipo: 'fato', problema: 'A data da DIB diverge do dossiê (14/06/2025)' }]);
    assert.equal(mergeReviewAlerts(auto, outro).length, auto.length + 1, 'alerta não relacionado não pode apagar o automático');
  });
  await test('pedido para APLICAR a revisão é reconhecido (e conversa comum não)', () => {
    for (const m of ['aplique a atualização na peça', 'Aplique os itens 1 e 3 da revisão', 'corrija conforme os apontamentos', 'faça as correções sugeridas pela revisão', 'aplique as sugestões na peça'])
      assert.equal(wantsToApplyReview(m), true, m);
    for (const m of ['gerar relatório', 'qual o prazo para recorrer?', 'atualize o endereço da autora', 'tomada de ciência: leia os documentos', 'gerar peça: petição inicial de restabelecimento'])
      assert.equal(wantsToApplyReview(m), false, m);
    assert.equal(wantsToApplyReview('aplique a revisão ' + 'x'.repeat(700)), false, 'mensagem enorme não é um pedido curto de aplicar');
  });
  await test('base do revisor é ENXUTA: índice de todos os títulos + texto só do que a peça cita', () => {
    const grande = (t: string, i: number) => `FONTE: ${t} [Score: 50%]\n` + (`Texto ${t} ${i} `).repeat(300);
    const ctx = [grande('Lei nº 14.331/2022', 1), grande('Lei nº 8.213/1991', 2), grande('Código Civil', 3), grande('Lei do Inquilinato', 4), grande('Lei nº 8.213/1991', 5)].join('\n\n---\n\n');
    const r = buildReviewBase(ctx, (title) => /14\.331|8\.213/.test(title));
    assert.equal(r.totalPieces, 5);
    assert.equal(r.citedPieces, 3);
    for (const t of ['Lei nº 14.331/2022', 'Lei nº 8.213/1991', 'Código Civil', 'Lei do Inquilinato']) assert.ok(r.text.includes(`- ${t}`), `índice sem ${t}`);
    assert.equal((r.text.match(/- Lei nº 8\.213\/1991/g) || []).length, 1, 'título repetido no índice');
    assert.ok(r.text.includes('Texto Lei nº 14.331/2022 1'), 'texto literal do citado sumiu');
    assert.ok(!r.text.includes('Texto Código Civil 3'), 'texto de dispositivo NÃO citado não pode ir ao revisor');
    assert.ok(r.text.length < ctx.length * 0.7, `base do revisor não encolheu (${r.text.length} vs ${ctx.length})`);
    assert.equal(buildReviewBase(undefined, () => true).text, '');
    assert.match(buildReviewBase(grande('Código Civil', 1), () => false).text, /não cita nenhum dispositivo/);
  });
  await test('frase real do Michel ("pode aplicar a correçã no artefato", com erro de digitação) é reconhecida', () => {
    assert.equal(wantsToApplyReview('pode aplicar a correçã no artefato'), true);
    assert.equal(wantsToApplyReview('pode aplicar a correção no artefato'), true);
    assert.equal(wantsToApplyReview('aplique os ajustes'), true);
    // revisão é a última mensagem + resposta curta de ação (sem citar "revisão")
    assert.equal(wantsToApplyReview('pode aplicar', { reviewIsLatest: true }), true);
    assert.equal(wantsToApplyReview('faça isso', { reviewIsLatest: true }), true);
    assert.equal(wantsToApplyReview('pode aplicar'), false, 'sem a revisão por perto, "pode aplicar" é ambíguo e não deve anexar nada');
    assert.equal(wantsToApplyReview('qual o prazo para recorrer?', { reviewIsLatest: true }), false);
    assert.equal(reviewApplyRequest('[CORREÇÃO CIRÚRGICA NO ARTEFATO #ART-01]\n\nINSTRUÇÃO DE ALTERAÇÃO:\npode aplicar', { reviewIsLatest: true }).apply, true);
  });
  await test('as 3 formas de pedir: chat principal, caixa do artefato e trecho selecionado', () => {
    const principal = reviewApplyRequest('aplique a atualização na peça');
    assert.deepEqual(principal, { apply: true, hasSelection: false });
    const caixaArtefato = '[ARTEFATO ALVO: ID #ART-01 | NATUREZA: Petição Inicial | TÍTULO: AO JUÍZO]\n\n[CORREÇÃO CIRÚRGICA NO ARTEFATO #ART-01]\n\nINSTRUÇÃO DE ALTERAÇÃO:\naplique a atualização na peça';
    assert.deepEqual(reviewApplyRequest(caixaArtefato), { apply: true, hasSelection: false });
    const selecao = '[ARTEFATO ALVO: ID #ART-01 | NATUREZA: Petição Inicial | TÍTULO: AO JUÍZO]\n\n[CORREÇÃO CIRÚRGICA NO ARTEFATO #ART-01]\n\nTRECHO SELECIONADO A MODIFICAR:\n"c) Inconsistências da avaliação médico-pericial discutida"\n\nINSTRUÇÃO DE ALTERAÇÃO:\nAplique os apontamentos da revisão aqui';
    assert.deepEqual(reviewApplyRequest(selecao), { apply: true, hasSelection: true });
    // correção cirúrgica comum (sem falar da revisão) NÃO anexa a revisão
    const comum = '[CORREÇÃO CIRÚRGICA NO ARTEFATO #ART-01]\n\nINSTRUÇÃO DE ALTERAÇÃO:\ntroque o nome da empresa para Venâncio Produtos Farmacêuticos';
    assert.equal(reviewApplyRequest(comum).apply, false);
  });
  await test('mensagem do chat: ordena por gravidade, avisa quando a IA falhou e diz "nenhum alerta" quando limpo', () => {
    const msg = formatReviewMessage([
      { severidade: 'baixa', tipo: 'forma', problema: 'Data antiga', origem: 'automatica' },
      { severidade: 'alta', tipo: 'calculo', problema: 'Conta errada', origem: 'automatica' },
    ], { ia: 'ok' });
    assert.ok(msg.indexOf('Conta errada') < msg.indexOf('Data antiga'), 'ordem por gravidade');
    assert.match(msg, /2 ponto\(s\).*1 grave/);
    assert.match(formatReviewMessage([], { ia: 'ok' }), /Nenhum alerta/);
    assert.match(formatReviewMessage([], { ia: 'falhou' }), /revisor de IA não respondeu/);
    assert.ok(!shouldReviewPetition(msg) && !/^\s*(?:#+\s*)?(?:AO\s+JU[ÍI]ZO|EXCELENT[ÍI]SSIM)/i.test(msg), 'a mensagem de revisão não pode ser confundida com uma peça');
  });

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  process.exit(failed > 0 ? 1 : 0);
})();
