// Configuração por persona de IA. Cada persona mantém sua individualidade
// (nome, endpoint, foco de base, namespace de histórico) — o componente
// PersonaChat consome esta config. Unifica o esqueleto sem fundir as personas.
export interface PersonaConfig {
  aiName: 'michel' | 'luana' | 'felix_castro' | 'fabricia'; // id no Supabase / ai_name
  auditKey: string;          // chave idb de auditoria pendente
  sessionsKey: string;       // chave localStorage de sessões
  inputId: string;           // id do textarea de input
  chatEndpoint: string;      // endpoint /chat específico da persona
  agentAreas: string[];      // ordem de áreas para o roteamento do RAG
  displayName: string;       // nome exibido
  welcomeTitle: string;      // título de boas-vindas
  subtitle: string;          // subtítulo descritivo
  placeholder: string;       // placeholder do input
  petitionTitlePrefix: string; // prefixo do título de petição gerada
  footer: string;            // aviso de rodapé
  sendMinWage: boolean;      // envia salário mínimo ao backend (relevante p/ valor da causa previdenciário/trabalhista)
}

export const MICHEL_PERSONA: PersonaConfig = {
  aiName: 'michel',
  auditKey: 'pending_audit_dr_michel',
  sessionsKey: 'dr_michel_sessions',
  inputId: 'chat-input-michel',
  chatEndpoint: '/api/dr-michel/chat',
  agentAreas: ['INSS', 'RPPS'],
  displayName: 'Dr. Michel Felix',
  welcomeTitle: 'Bem vindo ao Dr. Michel Felix IA',
  subtitle: 'Seu assistente jurídico de elite para Direito Previdenciário.',
  placeholder: 'Como posso te ajudar, Dr. Michel?',
  petitionTitlePrefix: 'Petição Dr. Michel',
  footer: 'Dr. Michel Felix IA pode cometer erros. Verifique informações importantes.',
  sendMinWage: true,
};

export const FELIX_CASTRO_PERSONA: PersonaConfig = {
  aiName: 'felix_castro',
  auditKey: 'pending_audit_dr_felix_castro',
  sessionsKey: 'dr_felix_castro_sessions',
  inputId: 'chat-input-felix-castro',
  chatEndpoint: '/api/dr-felix-castro/chat',
  agentAreas: ['CONSUMIDOR', 'CIVEL'],
  displayName: 'Dr. Felix e Castro',
  welcomeTitle: 'Bem vindo ao Dr. Felix e Castro IA',
  subtitle: 'Seu assistente jurídico de elite para Direito do Consumidor e Direito Civil.',
  placeholder: 'Como posso te ajudar, Dr. Felix e Castro?',
  petitionTitlePrefix: 'Petição Dr. Felix e Castro',
  footer: 'Dr. Felix e Castro IA pode cometer erros. Verifique informações importantes.',
  sendMinWage: false,
};

export const LUANA_PERSONA: PersonaConfig = {
  aiName: 'luana',
  auditKey: 'pending_audit_dra_luana',
  sessionsKey: 'dra_luana_sessions',
  inputId: 'chat-input-luana',
  chatEndpoint: '/api/dra-luana/chat',
  agentAreas: ['TRABALHISTA'],
  displayName: 'Dra. Luana Castro',
  welcomeTitle: 'Bem vinda ao Dra. Luana Castro IA',
  subtitle: 'Sua assistente de elite para Direito Previdenciário e Cálculos Sociais.',
  placeholder: 'Como posso te ajudar, Dra. Luana?',
  petitionTitlePrefix: 'Petição Dra. Luana',
  footer: 'Dra. Luana Castro IA pode cometer erros. Verifique informações importantes.',
  sendMinWage: true,
};

export const FABRICIA_PERSONA: PersonaConfig = {
  aiName: 'fabricia',
  auditKey: 'pending_audit_sec_fabricia',
  sessionsKey: 'sec_fabricia_sessions',
  inputId: 'chat-input-fabricia',
  chatEndpoint: '/api/sec-fabricia/chat',
  agentAreas: ['CONSUMIDOR', 'CIVEL', 'TRABALHISTA', 'INSS', 'RPPS'],
  displayName: 'Secretária Fabrícia Felix',
  welcomeTitle: 'Bem vinda ao Sec. Fabrícia Felix IA',
  subtitle: 'Sua secretária virtual para triagem extrema de contratos, prazos e faturamento.',
  placeholder: 'Como posso ajudar no controle da secretaria?',
  petitionTitlePrefix: 'Triagem Sec. Fabrícia',
  footer: 'Secretária Fabrícia Felix IA pode cometer erros. Verifique as datas importantes.',
  sendMinWage: false,
};
