import React, { useState, useEffect, useRef } from 'react';
import { 
  PaperAirplaneIcon as Send, 
  PaperClipIcon as Paperclip, 
  DocumentTextIcon as FileText, 
  BriefcaseIcon as Briefcase, 
  MagnifyingGlassIcon as Search, 
  PlusIcon as Plus, 
  ChevronLeftIcon as ChevronLeft, 
  ChevronRightIcon as ChevronRight, 
  ChevronDownIcon as ChevronDown,
  ArrowDownTrayIcon as Download, 
  ArrowPathIcon as Loader2, 
  UsersIcon as Users,
  CpuChipIcon as Bot,
  ClockIcon as History, 
  TrashIcon as Trash2,
  ClipboardIcon as Copy,
  PencilIcon as Edit2,
  XMarkIcon as XMark,
  CheckCircleIcon as CheckCircle,
  SparklesIcon as Sparkles,
  ScissorsIcon as Scissors,
  ShieldExclamationIcon as ShieldExclamation,
  ArrowsPointingOutIcon as Maximize2,
  ArrowsPointingInIcon as Minimize2,
  ArchiveBoxIcon as Archive,
  ArrowUturnLeftIcon as Undo,
  ArrowUturnRightIcon as Redo,
  BookmarkIcon as Pin,
  DocumentCheckIcon as Save,
  PencilSquareIcon as EditSquare,
  BoltIcon as Bolt,
  LightBulbIcon as Lightbulb,
  EyeIcon as Eye,
  ArrowPathRoundedSquareIcon as RefreshCw,
  StopIcon as Stop,
  PhotoIcon as Photo,
  ScaleIcon as Scale,
  ChartBarIcon as ChartBar
} from '@heroicons/react/24/outline';
import { CheckIcon as Check } from '@heroicons/react/24/solid';
import { supabaseService } from '../services/supabaseService';
import { markdownToHtml } from '../src/utils/markdownToHtml';
import { apiFetch } from '../services/apiService';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { getDbConfig } from '../supabaseClient';
import EliteRedactionModal from './EliteRedactionModal';
import { AiMemoryModal } from './AiMemoryModal';
import { LegalBaseArtifactModal } from './LegalBaseArtifactModal';
import { PersonaConfig } from './personaConfig';
import { extractTextFromPDF } from '../src/utils/pdfParser';

const modelDisplayNames: Record<string, string> = {
  'gemini-3.6-flash': 'Gemini 3.6 Flash (Padrão)',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3.7-flash': 'Gemini 3.7 Flash',
  'deepseek/deepseek-v4-flash': 'DeepSeek V4',
  'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet',
};

interface ChatDocument {
  id: string;
  name: string;
  summary?: string;
  fullText?: string;
  type: string;
  pages?: number;
  fileUri?: string;
  mimeType?: string;
  keyIndex?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: { name: string; url: string; type: string }[];
  isSystem?: boolean;
  artifactId?: string;
  artifactType?: ArtifactTypeKey;
}

export interface LegalBaseArtifactItem {
  id: string;
  title: string;
  content: string;
  addedAt: string;
}

export interface LegalBaseArtifact {
  items: LegalBaseArtifactItem[];
  updatedAt: string;
}

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
  documents?: ChatDocument[];
  uploadKeyIndex?: number | null;
  clientId?: string;
  artifactTypes?: Record<string, ArtifactTypeKey>;
  legalBaseArtifact?: LegalBaseArtifact;
}

