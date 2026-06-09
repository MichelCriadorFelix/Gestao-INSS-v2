// Configuração por persona de IA. Cada persona mantém sua individualidade
// (nome, endpoint, foco de base, namespace de histórico) — o componente
// PersonaChat consome esta config. Unifica o esqueleto sem fundir as personas.
export interface PersonaConfig {
  aiName: 'michel' | 'luana' | 'felix_castro' | 'fabricia'; // id no Supabase / ai_name
  auditKey: string;          // chave idb de auditoria pendente
  sessionsKey: string;       // chave localStorage de sessões
  inputId: string;           // id do textarea de input
  chatEndpoint: string;      // endpoint /chat específico da persona
  docxEndpoint: string;      // endpoint de geração de DOCX
  docxFilePrefix: string;    // prefixo do nome do arquivo .docx baixado
  agentAreas: string[];      // ordem de áreas para o roteamento do RAG
  displayName: string;       // nome exibido
  greeting: string;          // saudação da tela de boas-vindas (Olá, X!)
  accentClass: string;       // classe Tailwind da cor de destaque do título
  welcomeTitle: string;      // título de boas-vindas
  subtitle: string;          // subtítulo descritivo
  placeholder: string;       // placeholder do input
  petitionTitlePrefix: string; // prefixo do título de petição gerada
  footer: string;            // aviso de rodapé
  sendMinWage: boolean;      // envia salário mínimo ao backend (rito trabalhista — Dra. Luana)
}

export const MICHEL_PERSONA: PersonaConfig = {
  aiName: 'michel',
  auditKey: 'pending_audit_dr_michel',
  sessionsKey: 'dr_michel_sessions',
  inputId: 'chat-input-michel',
  chatEndpoint: '/api/dr-michel/chat',
  docxEndpoint: '/api/dr-michel/generate-docx',
  docxFilePrefix: 'Peticao_Dr_Michel',
  agentAreas: ['INSS', 'RPPS', 'CIVEL', 'TRABALHISTA', 'CONSUMIDOR'],
  displayName: 'Dr. Michel Felix',
  greeting: 'MICHEL',
  accentClass: 'text-emerald-600',
  welcomeTitle: 'Bem vindo ao Dr. Michel Felix IA',
  subtitle: 'Seu assistente jurídico de elite para Direito Previdenciário.',
  placeholder: 'Como posso te ajudar, Dr. Michel?',
  petitionTitlePrefix: 'Petição Dr. Michel',
  footer: 'Dr. Michel Felix IA pode cometer erros. Verifique informações importantes.',
  sendMinWage: false,
};

export const LUANA_PERSONA: PersonaConfig = {
  aiName: 'luana',
  auditKey: 'pending_audit_dra_luana',
  sessionsKey: 'dra_luana_sessions',
  inputId: 'chat-input-luana',
  chatEndpoint: '/api/dra-luana/chat',
  docxEndpoint: '/api/dr-michel/generate-docx',
  docxFilePrefix: 'Peticao_Dra_Luana',
  agentAreas: ['TRABALHISTA', 'CIVEL', 'CONSUMIDOR', 'INSS', 'RPPS'],
  displayName: 'Dra. Luana Castro',
  greeting: 'DOUTOR(A)',
  accentClass: 'text-rose-600',
  welcomeTitle: 'Bem vindo à Dra. Luana Castro IA',
  subtitle: 'Sua especialista em Direito Trabalhista e Processo do Trabalho.',
  placeholder: 'Como posso te ajudar, Dra. Luana?',
  petitionTitlePrefix: 'Petição Dra. Luana',
  footer: 'Dra. Luana Castro IA pode cometer erros. Verifique informações importantes.',
  sendMinWage: true,
};

export const FELIX_CASTRO_PERSONA: PersonaConfig = {
  aiName: 'felix_castro',
  auditKey: 'pending_audit_dr_felix_castro',
  sessionsKey: 'dr_felix_castro_sessions',
  inputId: 'chat-input-felix-castro',
  chatEndpoint: '/api/dr-felix-castro/chat',
  docxEndpoint: '/api/dr-michel/generate-docx',
  docxFilePrefix: 'Peticao_Dr_Felix_e_Castro',
  agentAreas: ['CONSUMIDOR', 'CIVEL', 'TRABALHISTA', 'INSS', 'RPPS'],
  displayName: 'Dr. Felix e Castro',
  greeting: 'MICHEL',
  accentClass: 'text-emerald-600',
  welcomeTitle: 'Bem vindo ao Dr. Felix e Castro IA',
  subtitle: 'Seu assistente jurídico de elite para Direito do Consumidor e Direito Civil.',
  placeholder: 'Como posso te ajudar, Dr. Felix e Castro?',
  petitionTitlePrefix: 'Petição Dr. Felix e Castro',
  footer: 'Dr. Felix e Castro IA pode cometer erros. Verifique informações importantes.',
  sendMinWage: false,
};

export const FABRICIA_PERSONA: PersonaConfig = {
  aiName: 'fabricia',
  auditKey: 'pending_audit_sec_fabricia',
  sessionsKey: 'sec_fabricia_sessions',
  inputId: 'chat-input-fabricia',
  chatEndpoint: '/api/sec-fabricia/chat',
  docxEndpoint: '/api/sec-fabricia/generate-docx',
  docxFilePrefix: 'Documento_Sec_Fabricia',
  agentAreas: ['INSS', 'RPPS', 'TRABALHISTA', 'CONSUMIDOR', 'CIVEL'],
  displayName: 'Sec. Fabrícia Felix',
  greeting: 'FABRÍCIA',
  accentClass: 'text-emerald-600',
  welcomeTitle: 'Bem vindo ao Sec. Fabrícia Felix IA',
  subtitle: 'Seu assistente jurídico de elite para Direito Previdenciário.',
  placeholder: 'Como posso te ajudar, Sec. Fabrícia?',
  petitionTitlePrefix: 'Documento Sec. Fabrícia',
  footer: 'Sec. Fabrícia Felix IA pode cometer erros. Verifique informações importantes.',
  sendMinWage: false,
};
