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
}

export const MICHEL_PERSONA: PersonaConfig = {
  aiName: 'michel',
  auditKey: 'pending_audit_dr_michel',
  sessionsKey: 'dr_michel_sessions',
  inputId: 'chat-input-michel',
  chatEndpoint: '/api/dr-michel/chat',
  agentAreas: ['INSS', 'RPPS', 'CIVEL', 'TRABALHISTA', 'CONSUMIDOR'],
  displayName: 'Dr. Michel Felix',
  welcomeTitle: 'Bem vindo ao Dr. Michel Felix IA',
  subtitle: 'Seu assistente jurídico de elite para Direito Previdenciário.',
  placeholder: 'Como posso te ajudar, Dr. Michel?',
  petitionTitlePrefix: 'Petição Dr. Michel',
  footer: 'Dr. Michel Felix IA pode cometer erros. Verifique informações importantes.',
};

export const FELIX_CASTRO_PERSONA: PersonaConfig = {
  aiName: 'felix_castro',
  auditKey: 'pending_audit_dr_felix_castro',
  sessionsKey: 'dr_felix_castro_sessions',
  inputId: 'chat-input-felix-castro',
  chatEndpoint: '/api/dr-felix-castro/chat',
  agentAreas: ['CONSUMIDOR', 'CIVEL', 'TRABALHISTA', 'INSS', 'RPPS'],
  displayName: 'Dr. Felix e Castro',
  welcomeTitle: 'Bem vindo ao Dr. Felix e Castro IA',
  subtitle: 'Seu assistente jurídico de elite para Direito do Consumidor e Direito Civil.',
  placeholder: 'Como posso te ajudar, Dr. Felix e Castro?',
  petitionTitlePrefix: 'Petição Dr. Felix e Castro',
  footer: 'Dr. Felix e Castro IA pode cometer erros. Verifique informações importantes.',
};