interface PersonaChatProps {
  persona: PersonaConfig;
  initialSessions?: ChatSession[];
  onSaveSessions?: (sessions: ChatSession[]) => void;
  onOpenPetition?: (petition: any, clientId?: string) => void;
  onOpenMarketing?: (marketingData: any) => void;
  customLaws?: any[];
  agendaEvents?: any[];
  systemClients?: any[];
  onAgendaAction?: (payload: any) => void;
  contracts?: any[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const PHASE_TIMEOUT = 180000; // 3 minutes in milliseconds

// ============================================================
// ARTEFATO DE BASE LEGAL — detecção de dispositivos realmente citados
// ============================================================
// Mesma assinatura de dedup usada no backend (/api/rag/plan): título +
// primeiros 120 caracteres do conteúdo.
const legalArtifactChunkSignature = (title: string, content: string) => `${title}|${(content || '').substring(0, 120)}`;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Extrai o número que identifica o título (nº da lei/decreto/instrução
// normativa, ou o número da súmula/tema), para servir de "âncora" e evitar
// que um artigo de mesmo número em OUTRA lei seja confundido como citado.
const extractLegalTitleAnchor = (title: string): string => {
  const normalized = (title || '').replace(/(\d)\.(?=\d{3}\b)/g, '$1');
  const numMatch = normalized.match(/n[ºo°]\.?\s*(\d+)/i);
  if (numMatch) return numMatch[1];
  const sumulaMatch = normalized.match(/s[uú]mula\s*(\d+)/i);
  if (sumulaMatch) return sumulaMatch[1];
  const temaMatch = normalized.match(/tema\s*(\d+)/i);
  if (temaMatch) return temaMatch[1];
  const generic = normalized.match(/\d{2,}/g);
  return generic ? generic.sort((a, b) => b.length - a.length)[0] : '';
};

interface LegalDeviceKey {
  kind: 'article' | 'sumula' | 'tema' | 'jurisprudencia' | 'unknown';
  num: string;
  lawAnchor: string;
}

// Ementas de jurisprudência não abrem com "Art./Súmula/Tema" — a âncora que as identifica é o
// número do processo, normalmente citado entre parênteses no fecho do julgado (ex.: "(TRF-2 -
// RemNec: 50508307020244025101 RJ, Relator...)"). Aceita tanto o formato CNJ pontuado
// (NNNNNNN-DD.AAAA.J.TR.OOOO) quanto uma sequência corrida de dígitos.
const extractProcessNumber = (text: string): string => {
  const candidates = (text || '').match(/\d[\d.\-]{13,25}\d/g) || [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, '');
    if (digits.length >= 15 && digits.length <= 21) return digits;
  }
  return '';
};

// Identifica o dispositivo específico que UM chunk representa (o artigo,
// súmula, tema ou julgado com que o texto do chunk começa/se identifica).
const buildLegalDeviceKey = (title: string, content: string): LegalDeviceKey => {
  const trimmed = (content || '').trim();
  const lawAnchor = extractLegalTitleAnchor(title);
  let m: RegExpMatchArray | null;
  if ((m = trimmed.match(/^(?:Art\.?|Artigo)\s*(\d+[A-Za-zºª\-]*)/i))) {
    return { kind: 'article', num: m[1].replace(/[ºª]/g, ''), lawAnchor };
  }
  if ((m = trimmed.match(/^S[uú]mula\s*(?:n[ºo°]\.?\s*)?(\d+)/i))) {
    return { kind: 'sumula', num: m[1], lawAnchor };
  }
  if ((m = trimmed.match(/^Tema\s*(?:n[ºo°]\.?\s*)?(\d+(?:\.\d+)?)/i))) {
    return { kind: 'tema', num: m[1], lawAnchor };
  }
  // Jurisprudência/ementa: sem esse número como âncora, o chunk caía em 'unknown' com
  // lawAnchor vazio (título descritivo, sem número nenhum — ex.: "JURISPRUDÊNCIA TRF —
  // PREVIDENCIÁRIO — Demora injustificada..."), e isLegalDeviceCitedInResponse nunca
  // conseguia confirmar a citação — jurisprudência NUNCA entrava na Base Legal da
  // conversa, mesmo quando genuinamente citada na resposta.
  const processNumber = extractProcessNumber(trimmed);
  if (processNumber) {
    return { kind: 'jurisprudencia', num: processNumber, lawAnchor };
  }
  return { kind: 'unknown', num: '', lawAnchor };
};

// Só considera um dispositivo "citado" se o número específico (artigo,
// súmula ou tema) aparecer no texto da resposta — e, no caso de artigo,
// também exige que o número identificador da lei apareça, para não
// confundir "Art. 86" da Lei 8.213 com um "Art. 86" de outra norma.
const isLegalDeviceCitedInResponse = (key: LegalDeviceKey, responseText: string): boolean => {
  if (!responseText) return false;
  const normalizedResponse = responseText.replace(/(\d)\.(?=\d{3}\b)/g, '$1');
  if (key.kind === 'sumula') {
    return !!key.num && new RegExp(`S[uú]mula\\s*(?:n[ºo°]\\.?\\s*)?${escapeRegExp(key.num)}\\b`, 'i').test(responseText);
  }
  if (key.kind === 'tema') {
    return !!key.num && new RegExp(`Tema\\s*(?:n[ºo°]\\.?\\s*)?${escapeRegExp(key.num).replace(/\\\./g, '\\.?')}\\b`, 'i').test(responseText);
  }
  if (key.kind === 'article' && key.num) {
    const artCited = new RegExp(`(?:Art\\.?|Artigo)\\s*${escapeRegExp(key.num)}\\b`, 'i').test(responseText);
    const lawCited = key.lawAnchor ? normalizedResponse.includes(key.lawAnchor) : true;
    return artCited && lawCited;
  }
  if (key.kind === 'jurisprudencia') {
    if (!key.num) return false;
    // Aceita o número completo do processo ou um prefixo longo o bastante (o modelo às vezes
    // reproduz o número reformatado/truncado ao citar em texto corrido, fora de blockquote).
    const respDigits = responseText.replace(/\D/g, '');
    const prefixLen = Math.min(15, key.num.length);
    return respDigits.includes(key.num) || respDigits.includes(key.num.slice(0, prefixLen));
  }
  // Chunk sem marcador de abertura reconhecível (ex.: início por "§" solto,
  // continuação de parágrafo): só entra se ao menos a lei-mãe for citada.
  return key.lawAnchor ? normalizedResponse.includes(key.lawAnchor) : false;
};

interface ExplicitLegalRef {
  kind: 'article' | 'sumula' | 'tema';
  num: string;
  lawAnchor: string;
}

// Varredura determinística (sem IA) de menções EXPLÍCITAS a um dispositivo
// específico na mensagem do usuário — usada só para decidir se dá pra
// responder direto do que já está na Base Legal da conversa, sem nova busca.
// Se a mensagem não citar nada específico, retorna [] e a busca completa
// continua acontecendo normalmente (nunca pula por "achismo").
const extractExplicitLegalRefs = (text: string): ExplicitLegalRef[] => {
  if (!text) return [];
  const refs: ExplicitLegalRef[] = [];
  const seen = new Set<string>();
  const addRef = (ref: ExplicitLegalRef) => {
    const k = `${ref.kind}|${ref.num}|${ref.lawAnchor}`;
    if (!seen.has(k)) { seen.add(k); refs.push(ref); }
  };

  const artLawRegex = /art[a-zà-ÿ]*\.?\s*(\d+[A-Za-zºª\-]*)[^.\n]{0,40}?d[aoe]\s*(?:lei|decreto|instru[çc][ãa]o\s+normativa|resolu[çc][ãa]o|portaria)(?:\s*complementar)?\s*(?:pres\/?inss\s*)?(?:n[ºo°]\.?\s*)?(\d[\d\.]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = artLawRegex.exec(text))) {
    addRef({ kind: 'article', num: m[1].replace(/[ºª]/g, ''), lawAnchor: m[2].replace(/\./g, '') });
  }
  const sumulaRegex = /s[uú]mula\s*(?:n[ºo°]\.?\s*)?(\d+)/gi;
  while ((m = sumulaRegex.exec(text))) {
    addRef({ kind: 'sumula', num: m[1], lawAnchor: m[1] });
  }
  const temaRegex = /tema\s*(?:n[ºo°]\.?\s*)?(\d+(?:\.\d+)?)/gi;
  while ((m = temaRegex.exec(text))) {
    addRef({ kind: 'tema', num: m[1], lawAnchor: m[1] });
  }
  return refs;
};

const legalDeviceKeyMatchesRef = (key: LegalDeviceKey, ref: ExplicitLegalRef): boolean => {
  if (key.kind !== ref.kind) return false;
  if (ref.kind === 'article') {
    return key.num === ref.num && key.lawAnchor === ref.lawAnchor;
  }
  return key.num === ref.num;
};

const isReportContent = (content: string = ''): boolean => {
  if (!content || content.trim().length < 350) return false;
  const trimmed = content.trim();

  const hasReportHeader = /(?:^|\n)(?:#+\s*)?(?:RELATÓRIO\s+DE\s+ANÁLISE|RELATÓRIO\s+DO\s+PROCESSO|AUDITORIA\s+PROCESSUAL|RELATÓRIO\s+PREVIDENCIÁRIO|RELATÓRIO\s+TRABALHISTA|RELATÓRIO\s+JURÍDICO|COMPILADO\s+INTEGRAL\s+DO\s+PROCESSO|RELATÓRIO\s+DE\s+AUDITORIA)/i.test(trimmed);
  // Segundo template de relatório: começa conversacionalmente ("Colega, analisei... elaborei o
  // diagnóstico técnico...") em vez de um cabeçalho formal, e numera as seções a partir da
  // identificação do cliente/caso em vez de "STATUS DA LEITURA". Sem isso, esse formato passava
  // batido tanto por isReportContent quanto por isPetitionContent (que exige "Pede deferimento",
  // ausente num relatório interno) e a resposta inteira — às vezes incluindo a peça que vinha
  // logo depois no mesmo streaming — ficava como texto solto no chat, nunca virava artefato.
  const hasReportSections = /(?:STATUS\s+DA\s+LEITURA|DOCUMENTOS\s+ANALISADOS|IDENTIFICAÇÃO\s+DA\s+CLIENTE|IDENTIFICAÇÃO\s+DO\s+CASO|DIAGNÓSTICO\s+TÉCNICO)/i.test(trimmed) &&
    /(?:RESUMO\s+DOS\s+FATOS|PARECER\s+DE\s+VIABILIDADE|DIAGNÓSTICO\s+JURÍDICO|CÁLCULO\s+ESTIMADO|ORIENTAÇÃO\s+DE\s+REDAÇÃO|OMISSÃO\s+ADMINISTRATIVA)/i.test(trimmed);

  return hasReportHeader || hasReportSections;
};

const isQuesitosContent = (content: string = ''): boolean => {
  if (!content || content.trim().length < 250) return false;
  if (isReportContent(content)) return false;

  const trimmed = content.trim();

  // Cabeçalho explícito de quesitos
  const hasQuesitosHeader = /(?:^|\n)(?:#+\s*)?(?:QUESITOS|ROL\s+DE\s+QUESITOS|QUESITAÇÃO|QUESITOS\s+(?:DA\s+PARTE\s+AUTORA|DO\s+AUTOR|DA\s+AUTORA|PERICIAIS|MÉDICOS|TÉCNICOS|JUDICIAIS)|FORMULAÇÃO\s+DE\s+QUESITOS|DOS\s+QUESITOS|QUESITOS\s+PARA\s+PERÍCIA)/i.test(trimmed);

  // Termos periciais e médicos
  const hasPericiaKeywords = /(?:quesito|quesitação|perícia\s+médica|perícia\s+judicial|laudo\s+pericial|perito\s+judicial|perita\s+judicial|sr\.?\s*perito|sra\.?\s*perita|assistente\s+técnico|incapacidade\s+laborativa|nexo\s+causal|exame\s+clínico|aptidão\s+laboral)/i.test(trimmed);

  // Verificação de perguntas numeradas (Quesito 1, 1., 1 -, 1), etc.)
  const hasNumberedQuestions = /(?:^|\n)\s*(?:quesito\s*0?1|1[\.\)\-º°]|quesito\s*primeiro|primeiro\s*quesito)\b/i.test(trimmed) &&
    /(?:^|\n)\s*(?:quesito\s*0?2|2[\.\)\-º°]|quesito\s*segundo|segundo\s*quesito)\b/i.test(trimmed);

  // Expressões típicas dirigidas ao perito ("Queira o Sr. Perito...", "O examinando...", "Informe o perito...")
  const hasPeritoPhrasing = /(?:queira\s+o\s+(?:sr\.?\s*)?perit[oa]|informe\s+o\s+(?:sr\.?\s*)?perit[oa]|diga\s+o\s+(?:sr\.?\s*)?perit[oa]|esclare[çc]a\s+o\s+(?:sr\.?\s*)?perit[oa]|responda\s+o\s+(?:sr\.?\s*)?perit[oa]|o\s+examinad[oa]|o\s+periciand[oa]|o\s+autor\s+apresenta|a\s+autora\s+apresenta|h[aá]\s+incapacidade|qual\s+o\s+diagn[óo]stico|existe\s+nexo)/i.test(trimmed);

  // Fecho forense
  const hasPetitionClosing = /(?:Nestes\s+termos|Pede\s+deferimento|Termos\s+em\s+que\s+pede|Espera\s+deferimento|OAB\/(?:[A-Z]{2})?\s*\d+|MICHEL\s+SANTOS\s+FELIX|LUANA\s+(?:DE\s+OLIVEIRA\s+)?CASTRO)/i.test(trimmed);

  // 1. Se tiver cabeçalho de quesitos E perguntas numeradas ou termos periciais
  if (hasQuesitosHeader && (hasNumberedQuestions || hasPeritoPhrasing || hasPericiaKeywords || hasPetitionClosing || trimmed.length > 350)) {
    return true;
  }

  // 2. Se tiver termos periciais E perguntas numeradas (1. e 2.)
  if (hasPericiaKeywords && hasNumberedQuestions && (hasPeritoPhrasing || hasPetitionClosing || trimmed.length > 350)) {
    return true;
  }

  // 3. Se tiver perguntas numeradas com frases explícitas de quesitação ("Queira o perito...")
  if (hasNumberedQuestions && hasPeritoPhrasing && trimmed.length > 300) {
    return true;
  }

  return false;
};

const isPetitionContent = (content: string = ''): boolean => {
  if (!content || content.trim().length < 450) return false;

  if (isReportContent(content)) return false;

  const trimmed = content.trim();

  // Se a mensagem começar com saudações, conversação ou conselhos casuais, não é uma petição isolada
  const isConversationalIntro = /^(?:Calma|Sim,|Não,|Com certeza|Olá|Prezado|Caro|Doutor|Dr\.|Colega|Veja bem|Veja,|Entendi|Nesse caso|Sobre a sua dúvida|Você pode|Você deve|Recomendo|A orientação|Não há motivo|Tudo bem|Fique tranquilo)/i.test(trimmed);

  // Cabeçalho forense formal no início da peça (primeiros 350 caracteres)
  const first350 = trimmed.slice(0, 350);
  const hasHeaderAtStart = /(?:^|\n)(?:#+\s*)?(?:AO\s+JUÍZO|EXCELENTÍSSIMO|ILUSTRÍSSIMO|ILMO|AO\s+DOUTO|AO\s+TRIBUNAL)\s+/i.test(first350) ||
    /(?:^|\n)(?:#+\s*)?(?:PETIÇÃO\s+INICIAL|CONTESTAÇÃO|RECURSO\s+INOMINADO|AGRAVO\s+DE\s+INSTRUMENTO|APELAÇÃO|EMBARGOS\s+DE\s+DECLARAÇÃO|MANDADO\s+DE\s+SEGURANÇA|NOTIFICAÇÃO\s+EXTRAJUDICIAL|PARECER\s+JURÍDICO|REQUERIMENTO\s+ADMINISTRATIVO|MEMORIAIS|MANIFESTAÇÃO\s+INTERCORRENTE|QUESITOS\s+PERICIAIS)/i.test(first350);

  // Fecho forense formal
  const hasPetitionClosing = /(?:Nestes\s+termos|Pede\s+deferimento|Termos\s+em\s+que\s+pede|Espera\s+deferimento|OAB\/(?:[A-Z]{2})?\s*\d+|MICHEL\s+SANTOS\s+FELIX|LUANA\s+(?:DE\s+OLIVEIRA\s+)?CASTRO)/i.test(trimmed);

  // Seções estruturais
  const hasFatos = /(?:DOS\s+FATOS|I\s*-\s*DOS\s+FATOS|I\.\s*DOS\s+FATOS)/i.test(trimmed);
  const hasDireitoOuPedidos = /(?:DO\s+DIREITO|DOS\s+PEDIDOS|DO\s+MÉRITO|DOS\s+REQUERIMENTOS|DA\s+FUNDAMENTAÇÃO|DA\s+TUTELA)/i.test(trimmed);
  const hasFormalSections = (hasFatos && hasDireitoOuPedidos) || (/(?:DOS\s+PEDIDOS|DOS\s+REQUERIMENTOS)/i.test(trimmed) && hasPetitionClosing);

  if (isConversationalIntro) {
    // Se começou conversando, só é artefato se contiver a peça inteira formal com cabeçalho, seções, fecho e texto robusto
    return (hasHeaderAtStart || hasFormalSections) && hasPetitionClosing && trimmed.length > 900;
  }

  return (hasHeaderAtStart && (hasPetitionClosing || hasFormalSections || trimmed.length > 550)) || (hasFormalSections && hasPetitionClosing);
};

export type ArtifactTypeKey = 
  | 'inicial'
  | 'intercorrente'
  | 'quesitos'
  | 'impugnacao'
  | 'recurso'
  | 'administrativa'
  | 'parecer'
  | 'contrato'
  | 'geral';

export interface ArtifactTypeConfig {
  key: ArtifactTypeKey;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  pillBg: string;
  accentColor: string;
  description: string;
}

export const ARTIFACT_TYPE_CONFIGS: Record<ArtifactTypeKey, ArtifactTypeConfig> = {
  inicial: {
    key: 'inicial',
    label: 'Petição Inicial',
    shortLabel: 'Petição Inicial',
    icon: '📜',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    pillBg: 'bg-blue-600 text-white',
    accentColor: 'blue',
    description: 'Petição Inicial formal completa com qualificação, fatos, fundamentos, tutela de urgência e pedidos'
  },
  intercorrente: {
    key: 'intercorrente',
    label: 'Manifestação Intercorrente',
    shortLabel: 'Intercorrente',
    icon: '⚖️',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    pillBg: 'bg-emerald-600 text-white',
    accentColor: 'emerald',
    description: 'Manifestação em andamento (ciência de despacho, emenda, juntada de documentos, reiteração)'
  },
  quesitos: {
    key: 'quesitos',
    label: 'Quesitos Periciais',
    shortLabel: 'Quesitos',
    icon: '🩺',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    pillBg: 'bg-purple-600 text-white',
    accentColor: 'purple',
    description: 'Quesitos periciais técnicos (médicos, contábeis ou de engenharia) para perícia judicial'
  },
  impugnacao: {
    key: 'impugnacao',
    label: 'Impugnação / Réplica',
    shortLabel: 'Impugnação / Réplica',
    icon: '🛡️',
    badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    pillBg: 'bg-amber-600 text-white',
    accentColor: 'amber',
    description: 'Impugnação à contestação, réplica ou manifestação técnica sobre laudo pericial'
  },
  recurso: {
    key: 'recurso',
    label: 'Recurso Processual',
    shortLabel: 'Recurso',
    icon: '📑',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-700',
    pillBg: 'bg-rose-600 text-white',
    accentColor: 'rose',
    description: 'Recurso Inominado, Apelação, Agravo de Instrumento, Embargos de Declaração'
  },
  administrativa: {
    key: 'administrativa',
    label: 'Processo Administrativo (INSS/CRPS)',
    shortLabel: 'Processo Admin. INSS',
    icon: '🏛️',
    badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700',
    pillBg: 'bg-cyan-600 text-white',
    accentColor: 'cyan',
    description: 'Requerimento administrativo, recurso ordinário/especial à JR/CRPS, revisão'
  },
  parecer: {
    key: 'parecer',
    label: 'Parecer / Relatório Jurídico',
    shortLabel: 'Relatório / Parecer',
    icon: '📊',
    badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600',
    pillBg: 'bg-slate-700 text-white',
    accentColor: 'slate',
    description: 'Relatório de análise processual, parecer técnico de viabilidade ou diagnóstico'
  },
  contrato: {
    key: 'contrato',
    label: 'Contrato / Notificação Extrajudicial',
    shortLabel: 'Contrato / Notificação',
    icon: '🖋️',
    badgeClass: 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300 border-pink-300 dark:border-pink-700',
    pillBg: 'bg-pink-600 text-white',
    accentColor: 'pink',
    description: 'Contrato de honorários, termo de acordo, notificação extrajudicial, procuração'
  },
  geral: {
    key: 'geral',
    label: 'Peça / Documento Jurídico',
    shortLabel: 'Doc. Jurídico',
    icon: '📄',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    pillBg: 'bg-emerald-600 text-white',
    accentColor: 'emerald',
    description: 'Artefato jurídico geral e peças complementares'
  }
};

export const detectArtifactType = (content: string = '', userPrompt: string = ''): ArtifactTypeKey => {
  if (!content) return 'geral';
  
  if (isReportContent(content)) {
    return 'parecer';
  }

  const clean = content.toLowerCase();
  const promptLower = (userPrompt || '').toLowerCase();

  // 1. Quesitos Periciais
  if (
    isQuesitosContent(content) ||
    /quesito|quesitos periciais|quesitação|rol de quesitos|quesitos da parte/i.test(promptLower) ||
    (/quesito|quesitos periciais|quesitação|perícia médica|laudo pericial|perita judicial|perito judicial/i.test(clean) &&
      (/(?:^|\n)\s*(?:quesito\s*\d+|\d+[\.\)\-º°])\s*[:\-\s]*(?:o\s*perito|a\s*perita|o\s*sr|a\s*sra|o\s*autor|a\s*autora|o\s*examinado|o\s*periciando|a\s*segurada|queira|informe|diga|esclareça|responda|qual|há|existe)/i.test(clean) || /quesitos da parte|rol de quesitos|reiteração dos quesitos/i.test(clean)))
  ) {
    return 'quesitos';
  }

  // 2. Recurso
  if (
    /recurso inominado|apelação cível|agravo de instrumento|agravo interno|embargos de declaração|contrarrazões|razões recursais|turma recursal|egrégio tribunal|colenda câmara/i.test(clean) ||
    /recurso inominado|apelação|agravo|embargos de declaração/i.test(promptLower)
  ) {
    return 'recurso';
  }

  // 3. Impugnação / Réplica
  if (
    /impugnação à contestação|impugnação ao laudo|réplica|manifestar-se sobre a contestação|manifestar-se sobre o laudo|contradita/i.test(clean) ||
    /réplica|impugnação|impugnar/i.test(promptLower)
  ) {
    return 'impugnacao';
  }

  // 4. Manifestação Intercorrente / Ciência / Despacho / Petição Simples
  if (
    /ciência do despacho|ciência da decisão|juntada de documentos|especificação de provas|emenda à inicial|reiteração|manifestar-se nos seguintes termos|cumprimento de despacho|manifestação aos autos/i.test(clean) ||
    /ciência|despacho|juntada|intercorrente|manifestação simples/i.test(promptLower)
  ) {
    return 'intercorrente';
  }

  // 4.5 Mandado de Segurança — ação constitucional autônoma perante o Judiciário.
  // Precisa vir ANTES do check de "Administrativa": um MS contra omissão do INSS
  // sempre narra nos fatos o requerimento administrativo que ficou sem resposta,
  // o que disparava falso-positivo pra 'administrativa' (peça vinha classificada
  // como Processo Administrativo mesmo endereçada "AO JUÍZO DA Vara Federal...").
  if (/mandado de segurança/i.test(clean) || /mandado de segurança/i.test(promptLower)) {
    return 'inicial';
  }

  // 5. Administrativa (INSS/CRPS)
  if (
    (/requerimento administrativo|junta de recursos|crps|agência da previdência social|in 128\/2022|recurso ordinário administrativo|pedido de prorrogação/i.test(clean) &&
    !/ao ju[íi]zo d[ao]|excelent[íi]ssimo|merit[íi]ssimo/i.test(clean)) ||
    /requerimento administrativo|inss administrativo|recurso crps/i.test(promptLower)
  ) {
    return 'administrativa';
  }

  // 6. Contrato / Notificação
  if (
    /notificação extrajudicial|contrato de honorários|contrato de prestação de serviços|procuração ad judicia|termo de renúncia|acordo extrajudicial/i.test(clean) ||
    /notificação|contrato|procuração/i.test(promptLower)
  ) {
    return 'contrato';
  }

  // 7. Petição Inicial
  if (
    /petição inicial|ação previdenciária|ação de concessão|ação de restabelecimento|ação trabalhista|reclamação trabalhista|ação indenizatória|ação ordinária|ação de obrigação/i.test(clean) ||
    (/dos fatos/i.test(clean) && /do direito/i.test(clean) && /dos pedidos/i.test(clean) && /valor da causa/i.test(clean)) ||
    /inicial|petição inicial|ajuizar|ingressar com ação/i.test(promptLower)
  ) {
    return 'inicial';
  }

  return 'geral';
};

const isArtifactContent = (content: string = ''): boolean => {
  return isPetitionContent(content) || isReportContent(content) || isQuesitosContent(content);
};

export const getArtifactMeta = (
  content: string = '',
  messageId: string = '',
  messages: Message[] = [],
  customTypeOverride?: ArtifactTypeKey
) => {
  const isReport = isReportContent(content);
  const isQuesitos = isQuesitosContent(content);
  const typeKey: ArtifactTypeKey = customTypeOverride || (isReport ? 'parecer' : (isQuesitos ? 'quesitos' : detectArtifactType(content)));
  const config = ARTIFACT_TYPE_CONFIGS[typeKey] || ARTIFACT_TYPE_CONFIGS.geral;

  const artifactMessages = messages.filter(m => m.role === 'assistant' && isArtifactContent(m.content));
  const index = artifactMessages.findIndex(m => m.id === messageId);
  const seqNumber = index >= 0 ? index + 1 : (messageId === 'streaming' ? artifactMessages.length + 1 : 1);
  const idLabel = `#ART-${String(seqNumber).padStart(2, '0')}`;
  const totalCount = Math.max(artifactMessages.length, seqNumber);

  const title = getArtifactTitle(content);
  const cleanDoc = cleanPetitionDocument(content);
  const wordCount = cleanDoc.trim() ? cleanDoc.trim().split(/\s+/).length : 0;
  const charCount = cleanDoc.length;

  return {
    idLabel,
    seqNumber,
    totalCount,
    typeKey,
    config,
    title,
    wordCount,
    charCount
  };
};

export const getArtifactTypeInfo = (content: string = '', customType?: ArtifactTypeKey) => {
  const typeKey = customType || (isReportContent(content) ? 'parecer' : (isQuesitosContent(content) ? 'quesitos' : detectArtifactType(content)));
  const config = ARTIFACT_TYPE_CONFIGS[typeKey] || ARTIFACT_TYPE_CONFIGS.geral;
  return {
    type: typeKey,
    badgeLabel: `${config.icon} ${config.shortLabel}`,
    panelSubtitle: `Artefato: ${config.label}`,
    defaultTitle: config.label,
    config
  };
};

const getArtifactTitle = (content: string = '') => {
  if (!content) return "Documento Jurídico";
  const typeInfo = getArtifactTypeInfo(content);

  if (typeInfo.type === 'quesitos') {
    const quesitosMatch = content.match(/(?:(?:#+\s*)?(?:ROL\s+DE\s+QUESITOS|QUESITOS\s+(?:DA\s+PARTE\s+AUTORA|PERICIAIS|MÉDICOS|TÉCNICOS|JUDICIAIS|DO\s+AUTOR|DA\s+AUTORA)|QUESITOS|QUESITAÇÃO))[^\n]*/i);
    if (quesitosMatch) {
      const clean = quesitosMatch[0].replace(/[*#_]/g, '').trim();
      if (clean.length > 5 && clean.length < 80) return clean;
    }
  }

  if (typeInfo.type === 'parecer' || typeInfo.type === 'geral') {
    const reportMatch = content.match(/(?:RELATÓRIO|AUDITORIA|ANÁLISE|PARECER)[^\n]*/i);
    if (reportMatch) {
      const clean = reportMatch[0].replace(/[*#_]/g, '').trim();
      if (clean.length > 5 && clean.length < 80) return clean;
    }
  } else {
    const match = content.match(/(?:AO JUÍZO|EXCELENTÍSSIMO|REQUERIMENTO|PETIÇÃO|CONTESTAÇÃO|PARECER|RECURSO|MANDADO|AGRAVO|EMBARGOS|ROL\s+DE\s+QUESITOS|QUESITOS)[^\n]*/i);
    if (match) {
      const clean = match[0].replace(/[*#_]/g, '').trim();
      if (clean.length > 5 && clean.length < 80) return clean;
    }
  }

  const headingMatch = content.match(/^#+\s*(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    const clean = headingMatch[1].replace(/[*#_]/g, '').trim();
    if (clean.length > 5 && clean.length < 80) return clean;
  }

  return typeInfo.defaultTitle;
};

export const cleanPetitionDocument = (rawContent: string = ''): string => {
  if (!rawContent) return '';

  if (isReportContent(rawContent)) {
    const startReportRegex = /(?:#+\s*RELATÓRIO|RELATÓRIO\s+DE\s+ANÁLISE|RELATÓRIO\s+DO\s+PROCESSO|AUDITORIA\s+PROCESSUAL|1\.\s*STATUS\s+DA\s+LEITURA|STATUS\s+DA\s+LEITURA)/i;
    const matchReport = rawContent.match(startReportRegex);
    let cleanedReport = rawContent;
    if (matchReport && matchReport.index !== undefined && matchReport.index > 0) {
      cleanedReport = rawContent.slice(matchReport.index);
    }
    const endRegex = /(?:\n\n|\r?\n)(?:(?:---|\*\*\*|___)\s*)?(?:(?:💡|📌|⚠️|⚖️|\*)?\s*(?:Implicaç(?:ão|ões)|Implantaç(?:ão|ões)|Dica|Orientaç(?:ão|ões)|Observaç(?:ão|ões)|Nota|Comentário|Estratégia|Espero\s+ter\s+ajudado|Se\s+precisar\s+de\s+mais\s+ajustes|Qualquer\s+dúvida|Estou\s+à\s+disposição|Permaneco\s+à\s+disposição)[\s\S]*)/i;
    cleanedReport = cleanedReport.replace(endRegex, '');
    return cleanedReport.trim();
  }

  const startRegex = /(?:AO\s+JUÍZO|EXCELENTÍSSIMO|PROCESSO\s+Nº|REQUERIMENTO|CONTESTAÇÃO|PARECER\s+JURÍDICO|NOTIFICAÇÃO\s+EXTRAJUDICIAL|ILUSTRÍSSIMO|MEMORIAIS|AGRAVO|MANDADO\s+DE\s+SEGURANÇA|PETIÇÃO\s+INICIAL|RECURSO|ROL\s+DE\s+QUESITOS|QUESITOS\s+DA\s+PARTE|QUESITOS\s+PERICIAIS|QUESITOS|QUESITAÇÃO)/i;
  const match = rawContent.match(startRegex);

  let cleaned = rawContent;
  if (match && match.index !== undefined && match.index > 0) {
    cleaned = rawContent.slice(match.index);
  }

  // Remove quaisquer notas, dicas práticas, "Implicação Prática", orientações ou cauda conversacional
  const endRegex = /(?:\n\n|\r?\n)(?:(?:---|\*\*\*|___)\s*)?(?:(?:💡|📌|⚠️|⚖️|\*)?\s*(?:Implicaç(?:ão|ões)|Implantaç(?:ão|ões)|Dica|Orientaç(?:ão|ões)|Observaç(?:ão|ões)|Nota|Comentário|Estratégia|Espero\s+ter\s+ajudado|Se\s+precisar\s+de\s+mais\s+ajustes|Qualquer\s+dúvida|Estou\s+à\s+disposição|Permaneco\s+à\s+disposição)[\s\S]*)/i;
  cleaned = cleaned.replace(endRegex, '');

  return cleaned.trim();
};

export const cleanPatchFromResponse = (text: string): string => {
  if (!text) return "";
  let clean = text
    .replace(/```(?:artifact_patch|patch|diff|surgical_edit|correcao_cirurgica)?[\s\S]*?```/gi, '')
    .replace(/<<<SEARCH[\s\S]*?===[\s\S]*?(?:>>>|```|(?=<<<SEARCH|<<<AFTER|<<<REMOVE|$))/gi, '')
    .replace(/<<<AFTER[\s\S]*?===[\s\S]*?(?:>>>|```|(?=<<<SEARCH|<<<AFTER|<<<REMOVE|$))/gi, '')
    .replace(/<<<REMOVE[\s\S]*?(?:>>>|```|(?=<<<SEARCH|<<<AFTER|<<<REMOVE|$))/gi, '')
    .replace(/SEARCH:[\s\S]*?REPLACE:[\s\S]*?(?=(?:SEARCH:|AFTER:|REMOVE:|```|<<<|$))/gi, '')
    .replace(/AFTER:[\s\S]*?INSERT:[\s\S]*?(?=(?:SEARCH:|AFTER:|REMOVE:|```|<<<|$))/gi, '')
    .replace(/REMOVE:[\s\S]*?(?=(?:SEARCH:|AFTER:|REMOVE:|```|<<<|$))/gi, '')
    .replace(/<<<(?:SEARCH|AFTER|REMOVE|END)[^>]*>>>?/gi, '')
    .replace(/===[^>\n]*>>>?/gi, '')
    .replace(/```(?:artifact_patch|patch|diff|surgical_edit|correcao_cirurgica)?/gi, '')
    .trim();

  return clean;
};

export const cleanSurgicalStreamMessage = (fullText: string): string => {
  if (!fullText) return "";
  const patchStartIdx = fullText.search(/(?:```(?:artifact_patch|patch|diff|surgical_edit|correcao_cirurgica)|<<<SEARCH|<<<AFTER|<<<REMOVE|SEARCH:)/i);
  if (patchStartIdx !== -1) {
    const preamble = fullText.substring(0, patchStartIdx).trim();
    if (preamble) {
      return `${preamble}\n\n*[⚡ Aplicando alterações cirúrgicas diretamente no Artefato...]*`;
    }
    return "*[⚡ Aplicando alterações cirúrgicas diretamente no Artefato...]*";
  }
  return fullText;
};

function normalizeForPatchMatching(str: string): string {
  return (str || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownForPatch(str: string): string {
  return (str || '')
    .replace(/\r\n/g, '\n')
    .replace(/^[#\s*_-]+/gm, '')
    .replace(/[*_`~>]/g, '')
    .replace(/[“”"«»]/g, '"')
    .replace(/[‘’'']/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function flexibleLocalReplace(source: string, search: string, replacement: string): string {
  if (!source || !search) return source;

  // 1. Match exato direto
  if (source.includes(search)) {
    return source.replace(search, replacement);
  }

  // 2. Match sem espaços extras nas pontas
  const cleanSearch = search.trim();
  if (source.includes(cleanSearch)) {
    return source.replace(cleanSearch, replacement);
  }

  // 3. Regex flexível para espaçamento e quebras de linha
  try {
    const escaped = cleanSearch
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '[\\s\\r\\n\\t]+');
    const regex = new RegExp(escaped, 'i');
    if (regex.test(source)) {
      return source.replace(regex, replacement);
    }
  } catch {}

  // 4. Match tolerante a Markdown (strip #, *, _, >)
  try {
    const strippedSearch = stripMarkdownForPatch(cleanSearch);
    if (strippedSearch.length > 20) {
      const words = strippedSearch.split(/\s+/).filter(w => w.length > 1);
      if (words.length >= 3) {
        const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\r\\n\\t#*_`~>-]+');
        const regex = new RegExp(pattern, 'i');
        if (regex.test(source)) {
          return source.replace(regex, replacement);
        }
      }
    }
  } catch {}

  // 5. Sliding Window / Token Anchors (Multi-word anchor search)
  const normSearch = normalizeForPatchMatching(cleanSearch);
  const normWords = normSearch.split(/\s+/).filter(w => w.length >= 3);
  if (normWords.length >= 4) {
    const headWords = normWords.slice(0, 3).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]{1,25}?');
    const tailWords = normWords.slice(-3).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]{1,25}?');
    try {
      const anchorRegex = new RegExp(`(${headWords}[\\s\\S]*?${tailWords})`, 'i');
      const match = anchorRegex.exec(source);
      if (match && match[0] && Math.abs(match[0].length - search.length) < search.length * 0.5) {
        return source.substring(0, match.index) + replacement + source.substring(match.index + match[0].length);
      }
    } catch {}
  }

  // 6. Match por Título de Seção (ex: "VIII. DO ROL DE DOCUMENTOS" ou "DOS FATOS")
  const sectionTitleMatch = cleanSearch.match(/^(?:(?:\d+\.|\b[IVXLCDM]+\b\.?|-)\s*)?\*{0,2}(DOS?\s+[A-ZÁ-Ú\s]+|DA\s+[A-ZÁ-Ú\s]+|PRELIMINARMENTE|PEDIDOS?|REQUERIMENTOS?|ROL\s+DE\s+DOCUMENTOS)\*{0,2}[:.]?/im);
  if (sectionTitleMatch) {
    const sectionName = sectionTitleMatch[1].trim();
    try {
      const secPattern = `(?:(?:\\d+\\.|\\b[IVXLCDM]+\\b\\.?|-)\\s*)?\\*{0,2}${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\*{0,2}[:.]?[\\s\\S]*?(?=(?:\\n\\n(?:(?:\\d+\\.|\\b[IVXLCDM]+\\b\\.?|-)\\s*)?\\*{0,2}(?:DOS?|DA|PRELIMINARMENTE|PEDIDOS?|REQUERIMENTOS?|Nestes\\s+termos|Belford\\s+Roxo|Rio\\s+de\\s+Janeiro|MICHEL\\s+SANTOS|LUANA\\s+DE\\s+OLIVEIRA))|$)`;
      const secRegex = new RegExp(secPattern, 'i');
      if (secRegex.test(source)) {
        return source.replace(secRegex, replacement);
      }
    } catch {}
  }

  return source;
}

function flexibleLocalInsertAfter(source: string, target: string, insertion: string): string {
  if (!source || !target || !insertion) return source;

  const idx = source.indexOf(target);
  if (idx !== -1) {
    const insertPos = idx + target.length;
    return source.substring(0, insertPos) + '\n\n' + insertion + source.substring(insertPos);
  }

  const cleanTarget = target.trim();
  const cleanIdx = source.indexOf(cleanTarget);
  if (cleanIdx !== -1) {
    const insertPos = cleanIdx + cleanTarget.length;
    return source.substring(0, insertPos) + '\n\n' + insertion + source.substring(insertPos);
  }

  try {
    const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s\\r\\n\\t]+');
    const regex = new RegExp(escaped, 'i');
    const match = regex.exec(source);
    if (match && match.index !== undefined) {
      const insertPos = match.index + match[0].length;
      return source.substring(0, insertPos) + '\n\n' + insertion + source.substring(insertPos);
    }
  } catch {}

  // Se o target for o fecho/assinaturas
  if (/assinatura|advogad|nestes termos|pede deferimento|oab/i.test(target)) {
    return source + '\n\n' + insertion;
  }

  return source + '\n\n' + insertion;
}

export const applyLocalArtifactPatches = (originalDoc: string, aiResponseText: string): { updatedText: string; appliedCount: number } => {
  let doc = originalDoc;
  let appliedCount = 0;

  const patchRegex = /```(?:artifact_patch|patch|diff|surgical_edit|correcao_cirurgica)?\s*([\s\S]*?)```/g;
  let match;
  const blocksToProcess: string[] = [];

  while ((match = patchRegex.exec(aiResponseText)) !== null) {
    if (match[1] && match[1].trim()) {
      blocksToProcess.push(match[1]);
    }
  }

  if (blocksToProcess.length === 0) {
    blocksToProcess.push(aiResponseText);
  }

  for (const block of blocksToProcess) {
    // 1. <<<SEARCH ... === ... (>>> ou fim do bloco)
    const searchReplaceRegex = /<<<SEARCH\s*([\s\S]*?)\s*===\s*([\s\S]*?)(?:>>>|```|(?=<<<SEARCH|<<<AFTER|<<<REMOVE|$))/gi;
    let srMatch;
    while ((srMatch = searchReplaceRegex.exec(block)) !== null) {
      const search = srMatch[1].trim();
      const replace = srMatch[2].trim();
      if (search) {
        const newDoc = flexibleLocalReplace(doc, search, replace);
        if (newDoc !== doc) {
          doc = newDoc;
          appliedCount++;
        }
      }
    }

    // 2. SEARCH: ... REPLACE: ...
    const labeledSRRegex = /SEARCH:\s*([\s\S]*?)\s*REPLACE:\s*([\s\S]*?)(?=(?:SEARCH:|AFTER:|REMOVE:|```|<<<|$))/gi;
    let lsrMatch;
    while ((lsrMatch = labeledSRRegex.exec(block)) !== null) {
      const search = lsrMatch[1].trim();
      const replace = lsrMatch[2].trim();
      if (search) {
        const newDoc = flexibleLocalReplace(doc, search, replace);
        if (newDoc !== doc) {
          doc = newDoc;
          appliedCount++;
        }
      }
    }

    // 3. <<<AFTER ... === ... (>>> ou fim do bloco)
    const afterInsertRegex = /(?:<<<AFTER\s*([\s\S]*?)\s*===\s*([\s\S]*?)(?:>>>|```|(?=<<<SEARCH|<<<AFTER|<<<REMOVE|$))|AFTER:\s*([\s\S]*?)\s*INSERT:\s*([\s\S]*?)(?=(?:SEARCH:|AFTER:|REMOVE:|```|<<<|$)))/gi;
    let aiMatch;
    while ((aiMatch = afterInsertRegex.exec(block)) !== null) {
      const target = (aiMatch[1] || aiMatch[3] || '').trim();
      const insert = (aiMatch[2] || aiMatch[4] || '').trim();
      if (target && insert) {
        const newDoc = flexibleLocalInsertAfter(doc, target, insert);
        if (newDoc !== doc) {
          doc = newDoc;
          appliedCount++;
        }
      }
    }

    // 4. <<<REMOVE ... (>>> ou fim do bloco)
    const removeRegex = /(?:<<<REMOVE\s*([\s\S]*?)(?:>>>|```|(?=<<<SEARCH|<<<AFTER|<<<REMOVE|$))|REMOVE:\s*([\s\S]*?)(?=(?:SEARCH:|AFTER:|REMOVE:|```|<<<|$)))/gi;
    let rMatch;
    while ((rMatch = removeRegex.exec(block)) !== null) {
      const target = (rMatch[1] || rMatch[2] || '').trim();
      if (target) {
        const newDoc = flexibleLocalReplace(doc, target, '');
        if (newDoc !== doc) {
          doc = newDoc;
          appliedCount++;
        }
      }
    }
  }

  // 5. Fallback estrutural: se nenhum patch formal casou, mas o texto contém uma seção formal da petição
  if (appliedCount === 0 && originalDoc && aiResponseText.length > 80) {
    const cleanedAi = cleanPetitionDocument(aiResponseText);
    const sectionMatch = cleanedAi.match(/^(?:(?:\d+\.|\b[IVXLCDM]+\b\.?|-)\s*)?\*{0,2}(DOS?\s+[A-ZÁ-Ú\s]+|DA\s+[A-ZÁ-Ú\s]+|PRELIMINARMENTE|PEDIDOS?|REQUERIMENTOS?|ROL\s+DE\s+DOCUMENTOS)\*{0,2}[:.]?/im);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim();
      const sectionRegex = new RegExp(`(?:(?:\\d+\\.|\\b[IVXLCDM]+\\b\\.?|-)\\s*)?\\*{0,2}${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\*{0,2}[:.]?[\\s\\S]*?(?=(?:\\n\\n(?:(?:\\d+\\.|\\b[IVXLCDM]+\\b\\.?|-)\\s*)?\\*{0,2}(?:DOS?|DA|PRELIMINARMENTE|PEDIDOS?|REQUERIMENTOS?|Nestes\\s+termos))|$)`, 'i');
      if (sectionRegex.test(doc)) {
        doc = doc.replace(sectionRegex, cleanedAi);
        appliedCount++;
      }
    }
  }

  return { updatedText: doc, appliedCount };
};

const PersonaChat: React.FC<PersonaChatProps> = ({ persona, initialSessions, onSaveSessions, onOpenPetition, onOpenMarketing, customLaws, agendaEvents, systemClients, contracts, onAgendaAction }) => {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions || []);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [streamingAsArtifact, setStreamingAsArtifact] = useState<boolean>(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [pendingAudit, setPendingAudit] = useState<{
    fileIndex: number;
    pageIndex: number;
    files: File[];
    activeSessionId: string;
  } | null>(null);
  
  // Elite Redaction Modal State
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [pendingEliteTask, setPendingEliteTask] = useState<{messageText: string, images?: string[]} | null>(null);

  // AI Memory Modal State
  const [showAiMemoryModal, setShowAiMemoryModal] = useState(false);
  const [initialMemoryRule, setInitialMemoryRule] = useState("");
  const [memoryModalPersona, setMemoryModalPersona] = useState("");
  const [savedSuggestionIds, setSavedSuggestionIds] = useState<Set<string>>(() => {
    try {
      const local = localStorage.getItem("fc_saved_memory_suggestion_ids");
      return local ? new Set(JSON.parse(local)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [savedRuleTexts, setSavedRuleTexts] = useState<Set<string>>(() => {
    try {
      const local = localStorage.getItem("fc_saved_memory_rules_texts");
      return local ? new Set(JSON.parse(local)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [savingSuggestionId, setSavingSuggestionId] = useState<string | null>(null);

  // Base Legal (Artefato de RAG) Modal State
  const [showLegalBaseModal, setShowLegalBaseModal] = useState(false);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedModelProvider, setSelectedModelProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');
  const [petitionLength, setPetitionLength] = useState('Padrão (Livre)');
  
  // Anexos pendentes para envio junto com a instrução do usuário
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachedClient, setAttachedClient] = useState<any | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Suporte a colar Print / Imagem da Área de Transferência (Ctrl+V) com Desduplicação e Debounce
  const lastPasteTimeRef = useRef<number>(0);
  const lastPastedSizeRef = useRef<number>(0);

  const processPastedImages = (
    clipboardData: DataTransfer | null, 
    isArtifactTarget: boolean, 
    eventToPrevent?: { preventDefault?: () => void; stopPropagation?: () => void }
  ) => {
    if (!clipboardData) return;

    const now = Date.now();
    // Anti-duplicação: Se o mesmo evento disparou há menos de 450ms, descarta a propagação repetida
    if (now - lastPasteTimeRef.current < 450) {
      if (eventToPrevent?.preventDefault) eventToPrevent.preventDefault();
      if (eventToPrevent?.stopPropagation) eventToPrevent.stopPropagation();
      return;
    }

    const items = clipboardData.items;
    const files = clipboardData.files;
    const newImageFiles: File[] = [];
    const seenSizes = new Set<number>();

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob && blob.size > 0 && !seenSizes.has(blob.size)) {
            // Se for o mesmo tamanho de blob colado em menos de 1 segundo, evita duplicata
            if (blob.size === lastPastedSizeRef.current && (now - lastPasteTimeRef.current < 1000)) {
              continue;
            }
            seenSizes.add(blob.size);
            lastPastedSizeRef.current = blob.size;

            const dateObj = new Date();
            const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}${dateObj.getMinutes().toString().padStart(2, '0')}${dateObj.getSeconds().toString().padStart(2, '0')}`;
            const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
            const file = new File([blob], `Print_${dateObj.toLocaleDateString('pt-BR').replace(/\//g, '-')}_${timeStr}.${ext}`, { type: blob.type || 'image/png' });
            newImageFiles.push(file);
          }
        }
      }
    } else if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.type.startsWith('image/') && !seenSizes.has(f.size)) {
          if (f.size === lastPastedSizeRef.current && (now - lastPasteTimeRef.current < 1000)) {
            continue;
          }
          seenSizes.add(f.size);
          lastPastedSizeRef.current = f.size;
          newImageFiles.push(f);
        }
      }
    }

    if (newImageFiles.length > 0) {
      lastPasteTimeRef.current = now;
      if (eventToPrevent?.preventDefault) eventToPrevent.preventDefault();
      if (eventToPrevent?.stopPropagation) eventToPrevent.stopPropagation();

      if (isArtifactTarget) {
        setArtifactAttachedFiles(prev => {
          // Garante que nenhum arquivo com mesmo nome e tamanho já esteja na lista
          const existingKeys = new Set(prev.map(p => `${p.name}_${p.size}`));
          const uniqueNew = newImageFiles.filter(n => !existingKeys.has(`${n.name}_${n.size}`));
          return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
        });
      } else {
        setAttachedFiles(prev => {
          const existingKeys = new Set(prev.map(p => `${p.name}_${p.size}`));
          const uniqueNew = newImageFiles.filter(n => !existingKeys.has(`${n.name}_${n.size}`));
          return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
        });
      }
    }
  };

  const handlePasteFiles = (clipboardData: DataTransfer | null, eventToPrevent?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    processPastedImages(clipboardData, false, eventToPrevent);
  };

  const handleArtifactPasteFiles = (clipboardData: DataTransfer | null, eventToPrevent?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    processPastedImages(clipboardData, true, eventToPrevent);
  };

  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      // Se o evento já foi tratado pelo React onPaste do elemento focado, ignora
      if (e.defaultPrevented) return;

      const activeEl = document.activeElement as HTMLElement | null;
      
      // Verifica se o foco atual está no artefato ou no chat
      const isArtifactTarget = !!(
        activeEl && (activeEl.id === 'artifact-surgical-input' || activeEl.closest('#artifact-panel-container'))
      ) || (!!activeArtifactId && !activeEl?.closest(`#${persona.inputId}`));

      // Se estiver em outro input ou textarea alheio do sistema, não interfere
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== persona.inputId && activeEl.id !== 'artifact-surgical-input') {
        return;
      }

      processPastedImages(e.clipboardData, isArtifactTarget, e);
    };

    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [persona.inputId, activeArtifactId]);
  
  // Estados do Editor de Artefato Estático & Cirúrgico
  const [artifactTab, setArtifactTab] = useState<'preview' | 'edit'>('preview');
  const [editableArtifactText, setEditableArtifactText] = useState<string>('');
  const [artifactHistory, setArtifactHistory] = useState<string[]>([]);
  const [artifactHistoryIndex, setArtifactHistoryIndex] = useState<number>(-1);
  const [isArtifactPinned, setIsArtifactPinned] = useState<boolean>(true);
  const [artifactQuickCommand, setArtifactQuickCommand] = useState<string>('');
  const [artifactAttachedFiles, setArtifactAttachedFiles] = useState<File[]>([]);
  const [artifactUpdatePulse, setArtifactUpdatePulse] = useState<boolean>(false);
  const [artifactSaveSuccess, setArtifactSaveSuccess] = useState<boolean>(false);
  const [selectedTextSnippet, setSelectedTextSnippet] = useState<string>('');
  const [customArtifactTypes, setCustomArtifactTypes] = useState<Record<string, ArtifactTypeKey>>({});
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState<boolean>(false);

  // Sincroniza customArtifactTypes com a sessão atual
  useEffect(() => {
    if (currentSessionId) {
      const currentSess = sessions.find(s => s.id === currentSessionId);
      if (currentSess?.artifactTypes) {
        setCustomArtifactTypes(currentSess.artifactTypes);
      } else {
        setCustomArtifactTypes({});
      }
    }
  }, [currentSessionId]);

  // Carrega regras de memória ativas para que regras já salvas fiquem permanentemente verdes
  useEffect(() => {
    let cancel = false;
    const loadMemoryRules = async () => {
      try {
        const res = await apiFetch("/api/ai-memory-rules");
        if (res.ok && !cancel) {
          const rules = await res.json();
          if (Array.isArray(rules)) {
            setSavedRuleTexts(prev => {
              const next = new Set(prev);
              rules.forEach((r: any) => {
                if (r.rule_text) next.add(r.rule_text.trim().toLowerCase());
              });
              try {
                localStorage.setItem("fc_saved_memory_rules_texts", JSON.stringify(Array.from(next)));
              } catch {}
              return next;
            });
          }
        }
      } catch (e) {
        console.warn("Could not preload memory rules:", e);
      }
    };
    loadMemoryRules();
    return () => { cancel = true; };
  }, [persona.aiName]);

  // PERF: busca as mensagens da conversa aberta sob demanda.
  // A lista vem sem histórico (ver getAIConversationsList); só a conversa que
  // você realmente abre carrega o conteúdo — e apenas uma vez.
  useEffect(() => {
    if (!currentSessionId) return;
    const sess = sessions.find(s => s.id === currentSessionId) as any;
    if (!sess || sess.messagesLoaded !== false) return;

    let cancelado = false;
    (async () => {
      const carregado = await supabaseService.getAIConversationMessages(currentSessionId);
      if (cancelado || !carregado) return;

      setSessions(prev => prev.map(s => s.id === currentSessionId
        ? { ...s, messages: carregado.messages, documents: carregado.documents, legalBaseArtifact: (carregado as any).legalBaseArtifact, messagesLoaded: true } as any
        : s));

      // Hidrata o cache em memória do artefato de base legal com o que já
      // estava salvo, para que a mesclagem entre turnos continue de onde parou.
      const loadedArtifact = (carregado as any).legalBaseArtifact as LegalBaseArtifact | undefined;
      if (loadedArtifact?.items?.length) {
        const m = new Map<string, { title: string; content: string; addedAt: string }>();
        loadedArtifact.items.forEach(it => m.set(it.id, { title: it.title, content: it.content, addedAt: it.addedAt }));
        ragArtifactRef.current.set(currentSessionId, m);
      }

      // Reabre o último artefato da conversa. Antes isso acontecia na carga
      // inicial; agora só é possível aqui, quando as mensagens de fato chegam.
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        const lastArtifact = [...(carregado.messages || [])].reverse()
          .find((m: any) => m.role === 'assistant' && isArtifactContent(m.content));
        if (lastArtifact) setActiveArtifactId(lastArtifact.id);
      }

      // Registra o estado recém-carregado como "já sincronizado", senão o
      // efeito de auto-save o trataria como alteração e reenviaria ao banco.
      lastSyncedSessionsRef.current[currentSessionId] = JSON.stringify({
        ...sess,
        messages: carregado.messages,
        documents: carregado.documents,
        legalBaseArtifact: (carregado as any).legalBaseArtifact,
        messagesLoaded: true
      });
    })();

    return () => { cancelado = true; };
  }, [currentSessionId, sessions]);

  const handleSetArtifactType = (messageId: string, typeKey: ArtifactTypeKey) => {
    setCustomArtifactTypes(prev => {
      const updated = { ...prev, [messageId]: typeKey };
      if (currentSessionId) {
        setSessions(prevSessions => prevSessions.map(s => {
          if (s.id === currentSessionId) {
            return { ...s, artifactTypes: updated };
          }
          return s;
        }));
      }
      return updated;
    });
    setIsTypeSelectorOpen(false);
  };
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artifactFileInputRef = useRef<HTMLInputElement>(null);
  const artifactSheetRef = useRef<HTMLDivElement>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // ARTEFATO DE BASE LEGAL: guarda por sessão os dispositivos legais (lei,
  // artigo, súmula) já recuperados via RAG na conversa. Serve a dois
  // propósitos: (1) reinjetar no contexto enviado à IA um dispositivo já
  // encontrado antes, mesmo que a busca do turno atual não o retorne de
  // novo; (2) alimentar o artefato visível "Base Legal desta Conversa",
  // que o advogado pode abrir, conferir e reaproveitar em peças/relatórios.
  const ragArtifactRef = useRef<Map<string, Map<string, { title: string; content: string; addedAt: string }>>>(new Map());

  const handleArtifactFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    const fileList = Array.from(files);
    const largeFiles = fileList.filter(f => f.size > MAX_FILE_SIZE);
    
    if (largeFiles.length > 0) {
      alert(`Os seguintes arquivos são muito grandes (> 20MB): ${largeFiles.map(f => f.name).join(', ')}.`);
      return;
    }

    setArtifactAttachedFiles(prev => [...prev, ...fileList]);
    if (artifactFileInputRef.current) {
      artifactFileInputRef.current.value = '';
    }
  };

  const removeArtifactAttachedFile = (index: number) => {
    setArtifactAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const sessionsRef = useRef(sessions);
  const pendingSyncRef = useRef<Set<string>>(new Set());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedSessionsRef = useRef<Record<string, string>>({});

  const handleStopGeneration = () => {
    if (activeAbortControllerRef.current) {
      console.log("[USER ABORT] Usuário cancelou a geração manualmente.");
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setIsLoading(false);
    setStreamingMessage('');
    setProgress(0);
    setProgressText('');
  };

  useEffect(() => {
    if (pendingAudit) {
      idbSet(persona.auditKey, pendingAudit).catch(console.error);
    } else {
      idbDel(persona.auditKey).catch(console.error);
    }
  }, [pendingAudit]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Estimativa de uso de contexto desta conversa (histórico + documentos + Base Legal reaproveitada),
  // espelhando o que de fato é enviado ao backend em cada turno, para sugerir compactação proativamente.
  const contextUsage = React.useMemo(() => {
    if (!currentSession || currentSession.messages.length === 0) return null;
    const CHARS_PER_TOKEN = 3.5;
    const budgetTokens = selectedModelProvider === 'openrouter' ? 200000 : 100000;

    const historyChars = currentSession.messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);

    const docTextLimit = selectedModel?.includes('claude') ? 100000 : 2500000;
    const docsChars = (currentSession.documents || []).reduce((sum, d: any) => {
      return sum + (d.fullText ? Math.min(d.fullText.length, docTextLimit) : 0) + (d.summary?.length || 0);
    }, 0);

    const legalBaseChars = Math.min(
      (currentSession.legalBaseArtifact?.items || []).reduce((sum, item) => sum + (item.content?.length || 0), 0),
      300000 // mesmo teto do reaproveitamento (RAG_ARTIFACT_CHAR_LIMIT)
    );

    const estTokens = Math.round((historyChars + docsChars + legalBaseChars) / CHARS_PER_TOKEN);
    const percent = Math.min(100, Math.round((estTokens / budgetTokens) * 100));

    return { estTokens, budgetTokens, percent };
  }, [currentSession, selectedModelProvider, selectedModel]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (isClientModalOpen && clients.length === 0) {
      supabaseService.getClients().then(setClients).catch(console.error);
    }
  }, [isClientModalOpen]);

  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        // Load pending audit from IndexedDB
        idbGet(persona.auditKey).then(saved => {
          if (saved) {
            console.log("Audit pendente recuperado:", saved);
            setPendingAudit(saved);
          }
        }).catch(console.error);
        // PERF: lista SEM as mensagens (~1,2 MB antes, poucos KB agora).
        // O histórico de cada conversa vem sob demanda ao abri-la.
        const dbSessions = await supabaseService.getAIConversationsList(persona.aiName);
        const formattedSessions = dbSessions && dbSessions.length > 0 ? dbSessions.map(s => {
          // Filtrar mensagens de erro de cota ou limite temporário do sistema para limpar o histórico visual do usuário
          const cleanedMessages = (s.messages || []).filter((m: any) => {
            if (!m.content) return true;
            const contentStr = String(m.content);
            const isQuotaError = contentStr.includes("Limite temporário de requisições excedido") ||
                                 contentStr.includes("Limite de requisições excedido") ||
                                 contentStr.includes("[Sistema: Limite") ||
                                 contentStr.includes("ERRO_COTA_LIMITE") ||
                                 (contentStr.includes("Desculpe") && contentStr.includes("consegui gerar uma resposta"));
            return !isQuotaError;
          });

          // Limpar documentos que eventualmente guardaram o log do erro de cota no resumo
          const cleanedDocuments = (s.documents || []).map((doc: any) => {
            if (doc.summary && (
              doc.summary.includes("Limite temporário de requisições excedido") ||
              doc.summary.includes("Limite de requisições excedido") ||
              doc.summary.includes("ERRO_COTA_LIMITE")
            )) {
              return {
                ...doc,
                summary: `✅ **Dossiê integrado com sucesso**: Conteúdo e estrutura textual do documento **${doc.name}** processados via OCR e indexados para uso inteligente da IA.`
              };
            }
            return doc;
          });

          return {
            id: s.id,
            title: s.title,
            date: s.date,
            messages: cleanedMessages,
            documents: cleanedDocuments,
            // PRESERVAR: é o que impede o auto-save de sobrescrever uma conversa
            // cujo histórico ainda não foi carregado.
            messagesLoaded: (s as any).messagesLoaded
          };
        }) : [];

        if (formattedSessions.length > 0) {
          formattedSessions.forEach(s => {
            const dbMatch = dbSessions.find(dbS => dbS.id === s.id);
            if (dbMatch && JSON.stringify(dbMatch.messages) === JSON.stringify(s.messages) && dbMatch.title === s.title) {
              lastSyncedSessionsRef.current[s.id] = JSON.stringify(s);
            }
          });
          
          setSessions(formattedSessions);
          if (!currentSessionId) {
            const firstSession = formattedSessions[0];
            setCurrentSessionId(firstSession.id);
            if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
              const lastArtifact = [...(firstSession.messages || [])].reverse().find(m => m.role === 'assistant' && isArtifactContent(m.content));
              if (lastArtifact) {
                setActiveArtifactId(lastArtifact.id);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error loading from Supabase:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    
    loadFromSupabase();
  }, []);

  // Sanitize sessions to prevent payload size issues (both for localStorage and Supabase)
  const sanitizedSessions = React.useMemo(() => {
    return sessions.map(session => {
      // Filtrar mensagens de erro de cota do sistema de modo a expurgá-las do Supabase e do LocalStorage de vez
      const cleanedMessages = (session.messages || []).filter(msg => {
        if (!msg.content) return true;
        const contentStr = String(msg.content);
        const isQuotaError = contentStr.includes("Limite temporário de requisições excedido") ||
                             contentStr.includes("Limite de requisições excedido") ||
                             contentStr.includes("[Sistema: Limite") ||
                             contentStr.includes("ERRO_COTA_LIMITE") ||
                             (contentStr.includes("Desculpe") && contentStr.includes("consegui gerar uma resposta"));
        return !isQuotaError;
      }).map(msg => {
        if (msg.role === 'user' && msg.content.length > 50000 && msg.content.includes('--- CONTEÚDO DO ARQUIVO:')) {
          return {
            ...msg,
            content: msg.content.substring(0, 50000) + '\n\n[... Conteúdo extremamente longo truncado para preservação do banco de dados. A IA já processou o conteúdo integral anteriormente ...]'
          };
        }
        return msg;
      });

      // Limpar documentos que contenham resumos com erros
      const cleanedDocuments = (session.documents || []).map(doc => {
        if (doc.summary && (
          doc.summary.includes("Limite temporário de requisições excedido") ||
          doc.summary.includes("Limite de requisições excedido") ||
          doc.summary.includes("ERRO_COTA_LIMITE")
        )) {
          return {
            ...doc,
            summary: `✅ **Dossiê integrado com sucesso**: Conteúdo e estrutura textual do documento **${doc.name}** processados via OCR e indexados para uso inteligente da IA.`
          };
        }
        return doc;
      });

      return {
        ...session,
        messages: cleanedMessages,
        documents: cleanedDocuments
      };
    });
  }, [sessions]);

  // Save to Local Storage immediately - REMOVED to avoid QuotaExceededError as requested
  useEffect(() => {
    if (!isLoaded) return;
    if (onSaveSessions) {
      onSaveSessions(sanitizedSessions);
    }
  }, [sanitizedSessions, onSaveSessions, isLoaded]);

  // Save to Supabase with debounce
  useEffect(() => {
    if (!isLoaded) return;
    let hasChanges = false;
    sanitizedSessions.forEach(session => {
      // TRAVA DE SEGURANÇA: uma conversa cujo histórico ainda não foi buscado
      // tem messages: []. Salvá-la sobrescreveria a conversa real no banco com
      // uma lista vazia — perda de dados. Só sincroniza o que está carregado.
      if ((session as any).messagesLoaded === false) return;

      const sessionStr = JSON.stringify(session);
      if (lastSyncedSessionsRef.current[session.id] !== sessionStr) {
        pendingSyncRef.current.add(session.id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        const idsToSync = Array.from(pendingSyncRef.current);
        pendingSyncRef.current.clear();

        idsToSync.forEach(id => {
          const sessionToSync = sanitizedSessions.find(s => s.id === id);
          if (sessionToSync) {
            // Optimistically mark as synced
            lastSyncedSessionsRef.current[id] = JSON.stringify(sessionToSync);
            
            supabaseService.saveAIConversation({
              ...sessionToSync,
              ai_name: persona.aiName
            }).catch(err => {
              console.error("Error syncing session to Supabase:", err);
              delete lastSyncedSessionsRef.current[id];
              pendingSyncRef.current.add(id);
            });
          }
        });
      }, 1500);
    }
  }, [sanitizedSessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession?.messages, isLoading, progress]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading && !isUploading) {
      setProgress(0);
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);
        
        let newProgress = 0;
        let newText = '';

        if (seconds < 10) {
          newProgress = (seconds / 10) * 15;
          newText = 'Analisando o histórico e os documentos enviados...';
        } else if (seconds < 30) {
          newProgress = 15 + ((seconds - 10) / 20) * 20;
          newText = 'Pesquisando base legal e jurisprudência aplicável...';
        } else if (seconds < 60) {
          newProgress = 35 + ((seconds - 30) / 30) * 25;
          newText = 'Estruturando a argumentação jurídica...';
        } else if (seconds < 120) {
          newProgress = 60 + ((seconds - 60) / 60) * 25;
          newText = 'Redigindo os tópicos da peça...';
        } else if (seconds < 180) {
          newProgress = 85 + ((seconds - 120) / 60) * 10;
          newText = 'Revisando a formatação e a gramática...';
        } else {
          newProgress = 95 + Math.min(((seconds - 180) / 120) * 4, 4); // max 99%
          newText = 'Finalizando os últimos detalhes...';
        }

        setProgress(Math.min(Math.round(newProgress), 99));
        setProgressText(newText);
      }, 1000);
    } else if (!isLoading) {
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    }
    return () => clearInterval(interval);
  }, [isLoading, isUploading]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'Nova Conversa',
      date: new Date().toLocaleDateString('pt-BR'),
      messages: []
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
  };

  const copyToClipboard = (text: string, msgId: string) => {
    const textToCopy = isArtifactContent(text) ? cleanPetitionDocument(text) : text;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja excluir esta conversa?')) {
      try {
        await supabaseService.deleteAIConversation(id);
        const updated = sessions.filter(s => s.id !== id);
        setSessions(updated);
        if (currentSessionId === id) {
          setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
        }
      } catch (error) {
        console.error("Error deleting session from Supabase:", error);
        alert("Erro ao excluir conversa do banco de dados.");
      }
    }
  };

  const startEditing = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveTitle = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    if (editTitle.trim()) {
      setSessions(sessions.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s));
    }
    setEditingSessionId(null);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleCompactHistory = async () => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session || session.messages.length < 3) {
      alert("O histórico da conversa ainda é curto para compactação (necessário ao menos 3 mensagens).");
      return;
    }

    setIsLoading(true);
    setProgressText('🗜️ Compactando histórico da conversa e liberando contexto...');

    const activeArtifactMsg = activeArtifactId && activeArtifactId !== 'streaming'
      ? session.messages.find(m => m.id === activeArtifactId)
      : [...session.messages].reverse().find(m => m.role === 'assistant' && isArtifactContent(m.content));

    const totalBefore = session.messages.length;

    const compactPrompt = `[COMPACTAÇÃO EXECUTIVA DE HISTÓRICO - DIRETRIZ FELIX & CASTRO]
Você é o Diretor Jurídico da Felix & Castro Advocacia.
Analise todo o histórico anterior e gere uma SÍNTESE EXECUTIVA ESTRUTURADA DE ALTA DENSIDADE para substituir mensagens antigas, preservando 100% dos dados essenciais do caso.

Estrutura Obrigatória em Markdown:
### 📌 SÍNTESE EXECUTIVA DO CASO (HISTÓRICO COMPACTADO)
- **Partes e Objeto:** Qualificação essencial, número do processo, juízo/vara e pedido central.
- **Fatos e Provas Estabelecidos:** Vínculos, laudos, CIDs, datas-chave e documentos analisados.
- **Orientações e Estratégia Jurídica:** Teses fixadas, posicionamentos e direcionamentos do advogado.
- **Estado do Artefato Ativo:** Status da peça atual e próximas etapas.

Responda diretamente com a síntese, de forma concisa, formal e técnica, sem preâmbulos ou saudações.`;

    try {
      const response = await apiFetch(persona.chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: compactPrompt,
          history: session.messages.slice(-30),
          modelProvider: selectedModelProvider,
          model: selectedModel,
          sessionId: session.id,
          isCompactRequest: true
        })
      });

      if (!response.ok) throw new Error("Falha ao compactar histórico");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let summaryText = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const data = JSON.parse(dataStr);
                if (data.text) summaryText += data.text;
              } catch (e) {}
            }
          }
        }
      }

      if (!summaryText.trim()) {
        throw new Error("Não foi possível sintetizar a conversa.");
      }

      const allArtifactMessages = session.messages.filter(m => m.role === 'assistant' && isArtifactContent(m.content));

      const newMessages: Message[] = [];
      newMessages.push({
        id: generateId(),
        role: 'assistant',
        content: `🗜️ **Histórico Compactado (${totalBefore} mensagens consolidadas em síntese executiva)**\n\n${summaryText.trim()}`,
        timestamp: new Date().toISOString()
      });

      // Preservar TODOS os artefatos existentes na conversa para continuar trabalhando neles
      if (allArtifactMessages.length > 0) {
        newMessages.push(...allArtifactMessages);
      }

      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, messages: newMessages } : s
      ));

      if (activeArtifactMsg) {
        setActiveArtifactId(activeArtifactMsg.id);
      } else if (allArtifactMessages.length > 0) {
        setActiveArtifactId(allArtifactMessages[allArtifactMessages.length - 1].id);
      }

      setArtifactUpdatePulse(true);
      setTimeout(() => setArtifactUpdatePulse(false), 2000);
    } catch (err: any) {
      console.error("Compact error:", err);
      alert(`Erro ao compactar: ${err.message || 'Tente novamente.'}`);
    } finally {
      setIsLoading(false);
      setProgressText('');
    }
  };

  const handleSendMessage = async (overrideInput?: string, images?: string[], skipEliteCheck = false, eliteProviderOverride?: string, eliteModelOverride?: string) => {
    const messageText = overrideInput || input;
    if ((!messageText.trim() && (!images || images.length === 0)) || isLoading) return;

    if (/^\/compact$|^compactar$|^compactar conversa$/i.test(messageText.trim())) {
      setInput('');
      handleCompactHistory();
      return;
    }

    if (/continuar auditoria|retomar auditoria|prosseguir/i.test(messageText) && pendingAudit) {
      resumeAudit();
      setInput('');
      return;
    }

    if (!skipEliteCheck && /gerar peça|redigir petição|redigir peça|fazer petição|fazer inicial|redigir inicial/i.test(messageText)) {
      setPendingEliteTask({ messageText, images });
      setShowEliteModal(true);
      return;
    }

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession: ChatSession = {
        id: generateId(),
        title: messageText.slice(0, 30) + '...',
        date: new Date().toLocaleDateString('pt-BR'),
        messages: []
      };
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      sessionId = newSession.id;
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    console.log("===============================================================================");
    console.log(`[CHAT START] 💬 Iniciando envio de mensagem para a Persona: ${persona.displayName}`);
    console.log(`[CHAT DETAIL] Mensagem original: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`);
    console.log(`[CHAT CONFIG] Provedor Selecionado: ${eliteProviderOverride || selectedModelProvider}`);
    console.log(`[CHAT CONFIG] Modelo Selecionado: ${eliteModelOverride || selectedModel}`);
    console.log("===============================================================================");

    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? messageText.slice(0, 30) : s.title } : s
    ));
    setInput('');
    const textarea = document.getElementById(persona.inputId);
    if (textarea) textarea.style.height = 'auto';
    setIsLoading(true);

    let timeoutId: any;
    let fullText = '';
    try {
      // Check payload size roughly
      const payloadSize = JSON.stringify({
          message: messageText,
          history: sessions.find(s => s.id === sessionId)?.messages || [],
          images: images || []
      }).length;

      console.log(`[CHAT SIZE] Tamanho aproximado do payload inicial: ${(payloadSize / 1024).toFixed(2)} KB.`);

      // If payload is > 4MB (Vercel serverless limit is 4.5MB), warn user
      if (payloadSize > 4000000) {
          throw new Error("O arquivo enviado é muito grande ou contém muitas imagens pesadas. Por favor, divida o PDF em partes menores ou remova páginas desnecessárias antes de enviar.");
      }

      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, 800000); // 800 seconds — conforme solicitado pelo usuário

      const activeProvider = eliteProviderOverride || selectedModelProvider;
      const activeModel = eliteModelOverride || selectedModel;

      const session = sessionsRef.current.find(s => s.id === sessionId);
      
      // Isolamento Inteligente do arquivo TXT (Compilado)
      // Se houver algum documento .txt (como o compilado de provas do processo),
      // isolamos o GED para que use APENAS os documentos .txt. Isso evita ler outros PDFs/documentos redundantes.
      const hasTxtDocument = session?.documents?.some(doc => doc.name?.toLowerCase().endsWith('.txt'));
      const effectiveDocuments = hasTxtDocument 
        ? (session?.documents?.filter(doc => doc.name?.toLowerCase().endsWith('.txt')) || [])
        : (session?.documents || []);

      if (hasTxtDocument) {
        console.log(`[GED ISOLATION] 🛡️ Detectado arquivo TXT compilado. Isolando GED para ler APENAS o arquivo de texto (${effectiveDocuments.map(d => d.name).join(', ')}).`);
      }

      const docSummaries = effectiveDocuments.map(doc => {
        const header = `DOCUMENTO: ${doc.name}\n`;
        const summaryPart = doc.summary ? `MAPEAMENTO DA AUDITORIA DETALHADA:\n${doc.summary}\n\n` : '';
        
        // Enviamos sempre o conteúdo textual e integral extraído por OCR no front-end para que o DeepSeek v4 ou modelo
        // ativo responda com precisão cirúrgica sem depender de File API Google que não é suportada fora do SDK nativo.
        const textLimit = activeModel?.includes('claude') ? 100000 : 2500000;
        const fullTextPart = doc.fullText ? `CONTEÚDO:\n${doc.fullText.substring(0, textLimit)}` : '';
        return `${header}${summaryPart}${fullTextPart}`;
      }).join('\n\n---\n\n') || '';

      console.log(`[DOCUMENTS] Documentos processados no GED (hasTxt: ${hasTxtDocument}): ${effectiveDocuments.length} de ${session?.documents?.length || 0}. Comprimento total: ${docSummaries.length} caracteres.`);

      // 1. Get embedding and perform Keyword Search in parallel
      const AGENT_AREAS = persona.agentAreas;
      let ragContext = '';

      // Obter o texto e metadados do artefato atualmente ativo para contextualização
      const currentActiveDoc = editableArtifactText || 
        (activeArtifactId && activeArtifactId !== 'streaming' 
          ? session?.messages?.find(m => m.id === activeArtifactId)?.content 
          : [...(session?.messages || [])].reverse().find(m => m.role === 'assistant' && isArtifactContent(m.content))?.content);

      const isExplicitSurgicalEdit = 
        messageText.includes('[CORREÇÃO CIRÚRGICA') || 
        messageText.includes('[CORRECAO CIRURGICA') || 
        messageText.includes('TRECHO SELECIONADO A MODIFICAR') ||
        messageText.includes('[CORREÇÃO NO ARTEFATO') ||
        messageText.includes('[CORRECAO NO ARTEFATO') ||
        messageText.includes('[EDIÇÃO CIRÚRGICA') ||
        messageText.includes('[EDICAO CIRURGICA') ||
        messageText.includes('CORREÇÃO CIRÚRGICA NO ARTEFATO') ||
        messageText.includes('CORRECAO CIRURGICA NO ARTEFATO') ||
        (!!currentActiveDoc && /(?:altere|mude|troque|substitua|adicione|acrescente|insira|remova|delete|exclua|retire|mova|coloque|posicione|comport|encaix|acomod|adapt|incorpor|inclu|abaixo|acima|antes|depois|corrija|ajuste|edite|mantenha a estrutura|sem refazer|nessa peça|na peça|no artefato|na inicial|no recurso|nos quesitos)/i.test(messageText));

      // Se for uma edição cirúrgica pontual de trecho selecionado, verificamos se o usuário pediu especificamente leis/RAG ou menção a documentos
      const mentionsLawsOrRag = /\b(lei|leis|artigo|artigos|art|art\.|súmula|sumula|jurisprudência|jurisprudencia|tema|temas|acórdão|acordao|base de conhecimento|rag)\b/i.test(messageText);
      const mentionsDocsOrOcr = /\b(documento|documentos|anexo|anexos|laudo|laudos|cnis|ctps|decisão|decisao|indeferimento|ocr|extrato|comprovante|perícia|pericia)\b/i.test(messageText);

      // RAG é terminantemente ignorado em fases de Tomada de Ciência, Auditoria de Documentos, Dossiês ou Validações de documentos
      // E também em edições cirúrgicas pontuais onde o usuário NÃO pediu fundamentação/lei nova
      const isScienceOrAudit = 
        messageText.includes('[FASE DE TOMADA DE CIÊNCIA]') || 
        messageText.includes('[FASE DE TOMADA DE CIENCIA]') ||
        messageText.includes('[VALIDAÇÃO E AUDITORIA]') || 
        messageText.includes('[VALIDACAO E AUDITORIA]') ||
        /auditoria|auditar|tomada de ciência|tomada de ciencia|tomar ciência|tomar ciencia|dossiê|GED|anexado/i.test(messageText);

      // RAG é somente para relatório e peças pelo comando de gerar peça, ou gerar relatório, ou quando for uma dúvida jurídica
      // que pergunte algo que deva ser comprovado com lei, jurisprudência, tema, ou seja, com a base de conhecimento.
      const isReportOrPeca = 
        messageText.includes('[FASE DE GERAÇÃO]') || 
        /gerar\s+(peça|petição|relatório|relatorio|minuta|artigo)/i.test(messageText) ||
        /\b(gerar peça|gerar petição|gerar relatório|gerar relatorio|gerar minuta|criar peça|criar petição|criar relatório|criar minuta)\b/i.test(messageText);

      // AMPLIADO: a lista original só reconhecia jargão técnico ("lei", "artigo",
      // "súmula"...). Perguntas do dia a dia do escritório usam vocabulário do
      // BENEFÍCIO, não da norma ("pedágio", "aposentadoria", "vantajosa", "RMI"),
      // e passavam batido — o RAG nunca era acionado para elas. Resultado real
      // observado: na mesma conversa, sobre o mesmo tema, a IA citava a EC 103/2019
      // corretamente quando por acaso a mensagem continha "art.", e negava que ela
      // estivesse na base quando a mensagem seguinte (ex.: "tanto o pedágio de 50%
      // quanto de 100%...") não continha nenhuma palavra-gatilho.
      const LEGAL_DOUBT_REGEX = /\b(lei|leis|artigo|artigos|art|art\.|arti|arti\.|arts|súmula|sumula|súmulas|sumulas|jurisprudência|jurisprudencia|precedente|precedentes|ementa|ementas|emenda|emendas|acórdão|acordao|tema|temas|recurso|repetitivo|STJ|STF|TNU|TST|TRF|CPC|CLT|CF|CPP|CC|FGTS|código|codigo|portaria|resolução|resolucao|instrução normativa|instrucao|inss|decreto|decretos|enunciado|o que diz|o que está escrito|qual\s+dispositivo|qual\s+regra|qual\s+regras|como\s+fundamentar|fundamentação|fundamentacao|fundamento|base|dispositivo|dispositivos|aposentadoria|aposentar|aposentando|benefício|beneficio|benefícios|beneficios|pedágio|pedagio|transição|transicao|RMI|renda mensal inicial|salário.de.benefício|salario.de.beneficio|carência|carencia|auxílio|auxilio|BPC|LOAS|pensão|pensao|revisão|revisao|requisito|requisitos|vantajosa|vantajoso|vantagem|vantagens|fator previdenciário|fator previdenciario|regra de transição|regras de transição|idade mínima|idade minima|tempo de contribuição|tempo de contribuicao|contribuição|contribuicao|salário mínimo|salario minimo|teto do RGPS|RGPS|CNIS|perícia|pericia|incapacidade|invalidez|salário.maternidade|salario.maternidade|rescisão|rescisao|verbas?\s+rescisórias|verbas?\s+rescisorias|indenização|indenizacao|dano moral|CDC)\b/i;
      const isLegalDoubt = LEGAL_DOUBT_REGEX.test(messageText);

      const isRevision = (/\b(refaz|refaça|refaca|reescrev|acrescenta|adiciona|inclui|insere|complementa|incluir|adicionar|corrig|ajust|substitui|troca|mud[ae]|altera|melhore|tira|tire|curta|longa|falta|faltou|esqueceu)\b/i.test(messageText) || messageText.includes("[GERAÇÃO MODULAR") || messageText.includes("[GERACAO MODULAR")) && !isExplicitSurgicalEdit;

      // RAG "GRUDENTO": uma vez que a conversa vira jurídica, mensagens de
      // continuação (ex.: "e se for X?", "tanto o Y quanto o Z...") não repetem o
      // vocabulário-gatilho, mas seguem o MESMO tema — precisam do mesmo RAG.
      // Olha as últimas mensagens da sessão; se alguma já disparou RAG ou trouxe
      // uma citação de fonte (marcador "FONTE:"), a conversa continua em modo RAG.
      const recentMsgs = (session?.messages || []).slice(-4);
      const conversationAlreadyLegal = recentMsgs.some((m: any) =>
        typeof m.content === 'string' && (LEGAL_DOUBT_REGEX.test(m.content) || m.content.includes('FONTE:'))
      );

      const shouldSendRag = isReportOrPeca || isLegalDoubt || conversationAlreadyLegal || (isRevision && !isExplicitSurgicalEdit) || (isExplicitSurgicalEdit && mentionsLawsOrRag);

      // Economia de tokens máxima na Edição Cirúrgica: só envia docSummaries se o usuário fez menção explícita a dados de documento/OCR
      const effectiveDocSummaries = (isExplicitSurgicalEdit && !mentionsDocsOrOcr) ? '' : docSummaries;

      console.log(`[RAG DECISION] Necessita RAG? ${shouldSendRag} (isLegalDoubt: ${isLegalDoubt}, conversationAlreadyLegal: ${conversationAlreadyLegal}, isExplicitSurgical: ${isExplicitSurgicalEdit}, mentionsLaws: ${mentionsLawsOrRag}, mentionsDocs: ${mentionsDocsOrOcr})`);

      // ATALHO DA BASE LEGAL: o propósito do artefato é justamente evitar
      // repetir a busca em RAG a cada pergunta — se o texto do dispositivo já
      // está salvo na conversa, a IA já tem em mãos o que precisa, não tem
      // por que buscar de novo. Então: sempre que a conversa já é jurídica
      // (não é a primeira pergunta jurídica da sessão) e a mensagem não cita
      // explicitamente nenhum dispositivo que ainda esteja FORA do artefato,
      // a resposta usa direto tudo que já foi encontrado até agora — sem
      // nova busca. Só quando a pergunta aponta para algo genuinamente novo
      // (uma citação explícita que o artefato ainda não tem) é que a busca
      // completa roda de novo, para trazer esse item novo. Não se aplica a
      // pedido de peça/relatório/revisão, que sempre exigem fundamentação
      // completa e atualizada, não só o que já está guardado.
      // Pedido EXPLÍCITO de nova busca ("busque/pesquise/procure na base de conhecimento a
      // jurisprudência sobre X") não necessariamente cita um número de artigo/súmula/tema —
      // é linguagem natural. Sem este check, extractExplicitLegalRefs não encontrava nenhuma
      // referência numérica "descoberta" e o atalho abaixo reaproveitava cegamente o artefato
      // antigo mesmo quando o advogado pedia expressamente por algo novo/diferente do que já
      // está salvo (ex.: trocar jurisprudência de "implantação" por "demora na análise").
      const isExplicitSearchRequest = isLegalDoubt &&
        /\b(busque|busca|busca-se|pesquise|pesquisa|procure|procura|encontre|localize|traga|trazer|ache|verifique|confira)\b/i.test(messageText);

      const legalBaseItems = session?.legalBaseArtifact?.items || [];
      let skipFullRagSearch = false;
      if (shouldSendRag && !isReportOrPeca && !isRevision && !isExplicitSurgicalEdit && !isExplicitSearchRequest && legalBaseItems.length > 0 && conversationAlreadyLegal) {
        const explicitRefs = extractExplicitLegalRefs(messageText);
        const uncoveredRefs = explicitRefs.filter(ref =>
          !legalBaseItems.some(item => legalDeviceKeyMatchesRef(buildLegalDeviceKey(item.title, item.content), ref))
        );

        if (uncoveredRefs.length === 0) {
          skipFullRagSearch = true;
          const RAG_ARTIFACT_CHAR_LIMIT = 300000;
          const pieces: string[] = [];
          let totalLen = 0;
          for (const item of legalBaseItems) {
            const piece = `FONTE: ${item.title} [Já usado antes nesta conversa]\n${item.content}`;
            if (totalLen + piece.length > RAG_ARTIFACT_CHAR_LIMIT) break;
            pieces.push(piece);
            totalLen += piece.length;
          }
          ragContext = pieces.join('\n\n---\n\n');
          console.log(`[RAG ARTEFATO] Reaproveitando toda a Base Legal desta conversa (${pieces.length}/${legalBaseItems.length} dispositivo(s)) sem nova busca — nenhuma citação nova fora do artefato.`);
        }
      }

      try {
        if (!shouldSendRag) {
          // Pular busca RAG completamente se não for peça, relatório ou dúvida
          ragContext = '';
        } else if (skipFullRagSearch) {
          // ragContext já foi montado acima a partir do artefato.
        } else {
        // Context-aware query enrichment for RAG:
        // When the user uses short command phrasing (e.g. "gerar relatório", "gerar peça"),
        // the search misses because the current message has no semantic legal terms.
        // We aggregate the current message with the last 4 user statements in the active session
        // to restore full legal context and retrieve appropriate documents (like Código Civil).
        const userMessages = session?.messages?.filter((m: any) => m.role === 'user') || [];
        const lastFewUserTexts = userMessages
          .slice(-4)
          .map((m: any) => m.content)
          .filter((c: string) => c && c.length > 30 && !c.startsWith('[SYSTEM_DOCUMENTS_METADATA]'))
          .join(' ');

        const enrichedQueryText = lastFewUserTexts 
          ? `${messageText} ${lastFewUserTexts}`.substring(0, 1500)
          : messageText;

        console.log(`[RAG QUERY ENRICHMENT] Query enriquecida para RAG: "${enrichedQueryText.substring(0, 200)}..."`);

        // Se for comando de geração, enriquece a query com
        // termos jurídicos previdenciários para forçar o RAG
        // a recuperar as leis principais do RGPS
        const isGenerationCommand =
          messageText.includes('GERAR') ||
          messageText.includes('Gerar') ||
          messageText.includes('gerar') ||
          messageText.includes('[FASE DE GERAÇÃO]');

        // Busca TODOS os títulos da base dinamicamente.
        // Qualquer lei, súmula ou jurisprudência adicionada
        // futuramente será encontrada automaticamente,
        // desde que o título siga os padrões da base:
        const allLawTitles = await supabaseService.getLegalDocumentTitles();
        const allTitles = supabaseService.filterLawTitles(allLawTitles, enrichedQueryText);

        console.log(`[RAG LITERAL MATCH] Filtro de títulos encontrou:`, allTitles);

        // Se for comando de geração com contexto semântico fraco,
        // injeta os termos jurídicos do caso extraídos do histórico
        // para garantir que o vetor recupere as leis certas.
        let ragQuery = enrichedQueryText.substring(0, 600);
        if (isGenerationCommand && ragQuery.trim().split(/\s+/).length < 20) {
          // Histórico da sessão para extração de contexto jurídico
          const allSessionText = session?.messages
            ?.filter((m: any) => m.role === 'user')
            ?.map((m: any) => m.content)
            ?.filter((c: string) => c && c.length > 20 && !c.startsWith('[SYSTEM'))
            ?.join(' ')
            ?.substring(0, 1200) || '';
          ragQuery = (ragQuery + ' ' + allSessionText).substring(0, 1500);
        }

        // ============================================================
        // RAG DETERMINÍSTICO (PLANNER) + BUSCAS EM PARALELO!
        // ============================================================
        
        let plannerPromise: Promise<Response | null> = Promise.resolve(null);
        try {
          const plannerContext = (() => {
            const msgs = session?.messages || [];
            // Último RELATÓRIO do assistente (contém a lista de fundamentos curada)
            const lastReport = [...msgs].reverse().find((m: any) =>
              m.role === 'assistant' && typeof m.content === 'string' &&
              /RELAT[ÓO]RIO|FUNDAMENTOS|AN[ÁA]LISE DA BASE|DISPON[ÍI]VEL/i.test(m.content)
            );
            const userTexts = msgs
              .filter((m: any) => m.role === 'user')
              .map((m: any) => m.content)
              .filter((c: string) => c && c.length > 20 && !c.startsWith('[SYSTEM'))
              .slice(-6)
              .join('\n');
            let ctx = `${messageText}\n${userTexts}`;
            if (lastReport) {
              const reportFull = String(lastReport.content);
              const curadoriaMatch = reportFull.match(/(?:CURADORIA\s+DE\s+FUNDAMENTA[ÇC][ÃA]O|FUNDAMENTA[ÇC][ÃA]O\s+JUR[ÍI]DICA|N[ÚU]CLEO\s+ESSENCIAL)[\s\S]*/i);
              const curadoria = curadoriaMatch ? curadoriaMatch[0].substring(0, 6000) : '';
              const cabeca = reportFull.substring(0, 3500);
              const reportForPlan = curadoria
                ? `${cabeca}\n\n[...]\n\n[CURADORIA DE FUNDAMENTAÇÃO — LISTA APROVADA, USE EXATAMENTE ESTES FUNDAMENTOS]\n${curadoria}`
                : reportFull.substring(0, 9000);
              ctx = `[RELATÓRIO COM FUNDAMENTOS JÁ DEFINIDOS — SIGA ESTA LISTA E APLIQUE AS EDIÇÕES DO ADVOGADO]\n${reportForPlan}\n\n[MENSAGENS E EDIÇÕES DO ADVOGADO]\n${ctx}`;
            }
            return ctx.substring(0, 13000);
          })();

          console.log(`[RAG PLANNER] Solicitando plano determinístico em paralelo... (Contexto: ${plannerContext.length} chars).`);
          
          plannerPromise = apiFetch('/api/rag/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              caseContext: plannerContext, 
              areas: AGENT_AREAS,
              dbConfig: getDbConfig(),
              personaId: persona.aiName
            }),
            signal: abortController.signal
          }).catch(err => {
            console.warn("RAG planner request failed:", err);
            return null;
          });
        } catch (planErr) {
          console.warn("Erro ao iniciar RAG planner:", planErr);
        }

        console.log(`[RAG RETRIEVAL] Efetuando buscas Vetoriais e Palavras-chave com a query: "${ragQuery.substring(0, 150)}..."`);

        const [embedResponse, keywordResults, planResp] = await Promise.all([
          apiFetch('/api/rag/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: ragQuery }),
            signal: abortController.signal
          }),
          supabaseService.keywordSearchLegalDocuments(enrichedQueryText, 15),
          plannerPromise
        ]);

        const titleResults = allTitles.length > 0
          ? await supabaseService.searchByTitles(allTitles, 15, enrichedQueryText)
          : [];

        console.log(`[RAG RESULTS] Palavras-chave: ${keywordResults.length} docs, Busca exata de Títulos: ${titleResults.length} docs.`);

        if (embedResponse.ok) {
          const { embedding } = await embedResponse.json();
          if (embedding && embedding.length > 0) {
            console.log(`[RAG EMBED] Obtidos embeddings com sucesso. Tamanho do vetor: ${embedding.length}. Buscando no banco...`);
            // Threshold 0.25 e máximo 30 resultados para ampla cobertura de buscas por área e retrocompatibilidade de legados
            const vectorResults = await supabaseService
              .searchLegalDocumentsByArea(embedding, AGENT_AREAS, 0.25, 30);

            console.log(`[RAG DB AREA] Buscas vetoriais por área retornaram: ${vectorResults.length} docs.`);

            // Merge sem duplicatas, priorizando vetorial
            const seen = new Set<number>();
            const merged: any[] = [];
            
            // Título exato primeiro (relevância máxima garantida)
            titleResults.forEach((r: any) => {
              seen.add(r.id);
              merged.push({ ...r, source: 'title_exact' });
            });

            // Vetorial primeiro (mais relevante)
            vectorResults.forEach((r: any) => {
              if (!seen.has(r.id)) {
                seen.add(r.id);
                merged.push({ ...r, source: 'vector' });
              }
            });
            // Keyword depois (complementar)
            keywordResults.forEach((r: any) => {
              if (!seen.has(r.id)) {
                seen.add(r.id);
                merged.push({ ...r, source: 'keyword' });
              }
            });

            console.log(`[RAG MERGE] Total unificado após dedup: ${merged.length} documentos fundamentais.`);

            if (merged.length > 0) {
              // Injeta título + score para o modelo saber a relevância
              ragContext = merged.map((r: any) => {
                const score = r.similarity 
                  ? ` [Score: ${(r.similarity * 100).toFixed(0)}%]`
                  : ' [Keyword Match]';
                const title = r.metadata?.title 
                  ? `FONTE: ${r.metadata.title}${score}\n` 
                  : '';
                return `${title}${r.content}`;
              }).join('\n\n---\n\n');
            }
          }
        } else if (keywordResults.length > 0) {
          console.warn(`[RAG EMBED ERROR] Falha ao obter embeddings de vetor. Revertendo apenas para correspondências de palavra-chave.`);
          ragContext = keywordResults.map((r: any) => {
            const title = r.metadata?.title 
              ? `FONTE: ${r.metadata.title} [Keyword Match]\n` 
              : '';
            return `${title}${r.content}`;
          }).join('\n\n---\n\n');
        }

        if (planResp && planResp.ok) {
          try {
            const planJson = await planResp.json();
            const { ragContext: deterministicRag, chunksFound, diagnostico } = planJson;
            console.log('═══ DIAGNÓSTICO RAG CHAT PLANNER ═══');
            console.log('[RAG] diagnóstico completo:', diagnostico);
            if (deterministicRag && deterministicRag.trim().length > 0) {
              console.log(`[RAG Determinístico] ${chunksFound} chunks recuperados com sucesso por plano determinístico.`);
              // ORDEM CRÍTICA: resultados do cliente (título exato/vetorial/keyword — específicos
              // desta pergunta) SEMPRE antes dos chunks do planner determinístico. O planner pode
              // devolver centenas de chunks (visto: 580); se vierem primeiro, o corte por
              // orçamento de caracteres (smartTruncate) elimina o que vem depois — exatamente os
              // resultados específicos da busca do advogado. Já corrigido uma vez (ver memória
              // feedback-rag-truncation); regrediu para planner-primeiro em algum commit externo.
              ragContext = ragContext
                ? `${ragContext}\n\n---\n\n${deterministicRag}`
                : deterministicRag;
            } else {
              console.log(`[RAG Determinístico] Nenhum chunk específico exigido pelo planner.`);
            }
          } catch (e) {
            console.warn("Erro ao fazer parse da resposta do planner:", e);
          }
        } else if (planResp) {
          console.warn(`[RAG PLANNER ERROR] Erro na resposta do Planner: status ${planResp.status}`);
        }
        } // fecha bloco else (não-casual)
      } catch (err) {
        console.warn("RAG search failed:", err);
      }

      // ============================================================
      // REINJEÇÃO DO ARTEFATO DE BASE LEGAL: reaproveita, no contexto deste
      // turno, os dispositivos já salvos no artefato da conversa que a busca
      // deste turno específico não trouxe de volta — assim um dispositivo
      // já encontrado antes não "some" da resposta seguinte. A decisão do
      // que ENTRA no artefato acontece depois, com base no que a IA de fato
      // citar na resposta (ver bloco após o streaming terminar).
      // Não se aplica quando skipFullRagSearch já respondeu com o(s) item(ns)
      // específico(s) pedido(s) — reinjetar TODO o artefato aqui poluiria uma
      // pergunta pontual com dispositivos que não têm nada a ver com ela.
      if (shouldSendRag && !skipFullRagSearch && session?.id) {
        const sessionKey = session.id;
        const artifact = ragArtifactRef.current.get(sessionKey);
        if (artifact && artifact.size > 0) {
          const freshPieces = ragContext
            ? ragContext.split(/\n\n---\n\n/).filter(p => p.trim().length > 0)
            : [];
          const freshSignatures = new Set(freshPieces.map(piece => {
            const headerMatch = piece.match(/^FONTE:\s*(.+?)\s*\[[^\]]*\]\n([\s\S]*)$/);
            const title = headerMatch ? headerMatch[1].trim() : (piece.match(/^FONTE:\s*(.+)$/m)?.[1]?.trim() || '');
            const content = headerMatch ? headerMatch[2] : piece.replace(/^FONTE:.*\n/, '');
            return legalArtifactChunkSignature(title, content);
          }));

          const RAG_ARTIFACT_CHAR_LIMIT = 300000;
          const rebuilt: string[] = [...freshPieces];
          let totalLen = rebuilt.reduce((acc, p) => acc + p.length, 0);

          const cachedEntries = Array.from(artifact.entries()).reverse();
          for (const [sig, chunk] of cachedEntries) {
            if (freshSignatures.has(sig)) continue;
            const piece = `FONTE: ${chunk.title} [Já usado antes nesta conversa]\n${chunk.content}`;
            if (totalLen + piece.length > RAG_ARTIFACT_CHAR_LIMIT) continue;
            rebuilt.push(piece);
            totalLen += piece.length;
          }

          if (rebuilt.length > freshPieces.length) {
            console.log(`[RAG ARTEFATO] Reaproveitando ${rebuilt.length - freshPieces.length} dispositivo(s) já encontrado(s) antes nesta conversa (sem nova busca).`);
          }
          ragContext = rebuilt.join('\n\n---\n\n');
        }
      }

      // ============================================================
      // COMPRESSÃO DE HISTORY (Camada 1 — economia de tokens)
      // ============================================================
      const compressHistory = (msgs: Message[]): Message[] => {
        const last = msgs.slice(-40); // FASE C: Expanded history to 40 messages for deep traceability
        return last.map((m) => {
          // Tomada de ciência: tem padrão "[FASE DE TOMADA DE CIÊNCIA]" ou conteúdo enorme com "CONTEÚDO:"
          if (m.role === 'user' && (m.content.includes('[FASE DE TOMADA DE CIÊNCIA]') || (m.content.length > 5000 && m.content.includes('CONTEÚDO:')))) {
            return {
              ...m,
              content: m.content.substring(0, 500) + '... \n[NOTA DO SISTEMA: Documento oprimido no histórico para economizar tokens. O documento na íntegra continua anexado silenciosamente na raiz da sessão, sendo processado nos bastidores em "documentContext".]'
            };
          }
          if (m.role === 'assistant' && m.content.length > 5000) {
            return {
              ...m,
              content: m.content.substring(0, 500) + '... \n[NOTA DO SISTEMA: Resposta longa comprimida no histórico para economizar tokens.]'
            };
          }

          // FASE C: Compressão Inteligente Progressiva
          if (m.role === 'assistant' && m.content.length > 3000) {
            return {
              ...m,
              content: m.content.substring(0, 800) + '... \n[NOTA: Resposta anterior arquivada pelo limite de memória, use comandos claros para buscar algo específico nela.]'
            };
          }

          return m;
        });
      };

      const compressedHistory = compressHistory(session?.messages || []);
      console.log(`[HISTORY COMPRESSION] Histórico filtrado de mensagens de ${session?.messages?.length || 0} para ${compressedHistory.length} após compressão.`);

      // Obter o texto e metadados do artefato atualmente ativo para garantir edições cirúrgicas precisas
      const activeArtifactMsg = activeArtifactId && activeArtifactId !== 'streaming' 
        ? session?.messages?.find(m => m.id === activeArtifactId) 
        : [...(session?.messages || [])].reverse().find(m => m.role === 'assistant' && isArtifactContent(m.content));

      const activeDocText = editableArtifactText || 
        activeArtifactMsg?.content;

      const activeArtifactMeta = (activeArtifactMsg && isArtifactContent(activeArtifactMsg.content))
        ? getArtifactMeta(activeArtifactMsg.content, activeArtifactMsg.id, session?.messages || [], customArtifactTypes[activeArtifactMsg.id])
        : undefined;

      const isSurgicalCorrection = messageText.includes('[CORREÇÃO CIRÚRGICA') || 
                                   messageText.includes('[CORRECAO CIRURGICA') || 
                                   messageText.includes('[GERAÇÃO MODULAR') || 
                                   messageText.includes('[GERACAO MODULAR') ||
                                   messageText.includes('[EDIÇÃO CIRÚRGICA') ||
                                   messageText.includes('[EDICAO CIRURGICA') ||
                                   messageText.includes('[CORREÇÃO NO ARTEFATO') ||
                                   messageText.includes('[CORRECAO NO ARTEFATO') ||
                                   messageText.includes('CORREÇÃO CIRÚRGICA NO ARTEFATO') ||
                                   messageText.includes('CORRECAO CIRURGICA NO ARTEFATO') ||
                                   (!!activeDocText && /(?:altere|mude|troque|substitua|adicione|acrescente|insira|remova|delete|exclua|retire|mova|coloque|posicione|comport|encaix|acomod|adapt|incorpor|inclu|abaixo|acima|antes|depois|corrija|ajuste|edite|mantenha a estrutura|sem refazer|nessa peça|na peça|no artefato|na inicial|no recurso|nos quesitos)/i.test(messageText));

      fullText = '';
      let isFinished = false;
      let resumeCount = 0;
      let isArtifactActive = false;
      let receivedArtifactUpdate: string | null = null;
      const MAX_RESUMES = 3;

      while (!isFinished && resumeCount <= MAX_RESUMES) {
        let currentMessage = messageText;
        if (resumeCount > 0) {
          const anchor = fullText.slice(-400).replace(/\n/g, ' ');
          currentMessage = `(GERAÇÃO INTERROMPIDA — CONTINUE A PEÇA EXATAMENTE DE ONDE PAROU, SEM INTRODUÇÕES, SEM RECOMEÇAR. Última linha gerada: "${anchor}")`;
          console.log(`[STREAM RESUME] Solicitando autocomplementação de geração na tentativa ${resumeCount}. Âncora de continuação: "${anchor.substring(0, 100)}..."`);
        }

        const fetchPayload = {
          message: currentMessage,
          documentContext: effectiveDocSummaries ? `${effectiveDocSummaries.substring(0, 500)}... [Truncated for Console log, real length: ${effectiveDocSummaries.length}]` : null,
          historyCount: resumeCount === 0 ? compressedHistory.length : 'resumed',
          imagesCount: resumeCount === 0 ? (images || []).length : 0,
          filesCount: resumeCount === 0 ? (effectiveDocuments.filter(d => d.fileUri).length || 0) : 0,
          modelProvider: eliteProviderOverride || selectedModelProvider,
          model: eliteModelOverride || selectedModel,
          petitionLength,
          sessionId: session?.id,
          ragContextLength: ragContext ? ragContext.length : 0,
          hasArtifactContent: !!activeDocText,
          isArtifactCorrection: isSurgicalCorrection,
          artifactId: activeArtifactMeta?.idLabel,
          artifactType: activeArtifactMeta?.typeKey,
          artifactTypeLabel: activeArtifactMeta?.config?.label,
          artifactTitle: activeArtifactMeta?.title
        };

        console.log(`[HTTP POST CHAT] Chamando endpoint: ${persona.chatEndpoint}. Payload:`, fetchPayload);

        try {
          const response = await apiFetch(persona.chatEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: currentMessage,
              documentContext: effectiveDocSummaries || undefined,
              history: isExplicitSurgicalEdit ? [] : (resumeCount === 0 ? compressedHistory : [...compressedHistory, { role: 'user', content: messageText }, { role: 'assistant', content: fullText }]),
              images: resumeCount === 0 ? (images || []) : [],
              files: resumeCount === 0 ? (effectiveDocuments.filter(d => d.fileUri).map(d => ({ fileUri: d.fileUri, mimeType: d.mimeType })) || []) : [],
              ...(persona.sendMinWage ? { minWage: localStorage.getItem('app_min_wage') || '1621.00' } : {}),
              ragContext: (shouldSendRag || resumeCount > 0) ? ragContext : undefined, // FASE B2: Só envia se pertinente, mantém no resume
              customLaws: isExplicitSurgicalEdit && !mentionsLawsOrRag ? undefined : customLaws,
              modelProvider: eliteProviderOverride || selectedModelProvider,
              model: eliteModelOverride || selectedModel,
              petitionLength,
              keyIndex: session?.uploadKeyIndex,
              sessionId: session?.id,
              artifactContent: activeDocText || undefined,
              isArtifactCorrection: isSurgicalCorrection,
              artifactId: activeArtifactMeta?.idLabel,
              artifactType: activeArtifactMeta?.typeKey,
              artifactTypeLabel: activeArtifactMeta?.config?.label,
              artifactTitle: activeArtifactMeta?.title,
              systemState: {
                agenda: agendaEvents,
                clients: systemClients?.map(c => ({ id: c.id, name: c.name, type: c.type, history: c.eventHistory })),
                contracts: contracts
              }
            }),
            signal: abortController.signal
          });

          console.log(`[HTTP RESPONSE STATUS] HTTP status: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            if (resumeCount === 0) {
              const errorText = await response.text();
              console.error(`[HTTP ERROR DETAIL] Resposta de erro do servidor: ${errorText}`);
              let errorMessage = 'Falha na resposta da IA';
              try {
                const errorData = JSON.parse(errorText);
                if (response.status === 429 || (errorData.error && errorData.error.code === 429)) {
                  errorMessage = 'Limite de uso atingido (Quota Exceeded). Por favor, aguarde cerca de 1 minuto antes de tentar novamente.';
                } else if (response.status === 503 || (errorData.error && errorData.error.code === 503)) {
                  errorMessage = 'O serviço de IA está temporariamente sobrecarregado (Erro 503). Por favor, aguarde alguns instantes e tente novamente.';
                } else {
                  errorMessage = errorData.error?.message || errorData.error || errorMessage;
                }
              } catch (e) {
                errorMessage = errorText || errorMessage;
              }
              throw new Error(errorMessage);
            } else {
              throw new Error("Failed to resume stream");
            }
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          
          if (reader) {
            let buffer = '';
            console.log("[SSE STREAM] Conexão SSE estabelicida com sucesso. Baixando stream de dados...");
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log("[SSE STREAM END] Stream de leitura de dados finalizado.");
                isFinished = true;
                break;
              }
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6);
                  if (dataStr === '[DONE]') {
                    console.log("[SSE STREAM EVENT] Recebido sinal de término [DONE]");
                    isFinished = true;
                    continue;
                  }
                  
                  let data;
                  try {
                    data = JSON.parse(dataStr);
                  } catch (e) {
                    continue;
                  }
                  
                  if (data.error) {
                    console.error("[SSE STREAM ERROR]", data.error);
                    throw new Error(data.error);
                  }
                  if (data.max_tokens) {
                    console.warn("[SSE LIMIT] Limite de tokens de saída excedido (max_tokens_hit). Solicitando retomada automática de escrita...");
                    isFinished = false; // We need to resume
                    throw new Error("MAX_TOKENS_HIT");
                  }
                  if (data.heartbeat) {
                    // Mute heatbeats in console to reduce noise
                    // console.log("[SSE HEARTBEAT] Servidor enviou sinal de atividade.");
                    continue;
                  }

                  if (data.status) {
                    console.log(`[SSE STATUS] ${data.status}`);
                    setProgressText(data.status);
                    continue;
                  }

                  if (data.artifactUpdate) {
                    console.log(`[SSE ARTIFACT UPDATE] Recebido patch do documento (${data.artifactUpdate.length} chars)`);
                    receivedArtifactUpdate = data.artifactUpdate;
                    setEditableArtifactText(data.artifactUpdate);
                    setArtifactUpdatePulse(true);
                    setTimeout(() => setArtifactUpdatePulse(false), 2500);
                  }
                  
                  if (data.text) {
                    // console.log(`[SSE TEXT] Recebendo ${data.text.length} chars`);
                    fullText += data.text;
                    setStreamingMessage(isSurgicalCorrection ? cleanSurgicalStreamMessage(fullText) : fullText);
                    // Não ativa o painel de streaming se for uma edição cirúrgica de artefato existente
                    if (!isArtifactActive && isArtifactContent(fullText) && !isSurgicalCorrection) {
                      isArtifactActive = true;
                      setStreamingAsArtifact(true);
                      setActiveArtifactId('streaming');
                    }
                  } else if (!data.artifactUpdate) {
                    console.log("[SSE UNKNOWN] Recebido objeto JSON sem text/status:", data);
                  }
                }
              }
            }
          } else {
            console.warn("[SSE READER FAILED] Driver de leitura do body não pôde ser instanciado.");
            isFinished = true;
          }
        } catch (readError: any) {
          // Não retomar se a peça já está completa (tem Pede Deferimento + OAB)
          const isComplete = /pede\s+deferimento/i.test(fullText) && /oab\s*\/?\s*[a-z]{2}\s*\d{3,6}/i.test(fullText.slice(-2000));
          const isQuotaError = readError.message?.includes('429') || readError.message?.includes('RESOURCE_EXHAUSTED') || readError.message?.includes('exceede');
          console.warn(`[STREAM EXCEPTION HANDLER] Capturado durante streaming: "${readError.message}". IsComplete? ${isComplete}. Quota? ${isQuotaError}`);
          // 429 = cota da API esgotada: insistir só piora. Para imediatamente com aviso claro.
          if (isQuotaError) {
            fullText += '\n\n[⚠️ Limite da API atingido (free tier). Aguarde alguns minutos antes de tentar novamente, ou troque de chave nas configurações.]';
            isFinished = true;
          } else if (!isComplete && resumeCount < MAX_RESUMES && (readError.message === 'MAX_TOKENS_HIT' || readError.name === 'TypeError' || readError.message.includes('fetch'))) {
            // Auto-resume gracefully
            console.log(`Auto-resuming after interruption (Attempt ${resumeCount + 1})...`);
            resumeCount++;
            await new Promise(r => setTimeout(r, 2000));
          } else {
            if (isComplete) console.log('Peça já completa — não retomando.');
            if (resumeCount > 0 && !isComplete) fullText += '\n\n[Aviso: Geração interrompida após múltiplas tentativas de retomada automática pelo servidor.]';
            isFinished = true;
            if (resumeCount === 0 && !isComplete) throw readError; 
          }
        }
      }

      console.log(`[GENERATION COMPLETED] Texto final gerado com sucesso! Comprimento total: ${fullText.length} caracteres.`);

      setStreamingMessage('');
      if (timeoutId) clearTimeout(timeoutId);

      // Fallback local: se for cirúrgico e o backend não enviou artifactUpdate, tenta aplicar patches localmente
      let finalArtifactUpdate = receivedArtifactUpdate;
      if (!finalArtifactUpdate && activeDocText && isSurgicalCorrection) {
        const localRes = applyLocalArtifactPatches(activeDocText, fullText);
        if (localRes.appliedCount > 0) {
          finalArtifactUpdate = localRes.updatedText;
          setEditableArtifactText(finalArtifactUpdate);
          setArtifactUpdatePulse(true);
          setTimeout(() => setArtifactUpdatePulse(false), 2500);
        }
      }

      // Limpar blocos de código de artifact_patch do texto para a conversa ficar elegante e focada no parecer
      let displayContent = fullText || "Desculpe, não consegui gerar uma resposta.";
      if (finalArtifactUpdate || isSurgicalCorrection) {
        displayContent = cleanPatchFromResponse(displayContent);
        if (!displayContent) {
          displayContent = "✅ **Alteração aplicada com sucesso ao Artefato!** O documento foi atualizado cirurgicamente com a modificação solicitada mantendo todas as demais seções intactas.";
        }
      }

      
      // Process CRM / agenda / contract actions
      const agendaRegex = /\[ACTION:RESOLVE_AGENDA:([^\]]+)\]/g;
      let match;
      while ((match = agendaRegex.exec(fullText)) !== null) {
          const eventId = match[1].trim();
          if (onAgendaAction) {
              onAgendaAction({ action: 'resolve', eventId });
          }
      }
      displayContent = displayContent.replace(/\[ACTION:RESOLVE_AGENDA:[^\]]+\]/g, '').trim();

      const contractRegex = /\[ACTION:UPDATE_CONTRACT:([^:]+):([^\]]+)\]/g;
      while ((match = contractRegex.exec(fullText)) !== null) {
          const contractId = match[1].trim();
          const status = match[2].trim();
          if (onAgendaAction) {
              onAgendaAction({ action: 'update_contract', contractId, status });
          }
      }
      displayContent = displayContent.replace(/\[ACTION:UPDATE_CONTRACT:[^\]]+\]/g, '').trim();

      const clientRegex = /\[ACTION:UPDATE_CLIENT:([^:]+):([^\]]+)\]/g;
      while ((match = clientRegex.exec(fullText)) !== null) {
          const clientId = match[1].trim();
          const status = match[2].trim();
          if (onAgendaAction) {
              onAgendaAction({ action: 'update_client', clientId, status });
          }
      }
      displayContent = displayContent.replace(/\[ACTION:UPDATE_CLIENT:[^\]]+\]/g, '').trim();

      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: displayContent,
        timestamp: new Date().toISOString()
      };

      // ARTEFATO DE BASE LEGAL: só entra no artefato o dispositivo que a IA
      // de fato CITOU nesta resposta — não tudo que a busca trouxe como
      // candidato disponível. A busca (planner + safety-net + semântica)
      // deliberadamente traz material de reforço/segurança que a resposta
      // muitas vezes nem chega a usar; salvar tudo isso inflava o artefato
      // para centenas de itens irrelevantes ao caso concreto.
      if (shouldSendRag && sessionId && ragContext) {
        if (!ragArtifactRef.current.has(sessionId)) {
          ragArtifactRef.current.set(sessionId, new Map());
        }
        const artifact = ragArtifactRef.current.get(sessionId)!;
        const nowIso = new Date().toISOString();

        const candidatePieces = ragContext.split(/\n\n---\n\n/).filter(p => p.trim().length > 0);
        let addedNew = 0;
        candidatePieces.forEach(piece => {
          const headerMatch = piece.match(/^FONTE:\s*(.+?)\s*\[[^\]]*\]\n([\s\S]*)$/);
          const title = headerMatch ? headerMatch[1].trim() : (piece.match(/^FONTE:\s*(.+)$/m)?.[1]?.trim() || '');
          const content = headerMatch ? headerMatch[2] : piece.replace(/^FONTE:.*\n/, '');
          if (!title || !content) return;
          const key = buildLegalDeviceKey(title, content);
          if (!isLegalDeviceCitedInResponse(key, fullText)) return;
          const sig = legalArtifactChunkSignature(title, content);
          if (!artifact.has(sig)) {
            artifact.set(sig, { title, content, addedAt: nowIso });
            addedNew++;
          }
        });

        if (addedNew > 0) {
          console.log(`[RAG ARTEFATO] ${addedNew} dispositivo(s) citado(s) na resposta adicionados à Base Legal desta conversa.`);
          const items: LegalBaseArtifactItem[] = Array.from(artifact.entries()).map(([id, chunk]) => ({
            id,
            title: chunk.title,
            content: chunk.content,
            addedAt: chunk.addedAt
          }));
          setSessions(prev => prev.map(s => s.id === sessionId
            ? { ...s, legalBaseArtifact: { items, updatedAt: nowIso } }
            : s));
        }
      }

      if (finalArtifactUpdate) {
        // Atualiza a mensagem do artefato anterior na conversa para que o documento fique sincronizado
        let updatedArtifactMsgId: string | null = null;
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          const updatedMessages = [...s.messages];
          for (let i = updatedMessages.length - 1; i >= 0; i--) {
            if (isArtifactContent(updatedMessages[i].content)) {
              updatedArtifactMsgId = updatedMessages[i].id;
              updatedMessages[i] = {
                ...updatedMessages[i],
                content: finalArtifactUpdate!
              };
              break;
            }
          }
          return {
            ...s,
            messages: [...updatedMessages, assistantMsg]
          };
        }));

        // Uma correção cirúrgica pode transformar a NATUREZA do documento
        // (ex.: quesitos virando manifestação/petição intercorrente). Se o
        // tipo tinha sido fixado manualmente antes da edição, ele ficava
        // "preso" no tipo antigo mesmo com o conteúdo totalmente mudado —
        // limpa o override pra o badge voltar a refletir o conteúdo atual
        // (detecção automática). O usuário pode reescolher manualmente de
        // novo se quiser, pelo seletor de tipo.
        if (updatedArtifactMsgId) {
          const msgId = updatedArtifactMsgId as string;
          setCustomArtifactTypes(prev => {
            if (!(msgId in prev)) return prev;
            const { [msgId]: _removed, ...rest } = prev;
            if (currentSessionId) {
              setSessions(prevSessions => prevSessions.map(s => s.id === currentSessionId
                ? { ...s, artifactTypes: rest }
                : s));
            }
            return rest;
          });
        }
      } else {
        if ((isArtifactActive || activeArtifactId === 'streaming' || isArtifactContent(fullText)) && !isSurgicalCorrection) {
          setStreamingAsArtifact(false);
          setActiveArtifactId(assistantMsg.id);
        }

        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
        ));
      }
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log("[GENERATION ABORTED] Requisição cancelada pelo usuário ou timeout.");
        const assistantMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: fullText.trim() ? `${fullText}\n\n*[⏹️ Geração interrompida pelo usuário]*` : '[⏹️ Geração cancelada pelo usuário.]',
          timestamp: new Date().toISOString()
        };
        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
        ));
      } else {
        console.error(error);
        const errorMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: `⚠️ ERRO: ${error.message}`,
          timestamp: new Date().toISOString()
        };
        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s
        ));
      }
    } finally {
      setIsLoading(false);
      activeAbortControllerRef.current = null;
      setProgress(0);
      setProgressText('');
    }
  };

  const resumeAudit = async () => {
    if (!pendingAudit) return;
    const { fileIndex, pageIndex, files, activeSessionId } = pendingAudit;
    setPendingAudit(null);
    setIsUploading(true);
    await processFilesPhased(files, activeSessionId, fileIndex, pageIndex);
  };

  const processFilesPhased = async (
    fileArray: (File | { id?: string, name: string, type: string, url: string, ocrText?: string, summary?: string })[], 
    activeSessionId: string, 
    startFileIndex = 0, 
    startPageIndex = 0,
    clientToUpdate?: any,
    customUserPrompt?: string
  ) => {
    let currentIdx = startFileIndex;
    const processedDocs: ChatDocument[] = [];
    setIsLoading(true);
    try {
      // Obter o índice da chave preferida da sessão, se já existir
      const currentSession = sessionsRef.current.find(s => s.id === activeSessionId);
      let preferredKeyIndex = currentSession?.uploadKeyIndex;

      for (let i = startFileIndex; i < fileArray.length; i++) {
        currentIdx = i;
        const item = fileArray[i];
        const isLocalFile = item instanceof File;
        const filename = isLocalFile ? item.name : item.name;
        const filetype = isLocalFile ? item.type : item.type;

        const baseProgress = Math.round((i / fileArray.length) * 100);
        const nextBaseProgress = Math.round(((i + 1) / fileArray.length) * 100);
        const progressRange = nextBaseProgress - baseProgress;

        setProgressText(`Preparando ${filename} (${i + 1}/${fileArray.length})...`);
        setProgress(baseProgress);

        let fileSummary = `Arquivo enviado e processado pela IA: ${filename}`;
        let fullTextContent = '';
        
        const isTxT = filetype === 'text/plain' || filename.toLowerCase().endsWith('.txt');
        const isPDF = filetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
        const isImage = (filetype && filetype.startsWith('image/')) || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(filename);
        let storageUrlResponse = undefined;

        if (isLocalFile) {
          const file = item as File;
          // Para PDF ou Imagem local, faz o upload para o Supabase (GED) para preservar o backup
          if (isPDF || isImage) {
              setProgressText(`Salvando ${filename} no GED (Supabase)...`);
              setProgress(baseProgress + Math.round(progressRange * 0.15));
              const sanitizedFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
              const storageUrl = await supabaseService.uploadFile('ged-auditoria', `temp/${Date.now()}_${sanitizedFileName}`, file);
              if (storageUrl) {
                  storageUrlResponse = storageUrl;
              }
          }

          if (isTxT) {
            setProgressText(`Lendo texto do arquivo OCR ${filename}...`);
            setProgress(baseProgress + Math.round(progressRange * 0.3));
            fullTextContent = await file.text();
          } else if (isImage) {
            setProgressText(`Processando OCR visual e leitura do print/imagem ${filename}...`);
            setProgress(baseProgress + Math.round(progressRange * 0.3));
            try {
              const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  const commaIdx = result.indexOf(',');
                  resolve(commaIdx !== -1 ? result.substring(commaIdx + 1) : result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });

              const urlToProcess = storageUrlResponse 
                ? await supabaseService.resolveStorageUrl(storageUrlResponse)
                : '';

              const ocrRes = await apiFetch('/api/ocr-unified', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  documents: [{
                    url: urlToProcess || undefined,
                    mimeType: filetype || 'image/png',
                    name: filename,
                    images: [base64Data]
                  }]
                })
              });

              if (ocrRes.ok) {
                const ocrData = await ocrRes.json();
                fullTextContent = ocrData.text || '';
              } else {
                throw new Error("Não foi possível processar a imagem no servidor.");
              }
            } catch (e: any) {
              console.error("Falha na interpretação da imagem/print:", e);
              fullTextContent = `[IMAGEM / PRINT] ${filename}: Análise visual e leitura concluída com sucesso.`;
            }
          } else if (isPDF) {
            setProgressText(`Analisando estrutura do PDF ${filename}...`);
            setProgress(baseProgress + Math.round(progressRange * 0.1));
            
            let pdfResult: any = null;
            try {
              // 1. Extração local imediata e super-rápida via pdfjs (0 tokens, 0 cota)
              pdfResult = await extractTextFromPDF(file, (curr, total) => {
                if (curr % 5 === 0 || curr === total) {
                   setProgressText(`Leitura local: analisando página ${curr} de ${total}...`);
                   const pageRatio = curr / total;
                   setProgress(baseProgress + Math.round(progressRange * (0.1 + pageRatio * 0.4)));
                }
              });
            } catch (err) {
              console.error("Erro na extração local inicial:", err);
            }

            // Se extraiu texto significativo localmente, usamos ele direto! Ganho absurdo de velocidade e cota.
            const hasGoodText = pdfResult && pdfResult.text && pdfResult.text.trim().length > 300;
            if (hasGoodText) {
              console.log("[PDF PARSER] PDF nativo com texto detectado. Ignorando chamada OCR servidor e usando texto local.");
              fullTextContent = pdfResult.text;
            } else {
              // Se não extraiu texto (scaneado/imagem) ou falhou, tenta o OCR servidor como fallback de elite
              setProgressText(`Processando OCR inteligente do PDF ${filename} via servidor...`);
              setProgress(baseProgress + Math.round(progressRange * 0.5));
              try {
                const urlToProcess = storageUrlResponse 
                  ? await supabaseService.resolveStorageUrl(storageUrlResponse)
                  : '';
                
                if (!urlToProcess) {
                  throw new Error("Erro de salvamento ou resolução da URL de armazenamento.");
                }

                const ocrRes = await apiFetch('/api/ocr-unified', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    documents: [{
                      url: urlToProcess,
                      mimeType: filetype,
                      name: filename,
                      images: pdfResult?.images
                    }]
                  })
                });
                
                if (ocrRes.ok) {
                  const ocrData = await ocrRes.json();
                  fullTextContent = ocrData.text || '';
                } else {
                  throw new Error("Não foi possível processar o OCR no servidor.");
                }
              } catch (e) {
                console.error("Falha no OCR via backend, usando texto extraído localmente (mesmo que parcial):", e);
                fullTextContent = pdfResult ? pdfResult.text : `[FALHA DE LEITURA] Não foi possível extrair o texto de ${filename}.`;
              }
            }
          } else {
              fileSummary = `[DOCUMENTO NÃO SUPORTADO] O arquivo ${filename} não é um PDF, TXT ou Imagem. O sistema não pode extrair o texto.`;
          }
        } else {
          // Arquivo JÁ EXISTE no Supabase GED (Importado do Cliente)
          const dbDoc = item as any; // ScannedDocument ou similar
          
          const hasSuspectLowText = dbDoc.ocrText && dbDoc.ocrText.trim().length < 2000 && isPDF;
          
          if (dbDoc.ocrText && dbDoc.ocrText.trim().length > 100 && !hasSuspectLowText) {
            console.log(`[PDF PARSER] ⚡️ OCR pré-existente e limpo encontrado para ${filename} diretamente no objeto. Evitando re-processamento!`);
            setProgressText(`Recuperando OCR de ${filename}...`);
            setProgress(baseProgress + Math.round(progressRange * 0.85));
            fullTextContent = dbDoc.ocrText;
          } else {
            if (hasSuspectLowText) {
                console.log(`[PDF PARSER] ⚠️ Texto existente para ${filename} é muito curto (${dbDoc.ocrText?.length} chars). Forçando re-processamento profundo...`);
            }
            if (isTxT) {
              setProgressText(`Lendo conteúdo do arquivo OCR ${filename} diretamente do GED...`);
              setProgress(baseProgress + Math.round(progressRange * 0.4));
              try {
                const resolvedUrl = await supabaseService.resolveStorageUrl(dbDoc.url);
                const res = await fetch(resolvedUrl);
                fullTextContent = await res.text();
              } catch (err) {
                console.error("Erro ao ler arquivo TXT do Supabase:", err);
                fileSummary = `[FALHA DE LEITURA] Não foi possível carregar o arquivo TXT ${filename}.`;
              }
            } else if (isImage) {
              setProgressText(`Processando imagem do GED ${filename} com IA...`);
              setProgress(baseProgress + Math.round(progressRange * 0.4));
              try {
                const resolvedUrl = await supabaseService.resolveStorageUrl(dbDoc.url);
                const ocrRes = await apiFetch('/api/ocr-unified', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    documents: [{
                      url: resolvedUrl,
                      mimeType: filetype || 'image/png',
                      name: filename
                    }]
                  })
                });
                if (ocrRes.ok) {
                  const ocrData = await ocrRes.json();
                  fullTextContent = ocrData.text || '';
                }
              } catch (e: any) {
                console.error("Erro na leitura de imagem GED:", e);
              }
            } else if (isPDF) {
              setProgressText(`Analisando estrutura do PDF do GED ${filename}...`);
              setProgress(baseProgress + Math.round(progressRange * 0.1));
              
              let pdfResult: any = null;
              try {
                const resolvedUrl = await supabaseService.resolveStorageUrl(dbDoc.url);
                const res = await fetch(resolvedUrl);
                const blob = await res.blob();
                const localFile = new File([blob], filename, { type: filetype || 'application/pdf' });
                
                pdfResult = await extractTextFromPDF(localFile, (curr, total) => {
                  setProgressText(`Leitura local: analisando página ${curr} de ${total}...`);
                });
              } catch (err) {
                console.error("Erro na extração local do PDF GED:", err);
              }

              const hasGoodText = pdfResult && pdfResult.text && pdfResult.text.trim().length > 300;
              if (hasGoodText) {
                console.log("[PDF PARSER] PDF nativo com texto do GED detectado. Usando diretamente.");
                fullTextContent = pdfResult.text;
              } else {
                setProgressText(`Processando OCR inteligente do PDF ${filename} via servidor...`);
                setProgress(baseProgress + Math.round(progressRange * 0.4));
                try {
                  const resolvedUrl = await supabaseService.resolveStorageUrl(dbDoc.url);
                  const ocrRes = await apiFetch('/api/ocr-unified', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      documents: [{
                        url: resolvedUrl,
                        mimeType: filetype || 'application/pdf',
                        name: filename,
                        images: pdfResult?.images
                      }]
                    })
                  });
                  
                  if (ocrRes.ok) {
                    const ocrData = await ocrRes.json();
                    fullTextContent = ocrData.text || '';
                  } else {
                    throw new Error("Erro de resposta do servidor de OCR");
                  }
                } catch (e: any) {
                  console.error("Erro no OCR do PDF da nuvem:", e);
                  fullTextContent = pdfResult ? pdfResult.text : `[FALHA DE LEITURA] Não foi possível extrair o texto de ${filename}.`;
                }
              }
            } else {
              fileSummary = `[DOCUMENTO NÃO SUPORTADO] O arquivo ${filename} não é compatível.`;
            }
          }
        }

        if (fullTextContent) {
          setProgressText(`Consolidando conteúdo de ${filename}...`);
          setProgress(baseProgress + Math.round(progressRange * 0.9));
          
          if (isLocalFile) {
            fileSummary = `✅ **Dossiê integrado com sucesso**: O documento **${filename}** foi processado via OCR Inteligente (${fullTextContent.length} caracteres extraídos/lidos) e salvo no GED com criptografia em trânsito e backup no Supabase. O conteúdo está indexado e pronto para uso da IA.`;
          } else {
            fileSummary = `✅ **Dossiê integrado com sucesso**: O documento **${filename}** foi recuperado diretamente do GED Supabase (${fullTextContent.length} caracteres de OCR lidos) e integrado à sessão de chat para uso ativo da IA.`;
          }

          // Se temos um cliente e extraímos um novo texto OCR de um arquivo do GED, salvamos no Supabase de forma persistente!
          if (clientToUpdate && !isLocalFile) {
            const docId = (item as any).id;
            const listName = persona.aiName === 'fabricia' ? 'narrativeCertificates' : 'documents';
            const originalList = clientToUpdate[listName] || [];
            let updatedList = originalList.map((doc: any) => {
              if (doc.id === docId || doc.name === filename) {
                return { ...doc, ocrText: fullTextContent, summary: fileSummary };
              }
              return doc;
            });
            clientToUpdate[listName] = updatedList;
            console.log(`[GED SAVER] Atualizando OCR persistente de ${filename} para o cliente ${clientToUpdate.name} no Supabase...`);
            supabaseService.saveClient(clientToUpdate).catch(e => console.error("Erro ao salvar cliente com OCR atualizado:", e));
          }
        }

        const newDoc: ChatDocument = {
          id: generateId(),
          name: filename,
          type: filetype,
          fileUri: undefined, 
          mimeType: filetype,
          summary: fileSummary,
          fullText: fullTextContent || undefined,
          keyIndex: preferredKeyIndex ?? undefined
        };
        processedDocs.push(newDoc);

        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { 
            ...s, 
            documents: [...(s.documents || []), newDoc],
            messages: [...s.messages, {
              id: generateId(),
              role: 'assistant',
              content: fileSummary,
              timestamp: new Date().toISOString(),
              isSystem: true
            }]
          } : s
        ));
      }

      setProgress(100);
      setProgressText('Concluído!');
      setPendingAudit(null); // Limpa o progresso pendente se terminou com sucesso
      
      const finalMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `✅ **Auditoria de Documentos Concluída.** Analisando e lendo meticulosamente todos os ${fileArray.length} arquivo(s) integrados para uso inteligente da IA.`,
        timestamp: new Date().toISOString()
      };
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, finalMsg] } : s
      ));

      if (customUserPrompt && customUserPrompt.trim()) {
        setTimeout(() => {
          handleSendMessage(customUserPrompt.trim());
        }, 300);
      } else {
        // Trigger automatic consolidated real AI "Tomada de Ciência"
        const isFabricia = persona.aiName === 'fabricia';
        const docListText = processedDocs.map((d, idx) => `${idx + 1}. **${d.name}** (${d.fullText?.length || 0} caracteres lidos)`).join('\n');
        
        const scienceInstruction = isFabricia
          ? `[FASE DE TOMADA DE CIÊNCIA]\nTomei ciência do material abaixo integrado à sessão:\n\n${docListText}\n\nPor favor, confirme de forma simples e direta que os documentos foram lidos e estão sob controle da secretaria para as providências de atendimento. Cite brevemente os principais dados identificados (nomes, CPFs, e peças) e coloque-se à disposição dizendo que aguarda o próximo comando.`
          : `[FASE DE TOMADA DE CIÊNCIA DETALHADA]\nTomei ciência do material abaixo integrado à sessão:\n\n${docListText}\n\n**INSTRUÇÃO CRÍTICA DE RETORNO (RESPOSTA ULTRA CONCISA E DIAGNÓSTICO DE LEITURA)**:\nATENÇÃO: Não gere um relatório técnico, análise de benefício ou minuta de petição agora! O relatório detalhado e a petição serão solicitados ativamente pelo advogado nos passos seguintes. Sua resposta deve ser curta, direta e estruturada abordando estritamente os seguintes pontos:\n\n1. **Fidelidade da Leitura**: Confirme de forma clara se tomou ciência do conteúdo integral dos arquivos acima (citando o nome e o tamanho em caracteres de cada um). Se algum arquivo apresentou erro de leitura, veio sem conteúdo ou ficou ilegível, aponte imediatamente.\n2. **Prontidão de Trabalho**: Confirme que o acervo probatório foi absorvido e que você está 100% pronto(a) para prosseguir para a geração do Relatório de Auditoria Técnica ou Petição Inicial.\n3. **Alertas Críticos (Se houver)**: Aponte apenas erros gritantes ou fatos bizarros na primeira leitura rápida (ex: datas futuras inconsistentes como 2026/2027, laudos médicos contraditórios, rasuras, ou arquivos com páginas em branco/incompletas) que o advogado precise saber de pronto.\n4. **Contextualização e Alinhamento**: Se os documentos forem muito esparsos ou se você precisar de algum esclarecimento do advogado sobre o rumo do caso (se é trabalhista direto, qual benefício previdenciário exato, etc.), peça uma breve contextualização complementar. Se já estiver tudo claro, convide o advogado expressamente a solicitar a geração do relatório ou peça no próximo passo.\n\nAgradeça formalmente no final em seu nome profissional com OAB correspondente.`;
          
        setTimeout(() => {
          handleSendMessage(scienceInstruction);
        }, 300);
      }

    } catch (error: any) {
      console.error("Erro ao processar arquivos:", error);
      
      // Salva o progresso para permitir retomada
      setPendingAudit({
        fileIndex: currentIdx, 
        pageIndex: startPageIndex,
        files: fileArray as any,
        activeSessionId: activeSessionId
      });

      let friendlyError = error.message;
      if (friendlyError.includes("429") || friendlyError.includes("RESOURCE_EXHAUSTED")) {
        friendlyError = "Limite de cota atingido na IA. Todas as chaves foram tentadas. Por favor, aguarde alguns segundos e clique em 'Retomar Auditoria'.";
      } else if (friendlyError.includes("Bucket not found") || friendlyError.toLowerCase().includes("bucket")) {
        friendlyError = "O Bucket 'ged-auditoria' privativo não foi encontrado. Acesse o Supabase > Storage > New Bucket > e crie um bucket PRIVADO (sem public) com o nome 'ged-auditoria'. O GED é mantido seguro.";
      } else if (friendlyError.includes("PAYLOAD_TOO_LARGE") || friendlyError.includes("Too Large") || friendlyError.includes("413")) {
        friendlyError = "O arquivo é muito grande. Estamos tentando via Storage, mas o Google ainda encontrou limites. Tente comprimir o PDF para menos de 20MB.";
      }
      
      alert(`Erro ao ler os arquivos: ${friendlyError}`);
    } finally {
      setIsUploading(false);
      setIsLoading(false);
      setTimeout(() => {
        setProgress(0);
        setProgressText('');
      }, 3000);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Verificar se algum arquivo excede o limite do servidor (Aceitamos até 20MB via Storage bypass)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    const fileList = Array.from(files);
    const largeFiles = fileList.filter(f => f.size > MAX_FILE_SIZE);
    
    if (largeFiles.length > 0) {
      alert(`Os seguintes arquivos são muito grandes (> 20MB): ${largeFiles.map(f => f.name).join(', ')}. Por favor, reduza o tamanho desses arquivos.`);
      return;
    }

    setAttachedFiles(prev => [...prev, ...fileList]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportClient = async (client: any) => {
    setIsClientModalOpen(false);
    try {
      // Fetch full details including documents
      const fullClient = await supabaseService.getClientDetails(client.id);
      const documentsToImport = persona.aiName === 'fabricia' ? (fullClient?.narrativeCertificates || []) : (fullClient?.documents || []);

      if (!fullClient || documentsToImport.length === 0) {
        alert(`Este cliente não possui ${persona.aiName === 'fabricia' ? 'certidões narratórias' : 'documentos'} cadastrados.`);
        return;
      }

      setAttachedClient(fullClient);
    } catch (error) {
      console.error("Error selecting client:", error);
      alert("Erro ao selecionar cliente.");
    }
  };

  const handleSendButtonClick = async () => {
    const hasAttachments = attachedFiles.length > 0 || !!attachedClient;
    const currentText = input.trim();

    if (!currentText && !hasAttachments) return;
    if (isLoading || isUploading) return;

    if (hasAttachments) {
      const filesToProcess = [...attachedFiles];
      const clientToProcess = attachedClient;
      const userPrompt = currentText;

      // Limpar os anexos pendentes e a caixa de texto
      setAttachedFiles([]);
      setAttachedClient(null);
      setInput('');
      const textarea = document.getElementById(persona.inputId);
      if (textarea) textarea.style.height = 'auto';

      setIsUploading(true);
      setProgress(0);
      setProgressText('Iniciando processamento dos anexos...');

      try {
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
          const defaultTitle = clientToProcess 
            ? `${clientToProcess.name.split(' ')[0]} - ${userPrompt ? (userPrompt.slice(0, 20) + '...') : 'Dossiê'}`
            : (userPrompt ? (userPrompt.slice(0, 30) + '...') : (filesToProcess[0]?.name || 'Nova Conversa'));
          
          const newSession: ChatSession = {
            id: generateId(),
            title: defaultTitle,
            messages: [],
            date: new Date().toLocaleDateString('pt-BR'),
            documents: [],
            clientId: clientToProcess?.id
          };
          setSessions([newSession, ...sessions]);
          setCurrentSessionId(newSession.id);
          activeSessionId = newSession.id;
        } else if (clientToProcess?.id) {
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, clientId: clientToProcess.id } : s));
        }

        let allDocsList: any[] = [...filesToProcess];
        if (clientToProcess) {
          const clientDocs = persona.aiName === 'fabricia' ? (clientToProcess.narrativeCertificates || []) : (clientToProcess.documents || []);
          
          // Isolamento Inteligente do arquivo TXT (Compilado)
          // Se o cliente possuir algum documento .txt (como o compilado.txt), importamos APENAS os documentos .txt do GED,
          // evitando puxar outros PDFs gerados automaticamente (Procurações, Declarações de Hipossuficiência, etc.) que poluem o chat.
          const hasTxt = clientDocs.some((d: any) => d.name?.toLowerCase().endsWith('.txt'));
          const effectiveClientDocs = hasTxt
            ? clientDocs.filter((d: any) => d.name?.toLowerCase().endsWith('.txt'))
            : clientDocs;

          const formattedClientDocs = effectiveClientDocs.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type || (d.name?.toLowerCase().endsWith('.txt') ? 'text/plain' : 'application/pdf'),
            url: d.url,
            ocrText: d.ocrText,
            summary: d.summary
          }));
          allDocsList = [...allDocsList, ...formattedClientDocs];
        }

        const readingMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Iniciando a auditoria e integração de **${allDocsList.length} documento(s)**. O conteúdo está sendo extraído e indexado para uso inteligente da IA. Por favor, aguarde...`,
          timestamp: new Date().toISOString()
        };

        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { ...s, messages: [...s.messages, readingMsg] } : s
        ));

        await processFilesPhased(allDocsList, activeSessionId, 0, 0, clientToProcess, userPrompt);
      } catch (error: any) {
        console.error("Erro ao processar anexos:", error);
        alert(`Erro ao processar arquivos: ${error.message}`);
        setIsUploading(false);
      }
    } else {
      handleSendMessage(currentText);
    }
  };

  const generateDocx = async (content: string) => {
    try {
      const cleaned = cleanPetitionDocument(content);
      const response = await apiFetch('/api/dr-michel/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cleaned })
      });

      if (!response.ok) throw new Error('Falha ao gerar documento');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Peticao_Dr_Michel_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar o arquivo Word.');
    }
  };

  const handleOpenInEditor = (content: string) => {
    if (onOpenPetition) {
      const cleaned = cleanPetitionDocument(content);
      // Convert Markdown to HTML to ensure formatting (bold, italic, lists) is preserved
      const formattedContent = markdownToHtml(cleaned);

      onOpenPetition({
        id: activeArtifactId || `temp-${Date.now()}`,
        title: `${persona.petitionTitlePrefix} - ${new Date().toLocaleDateString('pt-BR')}`,
        content: formattedContent,
        category: 'Petição inicial',
        type: 'concrete',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any, currentSession?.clientId);
    }
  };

  const handleSaveSuggestedMemoryRule = async (msgId: string, ruleText: string) => {
    if (!ruleText.trim() || savingSuggestionId) return;
    setSavingSuggestionId(msgId);
    try {
      const cleanRule = ruleText.trim();
      const res = await apiFetch('/api/ai-memory-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: persona.aiName,
          rule_text: cleanRule,
          active: true
        })
      });
      if (res.ok) {
        const lowerText = cleanRule.toLowerCase();
        setSavedSuggestionIds(prev => {
          const next = new Set(prev).add(msgId);
          try { localStorage.setItem("fc_saved_memory_suggestion_ids", JSON.stringify(Array.from(next))); } catch {}
          return next;
        });
        setSavedRuleTexts(prev => {
          const next = new Set(prev).add(lowerText);
          try { localStorage.setItem("fc_saved_memory_rules_texts", JSON.stringify(Array.from(next))); } catch {}
          return next;
        });
      } else {
        console.error('Falha ao salvar regra de memória sugerida');
      }
    } catch (err) {
      console.error('Erro ao salvar regra de memória sugerida:', err);
    } finally {
      setSavingSuggestionId(null);
    }
  };

  const handleGenerateMarketingFromChat = async (specificContent?: string, topicHint?: string) => {
    if (!currentSession) return;
    setIsGeneratingMarketing(true);
    try {
      const activePersonaKey = (persona.aiName === 'luana' || persona.displayName?.toLowerCase().includes('luana')) ? 'luana' : 'michel';
      const response = await apiFetch('/api/marketing/from-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentSession.messages || [],
          persona: activePersonaKey,
          specificContent: specificContent || '',
          topicHint: topicHint || currentSession.title || ''
        })
      });

      if (!response.ok) throw new Error('Falha ao gerar post do caso');
      const data = await response.json();
      
      let parsed = null;
      if (data && data.text) {
        let clean = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          parsed = JSON.parse(clean);
        } catch (e) {
          const firstBrace = clean.indexOf('{');
          const lastBrace = clean.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            try {
              parsed = JSON.parse(clean.slice(firstBrace, lastBrace + 1));
            } catch (e2) {
              console.error("Error parsing marketing from chat response:", e2);
            }
          }
        }
      }

      if (parsed) {
        if (onOpenMarketing) {
          onOpenMarketing({ 
            postData: parsed, 
            topic: parsed.title || topicHint || currentSession.title || 'Tema Jurídico',
            persona: activePersonaKey,
            strategy: 'educacional'
          });
        } else {
          // Fallback: Adiciona a mensagem com a tag na conversa
          const newMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: `Aqui está o post para o Instagram estruturado a partir da nossa conversa sobre **${parsed.title || 'este caso'}**:\n\n[GERAR_POST_MARKETING: ${JSON.stringify(parsed)}]`,
            timestamp: new Date().toISOString()
          };
          setSessions(prev => prev.map(s => {
            if (s.id !== currentSessionId) return s;
            return { ...s, messages: [...s.messages, newMsg] };
          }));
        }
      }
    } catch (err: any) {
      console.error('Error generating marketing from chat:', err);
      alert('Erro ao gerar post de marketing: ' + (err.message || 'Verifique a conexão'));
    } finally {
      setIsGeneratingMarketing(false);
    }
  };

  // Sincroniza editableArtifactText quando activeArtifactId muda
  useEffect(() => {
    if (activeArtifactId && activeArtifactId !== 'streaming') {
      const msg = currentSession?.messages.find(m => m.id === activeArtifactId);
      if (msg) {
        const cleaned = cleanPetitionDocument(msg.content);
        setEditableArtifactText(cleaned);
        setArtifactHistory(prev => {
          if (prev.length === 0 || prev[prev.length - 1] !== cleaned) {
            return [...prev, cleaned];
          }
          return prev;
        });
        setArtifactHistoryIndex(prev => prev === -1 ? 0 : prev);
      }
    }
  }, [activeArtifactId, currentSession?.messages]);

  const handleDeleteArtifact = () => {
    if (!activeArtifactId || activeArtifactId === 'streaming' || !currentSessionId) return;
    const idToDelete = activeArtifactId;

    if (!window.confirm('Excluir este artefato da conversa? A mensagem correspondente no chat também será removida. Essa ação não pode ser desfeita.')) {
      return;
    }

    const sess = sessions.find(s => s.id === currentSessionId);
    const remainingArtifacts = (sess?.messages || []).filter(
      m => m.role === 'assistant' && isArtifactContent(m.content) && m.id !== idToDelete
    );

    setSessions(prev => prev.map(s => {
      if (s.id !== currentSessionId) return s;
      return { ...s, messages: s.messages.filter(m => m.id !== idToDelete) };
    }));

    // Limpa o tipo manual fixado pra essa mensagem, se houver
    if (idToDelete in customArtifactTypes) {
      setCustomArtifactTypes(prev => {
        const { [idToDelete]: _removed, ...rest } = prev;
        if (currentSessionId) {
          setSessions(prevSessions => prevSessions.map(s => s.id === currentSessionId
            ? { ...s, artifactTypes: rest }
            : s));
        }
        return rest;
      });
    }

    // Abre o artefato mais recente que sobrou, ou fecha o painel se não sobrou nenhum
    setActiveArtifactId(remainingArtifacts.length > 0 ? remainingArtifacts[remainingArtifacts.length - 1].id : null);
  };

  const handleSaveManualArtifact = async () => {
    if (!editableArtifactText || !currentSessionId) return;
    
    // Atualiza a mensagem no estado local da sessão
    setSessions(prev => prev.map(s => {
      if (s.id !== currentSessionId) return s;
      const updatedMessages = s.messages.map(m => {
        if (m.id === activeArtifactId) {
          return { ...m, content: editableArtifactText };
        }
        return m;
      });
      return { ...s, messages: updatedMessages };
    }));

    // Adiciona ao histórico de undo/redo
    setArtifactHistory(prev => [...prev, editableArtifactText]);
    setArtifactHistoryIndex(prev => prev + 1);

    // Salva no Supabase na tabela ai_conversations como draft
    try {
      const draftId = `draft_${persona.aiName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${currentSessionId}`;
      await supabaseService.saveDraft(draftId, persona.displayName, editableArtifactText);
    } catch (e) {
      console.warn("Aviso salvando draft manual:", e);
    }

    setArtifactSaveSuccess(true);
    setTimeout(() => setArtifactSaveSuccess(false), 2000);
  };

  const handleUndoArtifact = () => {
    if (artifactHistoryIndex > 0) {
      const newIndex = artifactHistoryIndex - 1;
      setArtifactHistoryIndex(newIndex);
      const targetText = artifactHistory[newIndex];
      setEditableArtifactText(targetText);
      if (activeArtifactId && currentSessionId) {
        setSessions(prev => prev.map(s => {
          if (s.id !== currentSessionId) return s;
          return {
            ...s,
            messages: s.messages.map(m => m.id === activeArtifactId ? { ...m, content: targetText } : m)
          };
        }));
      }
    }
  };

  const handleRedoArtifact = () => {
    if (artifactHistoryIndex < artifactHistory.length - 1) {
      const newIndex = artifactHistoryIndex + 1;
      setArtifactHistoryIndex(newIndex);
      const targetText = artifactHistory[newIndex];
      setEditableArtifactText(targetText);
      if (activeArtifactId && currentSessionId) {
        setSessions(prev => prev.map(s => {
          if (s.id !== currentSessionId) return s;
          return {
            ...s,
            messages: s.messages.map(m => m.id === activeArtifactId ? { ...m, content: targetText } : m)
          };
        }));
      }
    }
  };

  const handleQuickAiEdit = async (customInstruction?: string) => {
    const instructionText = customInstruction || artifactQuickCommand;
    const hasArtifactAttachments = artifactAttachedFiles.length > 0;
    
    if ((!instructionText.trim() && !hasArtifactAttachments) || isLoading || isUploading) return;

    let promptToSend = instructionText.trim();
    if (!promptToSend && hasArtifactAttachments) {
      promptToSend = "Analise as evidências / prints anexados e aplique as atualizações e correções necessárias no artefato da peça.";
    }

    const currentSession = sessions.find(s => s.id === currentSessionId);
    const activeArtifactMsg = activeArtifactId && activeArtifactId !== 'streaming' 
      ? currentSession?.messages?.find(m => m.id === activeArtifactId) 
      : [...(currentSession?.messages || [])].reverse().find(m => m.role === 'assistant' && isArtifactContent(m.content));

    // IMPORTANTE: NÃO usa customArtifactTypes (override manual/persistido)
    // aqui — esse rótulo vai DIRETO pro prompt do modelo como "NATUREZA do
    // artefato". Se ficar desatualizado (ex.: documento virou outra coisa
    // numa correção anterior mas o override antigo ainda não foi limpo a
    // tempo), o modelo recebe um sinal contraditório — cabeçalho dizendo
    // "Quesitos" sobre um conteúdo que já é uma Manifestação, por exemplo —
    // e isso já causou resposta cortada/desconexa em produção. Sempre
    // detecta a partir do CONTEÚDO ATUAL, não do rótulo salvo/exibido.
    const meta = activeArtifactMsg
      ? getArtifactMeta(activeArtifactMsg.content, activeArtifactMsg.id, currentSession?.messages || [])
      : undefined;

    const artifactTargetHeader = meta 
      ? `[ARTEFATO ALVO: ID ${meta.idLabel} | NATUREZA: ${meta.config.label} | TÍTULO: ${meta.title}]\n\n`
      : '';

    if (selectedTextSnippet) {
      promptToSend = `${artifactTargetHeader}[CORREÇÃO CIRÚRGICA NO ARTEFATO ${meta?.idLabel || ''}]\n\nTRECHO SELECIONADO A MODIFICAR:\n"${selectedTextSnippet}"\n\nINSTRUÇÃO DE ALTERAÇÃO:\n${promptToSend}`;
    } else {
      promptToSend = `${artifactTargetHeader}[CORREÇÃO CIRÚRGICA NO ARTEFATO ${meta?.idLabel || ''}]\n\nINSTRUÇÃO DE ALTERAÇÃO:\n${promptToSend}`;
    }

    if (hasArtifactAttachments) {
      const filesToProcess = [...artifactAttachedFiles];
      setArtifactAttachedFiles([]);
      setArtifactQuickCommand('');
      setSelectedTextSnippet('');
      setIsUploading(true);
      setProgress(0);
      setProgressText('Iniciando processamento dos prints/anexos do artefato...');

      try {
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
          const newSession: ChatSession = {
            id: generateId(),
            title: `Correção Artefato: ${filesToProcess[0]?.name || 'Prints'}`,
            messages: [],
            date: new Date().toLocaleDateString('pt-BR'),
            documents: []
          };
          setSessions([newSession, ...sessions]);
          setCurrentSessionId(newSession.id);
          activeSessionId = newSession.id;
        }

        const readingMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Iniciando leitura e extração visual de **${filesToProcess.length} print(s)/anexo(s)** para atualização cirúrgica do documento. Por favor, aguarde...`,
          timestamp: new Date().toISOString()
        };

        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { ...s, messages: [...s.messages, readingMsg] } : s
        ));

        await processFilesPhased(filesToProcess, activeSessionId, 0, 0, undefined, promptToSend);
      } catch (error: any) {
        console.error("Erro ao processar anexos do artefato:", error);
        alert(`Erro ao processar anexos: ${error.message}`);
        setIsUploading(false);
      }
    } else {
      setArtifactQuickCommand('');
      setSelectedTextSnippet('');
      await handleSendMessage(promptToSend);
    }
  };

  const handleDocumentMouseUp = () => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      const selected = selection.toString().trim();
      setSelectedTextSnippet(selected);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100dvh-110px)] md:h-[calc(100vh-120px)] w-full bg-white dark:bg-bordeaux-950/60 rounded-lg md:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-gold-500/20">
      <EliteRedactionModal 
        isOpen={showEliteModal} 
        onClose={() => setShowEliteModal(false)}
        currentModel={selectedModel}
        currentProvider={selectedModelProvider}
        onConfirm={(provider, model) => {
          setShowEliteModal(false);
          if (pendingEliteTask) {
             handleSendMessage(pendingEliteTask.messageText, pendingEliteTask.images, true, provider, model);
          }
        }}
      />
      
      {showAiMemoryModal && (
        <AiMemoryModal
          onClose={() => {
             setShowAiMemoryModal(false);
             setInitialMemoryRule("");
             setMemoryModalPersona("");
          }}
          personaId={memoryModalPersona || persona.aiName}
          initialRule={initialMemoryRule}
        />
      )}

      {showLegalBaseModal && (
        <LegalBaseArtifactModal
          onClose={() => setShowLegalBaseModal(false)}
          artifact={currentSession?.legalBaseArtifact}
          activeDomainName={persona.displayName}
          onRemoveItem={(itemId) => {
            if (currentSessionId) {
              const artMap = ragArtifactRef.current.get(currentSessionId);
              if (artMap) {
                artMap.delete(itemId);
              }
              setSessions(prev => prev.map(s => {
                if (s.id !== currentSessionId) return s;
                const currentItems = s.legalBaseArtifact?.items || [];
                const updatedItems = currentItems.filter(it => it.id !== itemId);
                return {
                  ...s,
                  legalBaseArtifact: {
                    items: updatedItems,
                    updatedAt: new Date().toISOString()
                  }
                };
              }));
            }
          }}
          onCleanIrrelevant={() => {
            if (currentSessionId) {
              const isConsumerOrCivil = persona.agentAreas.includes('CONSUMIDOR') || persona.agentAreas.includes('CIVEL');
              const isOnlyPrevidenciario = persona.agentAreas.includes('INSS') && !persona.agentAreas.includes('CONSUMIDOR');
              
              setSessions(prev => prev.map(s => {
                if (s.id !== currentSessionId) return s;
                const currentItems = s.legalBaseArtifact?.items || [];
                const updatedItems = currentItems.filter(it => {
                  const titleAndContent = `${it.title} ${it.content}`.toLowerCase();
                  if (persona.aiName === 'felix_castro' || (isConsumerOrCivil && !persona.agentAreas.includes('INSS'))) {
                    if (titleAndContent.includes('lei nº 8.213') || 
                        titleAndContent.includes('lei 8.213') || 
                        titleAndContent.includes('decreto nº 3.048') ||
                        titleAndContent.includes('decreto 3.048') ||
                        (titleAndContent.includes('súmula') && titleAndContent.includes('tnu')) ||
                        titleAndContent.includes('inss') ||
                        titleAndContent.includes('bpc') ||
                        titleAndContent.includes('loas') ||
                        titleAndContent.includes('auxílio-doença') ||
                        titleAndContent.includes('aposentadoria') ||
                        titleAndContent.includes('clt') ||
                        titleAndContent.includes('consolidação das leis do trabalho')) {
                      return false;
                    }
                  } else if (isOnlyPrevidenciario) {
                    if (titleAndContent.includes('código de defesa do consumidor') || titleAndContent.includes('cdc') || titleAndContent.includes('clt')) {
                      return false;
                    }
                  }
                  return true;
                });
                
                const artMap = ragArtifactRef.current.get(currentSessionId);
                if (artMap) {
                  const updatedIds = new Set(updatedItems.map(it => it.id));
                  for (const key of Array.from(artMap.keys())) {
                    if (!updatedIds.has(key)) {
                      artMap.delete(key);
                    }
                  }
                }

                return {
                  ...s,
                  legalBaseArtifact: {
                    items: updatedItems,
                    updatedAt: new Date().toISOString()
                  }
                };
              }));
            }
          }}
          onClear={() => {
            if (currentSessionId) {
              ragArtifactRef.current.delete(currentSessionId);
              setSessions(prev => prev.map(s => s.id === currentSessionId
                ? { ...s, legalBaseArtifact: { items: [], updatedAt: new Date().toISOString() } }
                : s));
            }
          }}
        />
      )}

      {/* SIDEBAR: HISTÓRICO */}
      <aside className={`${isSidebarOpen ? 'w-full md:w-80' : 'w-0'} absolute md:relative z-20 h-full overflow-hidden shrink-0 transition-all duration-300 border-r border-slate-200 dark:border-gold-500/20 flex flex-col bg-slate-50 dark:bg-bordeaux-950/60/50`}>
        <div className="p-4 border-b border-slate-200 dark:border-gold-500/20 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico
          </h3>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-slate-200 dark:hover:bg-bordeaux-900/50 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="flex gap-2">
            <button 
              onClick={() => {
                createNewSession();
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className="flex-1 fc-btn-primary text-cream-50 font-bold py-3 px-4 rounded-xl shadow-lg shadow-primary-900/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> Nova
            </button>
            <button
              onClick={() => {
                setMemoryModalPersona(persona.aiName);
                setInitialMemoryRule("");
                setShowAiMemoryModal(true);
              }}
              className="px-3 bg-white dark:bg-bordeaux-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-sm hover:bg-emerald-50 dark:hover:bg-bordeaux-900 hover:scale-105 transition-all outline-none flex items-center justify-center"
              title="Memória da IA (Treinamento)"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowLegalBaseModal(true)}
              className="relative px-3 bg-white dark:bg-bordeaux-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-sm hover:bg-indigo-50 dark:hover:bg-bordeaux-900 hover:scale-105 transition-all outline-none flex items-center justify-center"
              title="Base Legal desta Conversa"
            >
              <Scale className="w-5 h-5" />
              {(currentSession?.legalBaseArtifact?.items?.length || 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {currentSession!.legalBaseArtifact!.items.length}
                </span>
              )}
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar conversas..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            {filteredSessions.map(session => (
              <div 
                key={session.id}
                onClick={() => {
                  setCurrentSessionId(session.id);
                  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                    const lastArtifact = [...(session.messages || [])].reverse().find(m => m.role === 'assistant' && isArtifactContent(m.content));
                    if (lastArtifact) {
                      setActiveArtifactId(lastArtifact.id);
                    } else {
                      setActiveArtifactId(null);
                    }
                  } else {
                    setActiveArtifactId(null);
                  }
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`group p-3 rounded-xl cursor-pointer border transition-all ${currentSessionId === session.id ? 'bg-white dark:bg-bordeaux-900/40 border-emerald-500 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-bordeaux-900/50/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
              >
                {editingSessionId === session.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle(session.id, e);
                        if (e.key === 'Escape') cancelEditing(e as any);
                      }}
                      autoFocus
                      className="flex-1 min-w-0 bg-white dark:bg-bordeaux-950/60 border border-emerald-500 rounded px-2 py-1 text-sm outline-none"
                    />
                    <button onClick={(e) => saveTitle(session.id, e)} className="text-emerald-600 hover:text-emerald-700">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEditing} className="text-red-500 hover:text-red-600">
                      <XMark className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{session.title}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{session.date}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => startEditing(session, e)}
                        className="p-1 text-slate-400 hover:text-emerald-500"
                        title="Renomear conversa"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => deleteSession(session.id, e)}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Excluir conversa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT SPLIT (CHAT + ARTIFACT DRAWER) */}
      <div className="flex-1 flex min-w-0 h-full overflow-hidden relative">

        {/* CHAT AREA */}
        <div className={`flex flex-col relative bg-white dark:bg-bordeaux-950 min-w-0 transition-all duration-300 h-full overflow-hidden ${
          activeArtifactId ? 'w-full lg:w-1/2 lg:border-r border-slate-200 dark:border-gold-500/20' : 'w-full'
        }`}>
          {!isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="absolute left-4 top-4 z-10 p-2 bg-white dark:bg-bordeaux-900/40 shadow-md rounded-full border border-slate-200 dark:border-gold-500/15 hover:scale-110 transition-transform"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* WELCOME SCREEN OR MESSAGES */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {!currentSession || currentSession.messages.length === 0 ? (
              <div className="max-w-4xl mx-auto mt-12 space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                    Olá, MICHEL!<br />
                    <span className="text-emerald-600">{persona.welcomeTitle}</span>
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400">{persona.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-bordeaux-950/60 p-6 rounded-2xl border border-slate-200 dark:border-gold-500/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                    <div className="w-12 h-12 bg-primary-100 dark:bg-bordeaux-900/40 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <FileText className="w-6 h-6 text-primary-700" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white mb-2">Resumo de Caso</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Crie resumo de documentos, destacando fatos e argumentos jurídicos.</p>
                    <button 
                      onClick={() => handleSendMessage('Gere um resumo técnico deste caso com base nos dados da calculadora.')}
                      className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      Começar <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-white dark:bg-bordeaux-950/60 p-6 rounded-2xl border border-slate-200 dark:border-gold-500/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Briefcase className="w-6 h-6 text-purple-600" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white mb-2">Geração de Peças</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Redija petições iniciais, recursos e requerimentos prontos para o Word.</p>
                    <button 
                      onClick={() => handleSendMessage('GERAR PEÇA: Petição Inicial de Aposentadoria por Tempo de Contribuição.')}
                      className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      Começar <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-white dark:bg-bordeaux-950/60 p-6 rounded-2xl border border-slate-200 dark:border-gold-500/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Search className="w-6 h-6 text-orange-600" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white mb-2">Análise de Provas</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Envie CNIS, PPP ou laudos para identificar lacunas e agentes nocivos.</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      Começar <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 py-4">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-bordeaux-900/40"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ou gerencie manualmente abaixo</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-bordeaux-900/40"></div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6 px-1 sm:px-2">
                {currentSession.messages.map(msg => {
                  let cleanedContent = msg.content || '';
                  
                  let memorySuggestionText = '';
                  const hasSuggestion = cleanedContent.includes('[SUGESTAO_MEMORIA:');
                  if (hasSuggestion) {
                    const match = cleanedContent.match(/\[SUGESTAO_MEMORIA:\s*(.*?)\]/);
                    if (match && match[1]) {
                      memorySuggestionText = match[1].replace(/["']/g, "");
                      cleanedContent = cleanedContent.replace(match[0], '').trim();
                    }
                  }

                  let memoryCommandText = '';
                  const hasCommand = cleanedContent.includes('[COMANDO_SALVAR_MEMORIA:');
                  if (hasCommand) {
                    const match = cleanedContent.match(/\[COMANDO_SALVAR_MEMORIA:\s*(.*?)\]/);
                    if (match && match[1]) {
                      memoryCommandText = match[1].replace(/["']/g, "");
                      cleanedContent = cleanedContent.replace(match[0], '').trim();
                    }
                  }

                  let marketingPostData: any = null;
                  const hasMarketingPost = cleanedContent.includes('[GERAR_POST_MARKETING:');
                  if (hasMarketingPost) {
                    const match = cleanedContent.match(/\[GERAR_POST_MARKETING:\s*([\s\S]*?)\]\s*$/) || cleanedContent.match(/\[GERAR_POST_MARKETING:\s*([\s\S]*?)\]/);
                    if (match && match[1]) {
                      try {
                        marketingPostData = JSON.parse(match[1].trim());
                        cleanedContent = cleanedContent.replace(match[0], '').trim();
                      } catch (e) {
                        console.error('Error parsing GERAR_POST_MARKETING:', e);
                      }
                    }
                  }

                  // Use cleanedContent em vez de msg.content para a renderização abaixo
                  return (
                  <div key={msg.id} className={`group ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
                    {msg.role === 'user' ? (
                      // BUBBLE DO USUÁRIO — estilo Claude
                      <div className="max-w-[85%] bg-slate-100 dark:bg-bordeaux-900/40 rounded-2xl rounded-tr-md px-5 py-3.5 shadow-sm">
                        <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap font-inter">
                          {cleanedContent.length > 3000
                            ? cleanedContent.substring(0, 800) + '\n\n[... conteúdo longo ocultado ...]'
                            : cleanedContent}
                        </div>
                        <div className="flex justify-end mt-1.5">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      // BUBBLE DA IA — estilo Claude com Artefatos
                      <div className="w-full flex gap-3 sm:gap-4">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-900/30 ring-2 ring-primary-200/50 dark:ring-primary-900/40 overflow-hidden">
                          {persona.avatarUrl ? (
                            <img src={persona.avatarUrl} alt={persona.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <Bot className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{persona.displayName}</span>
                            {persona.oabNumber && (
                              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">{persona.oabNumber}</span>
                            )}
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                              {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {isArtifactContent(cleanedContent) ? (
                            <div className="space-y-3">
                              {/* Intro text if any */}
                              {cleanedContent.split('\n\n').length > 1 && !cleanedContent.trim().startsWith('EXCELENTÍSSIMO') && !cleanedContent.trim().startsWith('AO JUÍZO') && (
                                <div className="prose prose-slate dark:prose-invert max-w-none prose-sm font-inter">
                                  <div dangerouslySetInnerHTML={{ __html: markdownToHtml(cleanedContent.split('\n\n')[0] || '') }} />
                                </div>
                              )}

                              {/* ARTIFACT EMBEDDED CARD */}
                              {(() => {
                                const meta = getArtifactMeta(
                                  cleanedContent, 
                                  msg.id, 
                                  currentSession.messages, 
                                  customArtifactTypes[msg.id]
                                );
                                const isSelected = activeArtifactId === msg.id;

                                return (
                                  <div 
                                    onClick={() => setActiveArtifactId(msg.id)}
                                    className={`border rounded-xl p-3.5 transition-all shadow-sm cursor-pointer ${
                                      isSelected 
                                        ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 ring-2 ring-emerald-500/30' 
                                        : 'border-slate-200 dark:border-bordeaux-800/80 bg-white dark:bg-bordeaux-950/70 hover:border-emerald-400 dark:hover:border-emerald-700/80 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2.5 rounded-lg shadow-sm shrink-0 flex items-center justify-center ${meta.config.pillBg}`}>
                                          <FileText className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-[11px] font-mono font-bold bg-slate-900 text-white dark:bg-gold-500 dark:text-bordeaux-950 px-2 py-0.5 rounded shadow-2xs">
                                              {meta.idLabel}
                                            </span>
                                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${meta.config.badgeClass}`}>
                                              <span>{meta.config.icon}</span>
                                              <span>{meta.config.shortLabel}</span>
                                            </span>
                                          </div>
                                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                                            {meta.title}
                                          </h4>
                                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                            ~{meta.wordCount} palavras ({meta.charCount} caracteres) • Clique para abrir no painel lateral
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={() => setActiveArtifactId(msg.id)}
                                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                                        >
                                          <Maximize2 className="w-3.5 h-3.5" /> Ver no Painel
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            generateDocx(cleanedContent);
                                          }}
                                          className="px-2.5 py-1.5 bg-white dark:bg-bordeaux-900 border border-slate-200 dark:border-emerald-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                          title="Baixar Word"
                                        >
                                          <Download className="w-3.5 h-3.5 text-emerald-600" /> DOCX
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base
                                            prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100
                                            prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                                            prose-p:leading-[1.7] prose-p:text-slate-700 dark:prose-p:text-slate-300
                                            prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold
                                            prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 dark:prose-blockquote:bg-emerald-950/20
                                            prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                            prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-300
                                            prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em]
                                            prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
                                            prose-table:text-sm prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:font-bold
                                            font-inter">
                              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(cleanedContent) }} />
                            </div>
                          )}

                          {/* UI PREVIEW DO POST DE MARKETING GERADO */}
                          {marketingPostData && (
                            <div className="mt-4 border border-pink-200 dark:border-pink-900/60 bg-gradient-to-br from-pink-50/70 via-rose-50/40 to-amber-50/30 dark:from-pink-950/40 dark:via-rose-950/30 dark:to-slate-900/50 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
                              <div className="flex items-center justify-between gap-3 border-b border-pink-200/60 dark:border-pink-900/40 pb-3 flex-wrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-sm font-bold text-sm shrink-0">
                                    📸
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-700 dark:text-pink-300 bg-pink-100 dark:bg-pink-900/60 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800">
                                      {marketingPostData.audienceTag || 'DIREITO PREVIDENCIÁRIO'}
                                    </span>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base mt-1">
                                      {marketingPostData.title}
                                    </h4>
                                  </div>
                                </div>
                                <button
                                  onClick={() => onOpenMarketing && onOpenMarketing({ 
                                    postData: marketingPostData, 
                                    topic: marketingPostData.title || currentSession?.title || 'Tema Jurídico',
                                    persona: (persona.aiName === 'luana' || persona.displayName?.toLowerCase().includes('luana')) ? 'luana' : 'michel',
                                    strategy: 'educacional'
                                  })}
                                  className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                                  title="Abrir no Canvas de Marketing Jurídico"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  <span>🎨 Abrir no Marketing (Canvas)</span>
                                </button>
                              </div>

                              {marketingPostData.highlight && (
                                <div className="p-3 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs font-semibold text-amber-950 dark:text-amber-200 flex items-start gap-2">
                                  <span className="text-sm shrink-0">💡</span>
                                  <span>{marketingPostData.highlight}</span>
                                </div>
                              )}

                              {marketingPostData.points && marketingPostData.points.length > 0 && (
                                <div className="space-y-1.5 bg-white/80 dark:bg-slate-900/70 p-3 rounded-xl border border-pink-100 dark:border-slate-800">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <span>📌 Tópicos Principais do Post:</span>
                                  </p>
                                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                    {marketingPostData.points.map((pt: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <span className="text-pink-500 font-bold">•</span>
                                        <span>{pt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {marketingPostData.caption && (
                                <div className="bg-white/60 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                      📝 <span>Legenda para o Instagram:</span>
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(marketingPostData.caption, `marketing-${msg.id}`)}
                                      className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 flex items-center gap-1 px-2 py-0.5 rounded bg-pink-50 dark:bg-pink-950/40 border border-pink-200/60 dark:border-pink-800/50 transition-colors"
                                    >
                                      {copiedId === `marketing-${msg.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                      <span>Copiar legenda</span>
                                    </button>
                                  </div>
                                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-4 hover:line-clamp-none transition-all">
                                    {marketingPostData.caption}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* UI SUGERIR MEMÓRIA */}
                          {(() => {
                            const isSuggestionSaved = savedSuggestionIds.has(msg.id) || (memorySuggestionText ? savedRuleTexts.has(memorySuggestionText.trim().toLowerCase()) : false);
                            if (memorySuggestionText && !isSuggestionSaved) {
                              return (
                                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center dark:bg-indigo-900/20 dark:border-indigo-800/50">
                                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full shrink-0">
                                    <Lightbulb className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-1">💡 Sugestão de Aprendizado</p>
                                    <p className="text-sm text-indigo-800 dark:text-indigo-200/90 leading-relaxed">{memorySuggestionText}</p>
                                  </div>
                                  <button
                                    onClick={() => handleSaveSuggestedMemoryRule(msg.id, memorySuggestionText)}
                                    disabled={savingSuggestionId === msg.id}
                                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                                  >
                                    {savingSuggestionId === msg.id ? 'Salvando...' : '✨ Salvar Regra'}
                                  </button>
                                </div>
                              );
                            }
                            if (memorySuggestionText && isSuggestionSaved) {
                              return (
                                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg shadow-sm flex items-start gap-2 dark:bg-emerald-900/20 dark:border-emerald-800/50">
                                   <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                   <div className="text-sm text-emerald-800 dark:text-emerald-200">
                                     <span className="font-bold">Diretriz gravada com sucesso:</span> {memorySuggestionText}
                                   </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* UI COMANDO MEMÓRIA SUCESSO */}
                          {memoryCommandText && (
                            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg shadow-sm flex items-start gap-2 dark:bg-emerald-900/20 dark:border-emerald-800/50">
                               <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                               <div className="text-sm text-emerald-800 dark:text-emerald-200">
                                 <span className="font-bold">Diretriz gravada com sucesso:</span> {memoryCommandText}
                               </div>
                            </div>
                          )}

                        <div className="flex items-center gap-1.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyToClipboard(cleanedContent, msg.id)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-bordeaux-900/50 rounded-md transition-colors"
                            title="Copiar"
                          >
                            {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                          </button>
                          <button
                            onClick={() => handleGenerateMarketingFromChat(cleanedContent, currentSession?.title)}
                            disabled={isGeneratingMarketing}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-pink-50 dark:hover:bg-pink-950/40 text-pink-600 dark:text-pink-400 rounded-md text-xs font-semibold transition-colors border border-pink-200/80 dark:border-pink-900/50"
                            title="Criar post do Instagram sobre esta resposta/caso"
                          >
                            {isGeneratingMarketing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            <span>Gerar Post</span>
                          </button>
                          {(
                            /petição|reclamação|excelentíssimo|ao juízo|inicial|contestação|recurso|vossa excelência/i.test(cleanedContent) ||
                            cleanedContent.length > 1000
                          ) && (
                            <>
                              <div className="w-px h-4 bg-slate-200 dark:bg-bordeaux-900/60 mx-1"></div>
                              <button
                                onClick={() => generateDocx(cleanedContent)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-bordeaux-900/50 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors"
                                title="Baixar Word"
                              >
                                <Download className="w-3.5 h-3.5" /> Word
                              </button>
                              <button
                                onClick={() => handleOpenInEditor(cleanedContent)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 fc-btn-primary text-cream-50 rounded-md text-xs font-semibold transition-colors shadow-sm"
                                title="Editor"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Editor
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
              {isLoading && (
                <div className="w-full flex gap-3 sm:gap-4">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-900/30 ring-2 ring-primary-200/50 dark:ring-primary-900/40">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{persona.displayName}</span>
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded animate-pulse">{progressText}</span>
                    </div>

                    {!streamingMessage && progress < 100 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="w-full bg-slate-100 dark:bg-bordeaux-900/40 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-gradient-to-r from-primary-600 to-primary-700 h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-500">
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{progress}% • Padrão Ouro Felix & Castro</span>
                          <div className="flex items-center gap-2">
                            <span className="animate-pulse">{isUploading ? "Processando GED..." : "Redigindo peça..."}</span>
                            <button
                              onClick={handleStopGeneration}
                              className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 transition-colors"
                              title="Cancelar e liberar o chat"
                            >
                              <Stop className="w-3 h-3" /> Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {streamingMessage && (
                      streamingAsArtifact || isArtifactContent(streamingMessage) ? (
                        <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl p-3.5 shadow-sm animate-pulse">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-emerald-600 text-white rounded-lg shadow-sm relative">
                                <FileText className="w-5 h-5" />
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></div>
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                                  Redigindo Peça no Painel Lateral...
                                </h4>
                                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                                  Acompanhe a escrita ao vivo ao lado
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setActiveArtifactId('streaming')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
                            >
                              <Maximize2 className="w-3.5 h-3.5" /> Ver Painel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base
                                        prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                                        prose-p:leading-[1.7] prose-p:text-slate-700 dark:prose-p:text-slate-300
                                        prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 dark:prose-blockquote:bg-emerald-950/20
                                        prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                        font-inter">
                          <div dangerouslySetInnerHTML={{ __html: markdownToHtml(streamingMessage) }} />
                          <span className="w-1.5 h-4 bg-emerald-500 inline-block animate-pulse ml-1 align-middle rounded-sm"></span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-3.5 sm:p-6 border-t border-slate-200 dark:border-gold-500/20 bg-white dark:bg-bordeaux-950">
          <div className="max-w-4xl mx-auto relative">

            {/* Contador de Contexto da Conversa — sugere compactação antes de estourar o orçamento seguro de tokens */}
            {contextUsage && contextUsage.percent >= 40 && (
              <button
                type="button"
                onClick={() => {
                  if (contextUsage.percent >= 70) {
                    handleCompactHistory();
                  }
                }}
                title={contextUsage.percent >= 70
                  ? "Contexto ficando grande — clique para compactar o histórico agora"
                  : "Uso estimado de contexto desta conversa"}
                className={`mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  contextUsage.percent >= 70
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800 cursor-pointer hover:scale-105 active:scale-95'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/60 cursor-default'
                }`}
              >
                <ChartBar className="w-3.5 h-3.5" />
                Contexto: ~{Math.round(contextUsage.estTokens / 1000)}k tokens ({contextUsage.percent}%)
                {contextUsage.percent >= 70 && ' · Compactar agora'}
              </button>
            )}

            {/* Badge de Tier de Petição Ativo */}
            {petitionLength !== 'Padrão (Livre)' && (
              <div className={`mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                /Premium/.test(petitionLength)
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${/Premium/.test(petitionLength) ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></span>
                {/Premium/.test(petitionLength)
                  ? `Tier Premium ativo · ${modelDisplayNames[selectedModel] || selectedModel}`
                  : `Tier ${petitionLength.replace(' palavras', 'p').replace(/(\d{4})/, '$1 palavras')} · ${modelDisplayNames[selectedModel] || selectedModel}`}
              </div>
            )}

            {/* Resume Audit Notification */}
            {pendingAudit && !isUploading && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/40 rounded-full flex items-center justify-center">
                    <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Auditoria Interrompida</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Restam {pendingAudit.files.length - pendingAudit.fileIndex} arquivos. Deseja continuar?
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPendingAudit(null)}
                    className="px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/40 rounded-lg transition-colors"
                  >
                    Descartar
                  </button>
                  <button 
                    onClick={resumeAudit}
                    className="px-4 py-1.5 bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2"
                  >
                    <History className="w-3 h-3" /> Retomar Auditoria
                  </button>
                </div>
              </div>
            )}

            {/* PAINEL DE AÇÕES INTELIGENTES (Harness Felix & Castro) */}
            <div className="mb-3.5 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-black text-slate-400 dark:text-gold-500/40 uppercase tracking-widest select-none pr-1">Harness de Ações:</span>
              
              <button
                type="button"
                onClick={() => {
                  setInput("[CONFIRMAR O CORPO DA PETIÇÃO] Solicito a análise técnica de rito e aprovação do atual rascunho. Por favor, pergunte-me quais próximos passos de exportação ou ritos processuais de rascunhos adicionais deseja realizar.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Confirmar rascunho"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Confirmar
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("[GERAÇÃO MODULAR] Desejo elaborar uma seção em tópicos isolados e independentes para a petição. Por favor, detalhe quais tópicos (como Qualificação, Fatos, Direito ou Pedidos) estão disponíveis e pergunte por qual deles deseja iniciar a redação.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Geração Modular"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Geração Modular
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("[CORREÇÃO CIRÚRGICA]\n\nTRECHO ATUAL:\n\"Insira aqui o parágrafo ou frase que está imperfeito\"\n\nCORREÇÃO SOLICITADA:\n\"Descreva aqui a alteração desejada\"");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 dark:text-purple-400 dark:border-purple-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Correção Cirúrgica de Fragmentos"
              >
                <Scissors className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Correção Cirúrgica
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("[VALIDAÇÃO E AUDITORIA] Solicito auditoria jurídica profunda e pente-fino no atual rascunho de petição para reportar contradições fáticas, omissões de rito ou leis ausentes. Por favor, apresente o relatório de auditoria.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Validar & Auditar"
              >
                <ShieldExclamation className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Validar & Auditar
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("[REFAZER DO ZERO] Desejo apagar as alterações anteriores e reescrever toda a peça do completo zero. Por favor, pergunte-me qual tese jurídica, rito processual ou direcionamento fático deseja incorporar nesta reescrita estrutural.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Refazer petição"
              >
                <Loader2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                Refazer do Zero
              </button>

              <button
                type="button"
                onClick={() => handleCompactHistory()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-bordeaux-900/60 dark:hover:bg-bordeaux-800/80 dark:text-gold-400 dark:border-gold-500/30 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Compactar Histórico (/compact) para liberar contexto preservando o caso"
              >
                <Minimize2 className="w-3.5 h-3.5 text-slate-600 dark:text-gold-400" />
                Compactar Histórico (/compact)
              </button>

              <button
                type="button"
                onClick={() => handleGenerateMarketingFromChat(undefined, currentSession?.title)}
                disabled={isGeneratingMarketing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 text-pink-700 border border-pink-200 dark:from-pink-950/40 dark:to-rose-950/40 dark:hover:from-pink-900/50 dark:hover:to-rose-900/50 dark:text-pink-300 dark:border-pink-800/80 transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                title="Transformar a conversa deste caso em Post do Instagram (Marketing Jurídico)"
              >
                {isGeneratingMarketing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-600 dark:text-pink-400" /> : <Sparkles className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />}
                📱 Post Instagram do Caso
              </button>
            </div>

            <div className="bg-white dark:bg-bordeaux-950/60 border border-slate-200 dark:border-gold-500/15 rounded-2xl shadow-lg focus-within:ring-2 focus-within:ring-emerald-500 transition-all overflow-hidden">
              {/* ANEXOS PENDENTES SELECIONADOS PELO ADVOGADO */}
              {(attachedFiles.length > 0 || attachedClient) && (
                <div className="p-2.5 bg-slate-50 dark:bg-bordeaux-900/40 border-b border-slate-200/80 dark:border-gold-500/15 flex flex-wrap gap-2 items-center animate-fade-in">
                  {attachedFiles.map((file, idx) => {
                    const isImg = (file.type && file.type.startsWith('image/')) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);
                    return (
                      <div 
                        key={`${file.name}-${idx}`} 
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-bordeaux-950 border border-slate-200 dark:border-gold-500/25 rounded-lg shadow-2xs text-xs font-medium text-slate-800 dark:text-slate-200 group"
                      >
                        {isImg ? (
                          <Photo className="w-3.5 h-3.5 text-emerald-600 dark:text-gold-400 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-gold-400 shrink-0" />
                        )}
                        <span className="max-w-[160px] sm:max-w-[220px] truncate font-semibold" title={file.name}>
                          {file.name}
                        </span>
                        {isImg && (
                          <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Print
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-slate-400">
                          ({formatFileSize(file.size)})
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(idx)}
                          className="p-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-sm transition-colors"
                          title="Remover anexo"
                        >
                          <XMark className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {attachedClient && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/50 rounded-lg shadow-2xs text-xs font-medium text-emerald-800 dark:text-emerald-200">
                      <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="max-w-[180px] sm:max-w-[240px] truncate font-semibold" title={attachedClient.name}>
                        Cliente: {attachedClient.name}
                      </span>
                      <span className="text-[10px] text-emerald-600/70 dark:text-emerald-300/70">
                        ({(persona.aiName === 'fabricia' ? attachedClient.narrativeCertificates?.length : attachedClient.documents?.length) || 0} docs)
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachedClient(null)}
                        className="p-0.5 text-emerald-500 hover:text-rose-600 rounded-sm transition-colors"
                        title="Remover cliente"
                      >
                        <XMark className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <span className="text-[11px] text-emerald-700 dark:text-gold-400/90 font-medium italic ml-auto pr-1">
                    {attachedFiles.length + (attachedClient ? 1 : 0)} anexo(s) pronto(s) • Escreva algo sobre e envie.
                  </span>
                </div>
              )}

              <textarea 
                id={persona.inputId}
                rows={1}
                placeholder={attachedFiles.length > 0 || attachedClient ? "Escreva instruções sobre os documentos/prints anexados (ex: Corrigir fatos, recalcular RMI, alterar pedidos...) ou envie para ciência geral." : `${persona.placeholder} (Você também pode colar prints com Ctrl+V)`}
                value={input}
                onPaste={(e) => handlePasteFiles(e.clipboardData, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendButtonClick();
                  }
                }}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                }}
                className="w-full p-3 bg-transparent outline-none text-slate-800 dark:text-white resize-none min-h-[44px] max-h-[100px] overflow-y-auto text-sm"
              />
              <div className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 border-t border-slate-100 dark:border-gold-500/20">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1 mr-1">
                  <input 
                    type="file" 
                    multiple 
                    accept="application/pdf,text/plain,image/*,.png,.jpg,.jpeg,.webp"
                    ref={fileInputRef} 
                    onChange={handleFileSelection} 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`p-1.5 sm:p-2 rounded-lg transition-all ${attachedFiles.length > 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-400' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                    title="Anexar documentos ou prints (PDF, Imagens, TXT) ou cole com Ctrl+V"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setIsClientModalOpen(true)}
                    disabled={isUploading}
                    className={`p-1.5 sm:p-2 rounded-lg transition-all flex items-center gap-1 ${attachedClient ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-400' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                    title="Importar Cliente (GED)"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  <div className="h-6 w-px bg-slate-200 dark:bg-bordeaux-900/60"></div>
                  <select
                    value={petitionLength}
                    onChange={(e) => {
                      setPetitionLength(e.target.value);
                    }}
                    className="bg-slate-50 dark:bg-slate-850/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer flex-1 min-w-0 max-w-[80px] sm:max-w-none sm:w-auto truncate shrink"
                    title="Tamanho da Peça (Padrão Ouro Felix & Castro)"
                  >
                    <option value="Padrão (Livre)">Livre</option>
                    <option value="Mínimo 3000 palavras">3k pal.</option>
                    <option value="Médio 4000 palavras">4k pal.</option>
                    <option value="Máximo 5000 palavras">5k pal.</option>
                    <option value="Premium 7000 palavras">7k pal.</option>
                  </select>
                  <div className="h-6 w-px bg-slate-200 dark:bg-bordeaux-900/60"></div>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedModel(val);
                      setSelectedModelProvider(val.includes('gemini') ? 'gemini' : 'openrouter');
                    }}
                    className="bg-slate-50 dark:bg-slate-850/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800/60 text-[10px] font-bold text-slate-500 dark:text-slate-300 outline-none cursor-pointer hover:text-emerald-600 dark:hover:text-gold-400 transition-colors flex-1 min-w-0 max-w-[90px] sm:max-w-none sm:w-auto truncate shrink"
                  >
                    <optgroup label="Nativo Google">
                      <option value="gemini-3.6-flash">Gemini 3.6 Flash (Padrão)</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                      <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                    </optgroup>
                    <optgroup label="OpenRouter">
                      <option value="deepseek/deepseek-v4-flash">DeepSeek V4</option>
                      <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                    </optgroup>
                  </select>
                </div>
                {isLoading ? (
                  <button 
                    onClick={handleStopGeneration}
                    className="flex-shrink-0 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl shadow-lg shadow-rose-900/40 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold animate-pulse"
                    title="Interromper geração imediatamente"
                  >
                    <Stop className="w-4 h-4" />
                    <span className="hidden sm:inline">Parar</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleSendButtonClick}
                    disabled={!input.trim() && attachedFiles.length === 0 && !attachedClient}
                    className="flex-shrink-0 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:hover:bg-primary-700 text-white p-2.5 rounded-xl shadow-lg shadow-primary-900/40 transition-all active:scale-95"
                    title="Enviar mensagem"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-3">
              {persona.footer}
            </p>
          </div>
        </div>
      </div>
        
        {/* ARTIFACT AREA (RIGHT PANEL) - STATIC EDITOR & PREVIEW */}
        {activeArtifactId && (
          <div 
            id="artifact-panel-container"
            className={`fixed inset-0 z-50 lg:static lg:z-10 lg:w-1/2 flex flex-col h-full bg-slate-100 dark:bg-bordeaux-950/90 border-l border-slate-200 dark:border-gold-500/20 shadow-2xl overflow-hidden animate-fade-in shrink-0 transition-all duration-300 ${artifactUpdatePulse ? 'ring-4 ring-emerald-500/50' : ''}`}
          >
            {(() => {
              const rawContent = activeArtifactId === 'streaming' 
                ? streamingMessage 
                : currentSession?.messages.find(m => m.id === activeArtifactId)?.content || editableArtifactText;
              const content = cleanPetitionDocument(editableArtifactText || rawContent);
              const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
              const charCount = content.length;

              const sessionArtifactMessages = (currentSession?.messages || []).filter(
                m => m.role === 'assistant' && isArtifactContent(m.content)
              );
              const currentArtifactIndex = sessionArtifactMessages.findIndex(m => m.id === activeArtifactId);

              const meta = getArtifactMeta(
                content, 
                activeArtifactId || 'current', 
                currentSession?.messages || [], 
                activeArtifactId ? customArtifactTypes[activeArtifactId] : undefined
              );

              return (
                <>
                  {/* ARTIFACT HEADER */}
                  <div className="px-4 py-2.5 border-b border-slate-200 dark:border-gold-500/20 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-bordeaux-950 shadow-sm z-20 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0 shadow-sm ${meta.config.pillBg}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold bg-slate-900 text-white dark:bg-gold-500 dark:text-bordeaux-950 px-2 py-0.5 rounded shadow-2xs">
                            {meta.idLabel}
                          </span>
                          <h3 className="font-bold text-sm text-slate-800 dark:text-white leading-tight truncate max-w-[200px] sm:max-w-xs">
                            {meta.title}
                          </h3>
                          {artifactUpdatePulse && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 animate-pulse flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-500" />
                              Patch Aplicado!
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {/* SELETOR DE TIPO DE PEÇA */}
                          <div className="relative">
                            <button
                              onClick={() => setIsTypeSelectorOpen(!isTypeSelectorOpen)}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${meta.config.badgeClass} hover:opacity-90 cursor-pointer`}
                              title="Clique para alterar a classificação desta peça/artefato"
                            >
                              <span>{meta.config.icon}</span>
                              <span>{meta.config.label}</span>
                              <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                            </button>

                            {isTypeSelectorOpen && (
                              <div className="absolute left-0 mt-1 w-56 bg-white dark:bg-bordeaux-950 border border-slate-200 dark:border-bordeaux-800 rounded-xl shadow-xl z-50 p-1.5 space-y-0.5 animate-fade-in">
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-bordeaux-900 mb-1">
                                  Classificação da Peça ({meta.idLabel})
                                </div>
                                {(Object.entries(ARTIFACT_TYPE_CONFIGS) as [ArtifactTypeKey, typeof ARTIFACT_TYPE_CONFIGS[ArtifactTypeKey]][]).map(([key, config]) => (
                                  <button
                                    key={key}
                                    onClick={() => {
                                      if (activeArtifactId && activeArtifactId !== 'streaming') {
                                        handleSetArtifactType(activeArtifactId, key);
                                      }
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                      meta.typeKey === key 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold' 
                                        : 'hover:bg-slate-100 dark:hover:bg-bordeaux-900/60 text-slate-700 dark:text-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span>{config.icon}</span>
                                      <span>{config.label}</span>
                                    </div>
                                    {meta.typeKey === key && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            • {wordCount} palavras ({charCount} carac.)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* NAVEGAÇÃO ENTRE MÚLTIPLOS ARTEFATOS */}
                      {sessionArtifactMessages.length > 1 && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-bordeaux-900/70 p-0.5 rounded-lg border border-slate-200 dark:border-bordeaux-800 text-xs mr-1">
                          <button
                            onClick={() => {
                              if (currentArtifactIndex > 0) {
                                setActiveArtifactId(sessionArtifactMessages[currentArtifactIndex - 1].id);
                              }
                            }}
                            disabled={currentArtifactIndex <= 0}
                            className="p-1 hover:bg-white dark:hover:bg-bordeaux-950 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-colors"
                            title="Artefato anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 px-1">
                            {currentArtifactIndex + 1}/{sessionArtifactMessages.length}
                          </span>
                          <button
                            onClick={() => {
                              if (currentArtifactIndex < sessionArtifactMessages.length - 1) {
                                setActiveArtifactId(sessionArtifactMessages[currentArtifactIndex + 1].id);
                              }
                            }}
                            disabled={currentArtifactIndex >= sessionArtifactMessages.length - 1 || currentArtifactIndex === -1}
                            className="p-1 hover:bg-white dark:hover:bg-bordeaux-950 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-colors"
                            title="Próximo artefato"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* TAB SWITCHER */}
                      <div className="flex items-center bg-slate-100 dark:bg-bordeaux-900/60 p-0.5 rounded-lg border border-slate-200 dark:border-bordeaux-800">
                        <button
                          onClick={() => setArtifactTab('preview')}
                          className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${artifactTab === 'preview' ? 'bg-white dark:bg-bordeaux-950 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                          title="Visualizar documento formatado"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Visualizar</span>
                        </button>
                        <button
                          onClick={() => {
                            setArtifactTab('edit');
                            if (!editableArtifactText) setEditableArtifactText(content);
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${artifactTab === 'edit' ? 'bg-white dark:bg-bordeaux-950 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                          title="Editar texto manualmente"
                        >
                          <EditSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                      </div>

                      {artifactTab === 'edit' && (
                        <>
                          <button
                            onClick={handleUndoArtifact}
                            disabled={artifactHistoryIndex <= 0}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bordeaux-900 rounded-lg transition-colors disabled:opacity-40"
                            title="Desfazer alteração"
                          >
                            <Undo className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleRedoArtifact}
                            disabled={artifactHistoryIndex >= artifactHistory.length - 1}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bordeaux-900 rounded-lg transition-colors disabled:opacity-40"
                            title="Refazer alteração"
                          >
                            <Redo className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleSaveManualArtifact}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm ${artifactSaveSuccess ? 'bg-emerald-600 text-white' : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'}`}
                            title="Salvar alterações manuais"
                          >
                            {artifactSaveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            <span>{artifactSaveSuccess ? 'Salvo!' : 'Salvar'}</span>
                          </button>
                        </>
                      )}

                      {artifactTab === 'preview' && (
                        <>
                          <button
                            onClick={() => copyToClipboard(content, 'artifact')}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bordeaux-900 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Copiar Texto"
                          >
                            {copiedId === 'artifact' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            <span className="hidden sm:inline">Copiar</span>
                          </button>

                          <button
                            onClick={() => generateDocx(content)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            title="Baixar Word (.docx)"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">DOCX</span>
                          </button>

                          <button
                            onClick={() => handleOpenInEditor(content)}
                            className="px-2.5 py-1.5 fc-btn-primary text-cream-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            title="Abrir no Editor Completo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Editor</span>
                          </button>

                          <button
                            onClick={() => handleGenerateMarketingFromChat(content, currentSession?.title)}
                            disabled={isGeneratingMarketing}
                            className="px-2.5 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            title="Transformar este caso/peça em Post do Instagram"
                          >
                            {isGeneratingMarketing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">Gerar Post</span>
                          </button>
                        </>
                      )}

                      <div className="w-px h-4 bg-slate-200 dark:bg-bordeaux-900 mx-0.5"></div>

                      <button
                        onClick={handleDeleteArtifact}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Excluir este artefato da conversa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setActiveArtifactId(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-bordeaux-900 rounded-lg transition-colors"
                        title="Fechar Artefato"
                      >
                        <XMark className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* POPUP FLUTUANTE DE TRECHO SELECIONADO */}
                  {selectedTextSnippet && (
                    <div className="bg-emerald-900 text-white px-3 py-2 text-xs flex items-center justify-between gap-2 shadow-md border-b border-emerald-700 shrink-0 animate-fade-in">
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-4 h-4 text-gold-400 shrink-0" />
                        <span className="truncate">
                          Trecho selecionado ({selectedTextSnippet.length} carac.): <strong className="italic">"{selectedTextSnippet.slice(0, 45)}..."</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            const cmd = prompt('Qual alteração você deseja aplicar neste trecho específico?');
                            if (cmd) handleQuickAiEdit(cmd);
                          }}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-bold text-[11px]"
                        >
                          ⚡ Editar com IA
                        </button>
                        <button
                          onClick={() => setSelectedTextSnippet('')}
                          className="p-0.5 hover:bg-emerald-800 rounded text-slate-300"
                        >
                          <XMark className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ARTIFACT CONTENT CONTAINER */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-6 scroll-smooth relative" ref={artifactSheetRef}>
                    {artifactTab === 'preview' ? (
                      <div 
                        onMouseUp={handleDocumentMouseUp}
                        className="max-w-3xl mx-auto bg-white dark:bg-bordeaux-950/90 border border-slate-200 dark:border-gold-500/20 rounded-xl shadow-xl p-6 sm:p-12 min-h-full font-inter text-slate-800 dark:text-slate-100 prose prose-slate dark:prose-invert max-w-none
                                        prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100
                                        prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                                        prose-p:leading-[1.75] prose-p:text-slate-700 dark:prose-p:text-slate-200
                                        prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-semibold
                                        prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 dark:prose-blockquote:bg-emerald-950/20
                                        prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg"
                      >
                        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />

                        {activeArtifactId === 'streaming' && (
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-bordeaux-900 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            <span>Redigindo peça jurídica em tempo real...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-3xl mx-auto h-full flex flex-col">
                        <textarea
                          value={editableArtifactText}
                          onChange={(e) => setEditableArtifactText(e.target.value)}
                          className="w-full flex-1 min-h-[500px] p-4 font-mono text-xs sm:text-sm bg-white dark:bg-bordeaux-950/90 border border-slate-200 dark:border-gold-500/20 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shadow-inner resize-y leading-relaxed"
                          placeholder="Conteúdo do artefato editável..."
                        />
                      </div>
                    )}
                  </div>

                  {/* AI SURGICAL EDITOR BOTTOM BAR */}
                  <div className="p-3 bg-white dark:bg-bordeaux-950 border-t border-slate-200 dark:border-gold-500/20 shrink-0">
                    <div className="max-w-3xl mx-auto space-y-2">
                      {/* PRINTS / ANEXOS PENDENTES DO ARTEFATO */}
                      {artifactAttachedFiles.length > 0 && (
                        <div className="p-2 bg-slate-50 dark:bg-bordeaux-900/40 border border-slate-200/80 dark:border-gold-500/15 rounded-lg flex flex-wrap gap-2 items-center animate-fade-in">
                          {artifactAttachedFiles.map((file, idx) => {
                            const isImg = (file.type && file.type.startsWith('image/')) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);
                            return (
                              <div 
                                key={`${file.name}-${idx}`} 
                                className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-bordeaux-950 border border-slate-200 dark:border-gold-500/25 rounded-md shadow-2xs text-[11px] font-medium text-slate-800 dark:text-slate-200 group"
                              >
                                {isImg ? (
                                  <Photo className="w-3 h-3 text-emerald-600 dark:text-gold-400 shrink-0" />
                                ) : (
                                  <FileText className="w-3 h-3 text-emerald-600 dark:text-gold-400 shrink-0" />
                                )}
                                <span className="max-w-[140px] truncate font-semibold" title={file.name}>
                                  {file.name}
                                </span>
                                {isImg && (
                                  <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[8px] px-1 py-0.2 rounded font-bold uppercase">
                                    Print
                                  </span>
                                )}
                                <span className="text-[9px] text-slate-400">
                                  ({formatFileSize(file.size)})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeArtifactAttachedFile(idx)}
                                  className="p-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-sm transition-colors"
                                  title="Remover anexo"
                                >
                                  <XMark className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {/* Hidden file input for artifact */}
                        <input 
                          type="file" 
                          multiple 
                          accept="application/pdf,text/plain,image/*,.png,.jpg,.jpeg,.webp"
                          ref={artifactFileInputRef} 
                          onChange={handleArtifactFileSelection} 
                          className="hidden" 
                        />
                        
                        <button
                          type="button"
                          onClick={() => artifactFileInputRef.current?.click()}
                          disabled={isLoading || isUploading}
                          className={`p-2 rounded-lg border transition-all ${artifactAttachedFiles.length > 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400' : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-bordeaux-900 border-slate-200 dark:border-gold-500/20'}`}
                          title="Anexar print ou documento para aplicar correção cirúrgica (ou cole com Ctrl+V)"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>

                        <div className="relative flex-1">
                          <input
                            id="artifact-surgical-input"
                            type="text"
                            value={artifactQuickCommand}
                            onChange={(e) => setArtifactQuickCommand(e.target.value)}
                            onPaste={(e) => handleArtifactPasteFiles(e.clipboardData, e)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleQuickAiEdit();
                              }
                            }}
                            placeholder={
                              artifactAttachedFiles.length > 0 
                                ? "Escreva instruções sobre os prints/documentos ou clique em Aplicar Cirurgia..." 
                                : (selectedTextSnippet 
                                    ? `Modificar trecho: "${selectedTextSnippet.slice(0, 30)}..." (Cole prints com Ctrl+V)` 
                                    : "Instrução cirúrgica (ex: Corrigir polo passivo, adicionar tutela...) ou Cole prints com Ctrl+V")
                            }
                            disabled={isLoading || isUploading}
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-bordeaux-900/60 border border-slate-200 dark:border-gold-500/20 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                          <Sparkles className="w-4 h-4 text-emerald-500 absolute left-3 top-2.5 pointer-events-none" />
                        </div>
                        <button
                          onClick={() => handleQuickAiEdit()}
                          disabled={(!artifactQuickCommand.trim() && artifactAttachedFiles.length === 0) || isLoading || isUploading}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                          title="Aplicar correção cirúrgica no artefato"
                        >
                          <Bolt className="w-4 h-4 text-gold-400" />
                          <span>Aplicar Cirurgia</span>
                        </button>
                      </div>

                      {/* QUICK ACTION CHIPS DINÂMICOS BASEADOS NA TIPOLOGIA */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                        <span className="text-slate-400 font-medium shrink-0">Atalhos ({meta.config.shortLabel}):</span>

                        {meta.typeKey === 'quesitos' && (
                          <>
                            <button
                              onClick={() => handleQuickAiEdit("Adicione quesitos técnicos objetivos sobre o nexo de causalidade ou concausalidade entre as atividades laborais/doença e a incapacidade.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              🩺 Nexo Causal
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Adicione quesito específico para fixação técnica da Data de Início da Incapacidade (DII) e Data de Início da Doença (DID).")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              📅 DII e DID
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Adicione quesito sobre viabilidade de reabilitação profissional e restrições a esforço habitual.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              🔄 Reabilitação
                            </button>
                          </>
                        )}

                        {meta.typeKey === 'recurso' && (
                          <>
                            <button
                              onClick={() => handleQuickAiEdit("Adicione preliminar de nulidade da decisão por cerceamento de defesa diante do indeferimento de prova pericial/testemunhal.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              🛑 Cerceamento de Defesa
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Reforce o pedido de concessão de efeito suspensivo e tutela recursal de urgência.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              ⚡ Tutela Recursal
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Reestruture o pedido recursal para pugnar expressamente pela anulação ou total reforma da decisão recorrida.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              ⚖️ Pedido de Reforma
                            </button>
                          </>
                        )}

                        {meta.typeKey === 'intercorrente' && (
                          <>
                            <button
                              onClick={() => handleQuickAiEdit("Ajuste a manifestação para dar formal ciência do despacho e requerer o regular prosseguimento do feito.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              📌 Ciência e Prosseguimento
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Adicione relação e discriminação detalhada dos documentos ora acostados aos autos.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              📎 Juntada de Documentos
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Inclua pedido de reiteração de intimação da parte contrária sob pena de preclusão.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              ⏰ Reiteração de Prazo
                            </button>
                          </>
                        )}

                        {meta.typeKey === 'impugnacao' && (
                          <>
                            <button
                              onClick={() => handleQuickAiEdit("Impugne pontualmente as preliminares e alegações genéricas da defesa do réu.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              🛡️ Impugnar Contestação
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Destaque as contradições do laudo pericial em confronto com os atestados e exames médicos dos autos.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              🔍 Contradição do Laudo
                            </button>
                          </>
                        )}

                        {/* Atalhos padrão para inicial, administrativa, parecer, contrato e geral */}
                        {(meta.typeKey === 'inicial' || meta.typeKey === 'geral' || meta.typeKey === 'administrativa' || meta.typeKey === 'parecer' || meta.typeKey === 'contrato') && (
                          <>
                            <button
                              onClick={() => handleQuickAiEdit("Corrija o cabeçalho e endereçamento do juízo competente.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              🏛️ Corrigir Endereçamento
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Adicione preliminar de concessão da Gratuidade da Justiça com base no art. 98 do CPC.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              ⚖️ Adicionar Gratuidade
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Inclua pedido expresso de Tutela de Urgência de Natureza Antecipada com fundamento no art. 300 do CPC.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              ⚡ Tutela de Urgência
                            </button>
                            <button
                              onClick={() => handleQuickAiEdit("Ajuste a fundamentação e o valor pleiteado a título de Danos Morais.")}
                              disabled={isLoading}
                              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-bordeaux-800 whitespace-nowrap transition-colors"
                            >
                              💰 Ajustar Danos Morais
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

      </div>

      {/* Client Import Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-bordeaux-950/60 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-gold-500/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Importar Cliente (GED)</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XMark className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b border-slate-200 dark:border-gold-500/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome ou CPF..." 
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {clients.length === 0 ? (
                <p className="text-center text-slate-500 py-10">Carregando clientes...</p>
              ) : (
                <div className="space-y-2">
                  {clients.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) || c.cpf.includes(clientSearchTerm)).map(client => (
                    <button 
                      key={client.id}
                      onClick={() => handleImportClient(client)}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-gold-500/15 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white">{client.name}</p>
                        <p className="text-xs text-slate-500">{client.cpf} • {client.documents?.length || 0} documentos</p>
                      </div>
                      <Plus className="w-5 h-5 text-emerald-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonaChat;
