const fs = require('fs');
let content = fs.readFileSync('api/index.ts', 'utf8');

const oldPromptBlock = `[COMANDOS DO SISTEMA]:
Para atualizar ou resolver um evento da agenda mediante solicitação, inclua EXATAMENTE este comando na sua resposta (onde id_do_evento é a string do id fornecido): [ACTION:RESOLVE_AGENDA:id_do_evento]. Você pode emitir múltiplos comandos se necessário.`;

const newPromptBlock = `[COMANDOS E DIRETIROES DA AGENDA E CRM]:
1. ATUALIZAÇÃO EM LOTE: Para atualizar ou marcar como resolvido eventos da agenda, inclua a tag [ACTION:RESOLVE_AGENDA:id_do_evento] para CADA UM dos itens solicitados na MESMA resposta. Se o usuário pedir para resolver 3 compromissos, emita obrigatoriamente 3 tags [ACTION:RESOLVE_AGENDA:id] (uma para cada ID).
2. FOCO ESTRITAMENTE OPERACIONAL DA AGENDA: Ao responder sobre a agenda (listar compromissos, confirmar baixas ou prazos), seja OBJETIVO, DIRETO e ADMINISTRATIVO. NÃO adicione pareceres jurídicos longos, citações de artigos de leis (ex: Art. 59 da Lei 8.213/91), doutrina, súmulas ou rotinas de monitoramento processual, a menos que o advogado peça expressamente um parecer ou fundamentação jurídica sobre o caso.`;

if (content.includes(oldPromptBlock)) {
  content = content.replaceAll(oldPromptBlock, newPromptBlock);
  fs.writeFileSync('api/index.ts', content);
  console.log('Successfully updated system prompt in api/index.ts!');
} else {
  console.log('Old prompt block not found exactly, check formatting.');
}
