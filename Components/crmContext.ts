// Contexto de CRM sob demanda: monta, a partir da MENSAGEM, só o pedaço do CRM (agenda / contratos / clientes) que o comando
// realmente precisa — em vez de anexar o estado inteiro do escritório (322 clientes, 199 contratos, agenda) a cada mensagem.
//
// Exemplos:
//   "conclua o contrato da Lanetone"        → só o(s) cliente(s) "Lanetone", seus contratos e compromissos que a citam
//   "o que temos para essa semana?"          → só a agenda
//   "quais contratos estão em andamento?"    → só os contratos
//   "quais clientes estão arquivados?"       → lista de clientes (sem agenda/contratos)
//
// A decisão de INCLUIR CRM continua sendo do servidor (needsCrmContext); aqui só se reduz o conteúdo.

const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Palavras que aparecem em comandos de CRM mas não identificam uma PESSOA (não podem virar filtro por nome).
const STOP = new Set([
  'quais', 'qual', 'quantos', 'quantas', 'para', 'essa', 'esta', 'esse', 'este', 'semana', 'hoje', 'amanha', 'mes', 'dias', 'proximos', 'proximas',
  'status', 'conclua', 'concluir', 'marque', 'marcar', 'resolva', 'resolver', 'atualize', 'atualizar', 'contrato', 'contratos', 'cliente', 'clientes',
  'agenda', 'compromisso', 'compromissos', 'honorarios', 'parcela', 'parcelas', 'pagamento', 'andamento', 'arquivado', 'arquivados', 'ativos', 'ativo',
  'lista', 'todos', 'todas', 'sobre', 'tenho', 'temos', 'tem', 'com', 'que', 'dos', 'das', 'uma', 'uns', 'umas', 'pelo', 'pela', 'seus', 'suas', 'meus',
  'minha', 'meu', 'dele', 'dela', 'como', 'esta', 'estao', 'esta', 'foram', 'feito', 'feita', 'fazer', 'fala', 'diga', 'mostre', 'liste', 'quero', 'preciso',
  'pericia', 'pericias', 'audiencia', 'audiencias', 'prazo', 'prazos', 'reuniao', 'concluido', 'pendente', 'pendentes', 'historico', 'cadastro', 'data',
]);

const MAX_MATCHED_CLIENTS = 8;

export interface CrmInputs {
  agenda?: any[];
  clients?: any[];
  contracts?: any[];
}
export interface CrmPayload {
  agenda?: any[];
  clients?: any[];
  contracts?: any[];
}

export function nameTokens(message: string): string[] {
  return Array.from(new Set(norm(message).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w))));
}

const wholeWord = (token: string, text: string) => new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(text);

export function buildCrmPayload(message: string, input: CrmInputs): CrmPayload | undefined {
  const m = norm(message);
  const clients = input.clients || [];
  const contracts = input.contracts || [];
  const agenda = input.agenda || [];

  const wantsAgenda = /agenda|compromiss|semana|hoje|amanha|prazo|audienc|pericia|reuniao|marc(?:ar|ue)|resolv|reagend/.test(m);
  const wantsContracts = /contrat|honorar|parcela|pagament|faturament|mensalidad|inadimpl|quitad/.test(m);
  const wantsClients = /cliente|andamento|cadastro|status|arquiv|conclu|atualiz|historic/.test(m);

  // 1) Comando sobre PESSOA(S) específica(s): só elas.
  const tokens = nameTokens(message);
  if (tokens.length > 0) {
    const matched = clients.filter(c => {
      const n = norm(c?.name || '');
      return tokens.some(t => wholeWord(t, n));
    });
    if (matched.length > 0 && matched.length <= MAX_MATCHED_CLIENTS) {
      const usedTokens = tokens.filter(t => matched.some(c => wholeWord(t, norm(c?.name || ''))));
      const hit = (obj: any) => {
        const blob = norm(JSON.stringify(obj || {}));
        return usedTokens.some(t => wholeWord(t, blob));
      };
      return {
        clients: matched,
        contracts: contracts.filter(hit),
        agenda: agenda.filter(hit),
      };
    }
  }

  // 2) Comando genérico: só as seções que ele pede.
  const out: CrmPayload = {};
  if (wantsAgenda) out.agenda = agenda;
  if (wantsContracts) out.contracts = contracts;
  if (wantsClients) out.clients = clients;
  if (!out.agenda && !out.contracts && !out.clients) return { agenda, contracts, clients }; // intenção CRM sem pista: comportamento antigo
  return out;
}
