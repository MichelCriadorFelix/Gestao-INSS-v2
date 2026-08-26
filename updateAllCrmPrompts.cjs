const fs = require('fs');
let content = fs.readFileSync('api/index.ts', 'utf8');

const oldPromptBlock = `[COMANDOS E DIRETIROES DA AGENDA E CRM]:
1. ATUALIZAÇÃO EM LOTE: Para atualizar ou marcar como resolvido eventos da agenda, inclua a tag [ACTION:RESOLVE_AGENDA:id_do_evento] para CADA UM dos itens solicitados na MESMA resposta. Se o usuário pedir para resolver 3 compromissos, emita obrigatoriamente 3 tags [ACTION:RESOLVE_AGENDA:id] (uma para cada ID).
2. FOCO ESTRITAMENTE OPERACIONAL DA AGENDA: Ao responder sobre a agenda (listar compromissos, confirmar baixas ou prazos), seja OBJETIVO, DIRETO e ADMINISTRATIVO. NÃO adicione pareceres jurídicos longos, citações de artigos de leis (ex: Art. 59 da Lei 8.213/91), doutrina, súmulas ou rotinas de monitoramento processual, a menos que o advogado peça expressamente um parecer ou fundamentação jurídica sobre o caso.`;

const newPromptBlock = `[COMANDOS E DIRETRIZES DE CRM, CONTRATOS, CLIENTES E AGENDA]:
1. ATUALIZAÇÃO EM LOTE NA AGENDA, CONTRATOS E CLIENTES:
   - Para resolver compromissos da agenda, inclua: [ACTION:RESOLVE_AGENDA:id_do_evento]
   - Para alterar o status de um contrato, inclua: [ACTION:UPDATE_CONTRACT:id_do_contrato:STATUS] (Valores de STATUS: 'Pendente', 'Em Andamento' ou 'Concluído').
   - Para alterar o status de um cliente/cadastro, inclua: [ACTION:UPDATE_CLIENT:id_do_cliente:STATUS] (Valores de STATUS: 'Ativo', 'Em Andamento', 'Concluído', 'Arquivado').
   - IMPORTANTE: Emita uma tag para CADA item solicitado na MESMA resposta para atualizações em lote.
2. FOCO ESTRITAMENTE OPERACIONAL E ADMINISTRATIVO:
   - Ao responder sobre agenda, lista de contratos, dados de clientes ou atualizações de CRM, seja OBJETIVO, SUCINTO, DIRETO e ADMINISTRATIVO.
   - NUNCA adicione pareceres jurídicos longos, fundamentações teóricas, citações de artigos de lei (ex: Art. 59 da Lei 8.213/91), doutrinas ou rotinas de monitoramento processual, A MENOS QUE o advogado solicite expressamente uma fundamentação jurídica ou análise técnica do caso.`;

if (content.includes(oldPromptBlock)) {
  content = content.replaceAll(oldPromptBlock, newPromptBlock);
  fs.writeFileSync('api/index.ts', content);
  console.log('Successfully updated system prompt in api/index.ts to full CRM/Contracts/Clients!');
} else {
  console.log('Target prompt block not found, searching with regex...');
  // Regex fallback
  const regex = /\[COMANDOS E DIRETIROES DA AGENDA E CRM\]:[\s\S]*?(?=`;)/g;
  content = content.replace(regex, newPromptBlock);
  fs.writeFileSync('api/index.ts', content);
  console.log('Updated via regex!');
}
