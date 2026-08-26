const fs = require('fs');
let content = fs.readFileSync('api/index.ts', 'utf8');

const injection = `
    if (systemState && intent !== "[GERAÇÃO]") {
      selectedSystemPrompt += \`\\n\\n[DADOS INTERNOS DO SISTEMA - CRM, AGENDA E CONTRATOS]
Você possui acesso em tempo real aos dados do escritório (via injeção de contexto). Se o usuário perguntar sobre agenda, clientes ou contratos, consulte os dados a seguir para responder de forma precisa, sem alucinar.
\`;
      if (systemState.agenda && systemState.agenda.length > 0) {
        selectedSystemPrompt += \`AGENDA (Eventos e Compromissos):\\n\${JSON.stringify(systemState.agenda)}\\n\\n\`;
      }
      if (systemState.contracts && systemState.contracts.length > 0) {
        selectedSystemPrompt += \`CONTRATOS ATIVOS:\\n\${JSON.stringify(systemState.contracts)}\\n\\n\`;
      }
      if (systemState.clients && systemState.clients.length > 0) {
        selectedSystemPrompt += \`CLIENTES E HISTÓRICOS (Andamentos/Eventos por Cliente):\\n\${JSON.stringify(systemState.clients)}\\n\\n\`;
      }
    }

    if (history.length > 40) history = history.slice(-40);`;

content = content.replace(/if \(history\.length > 40\) history = history\.slice\(-40\);/g, injection);
fs.writeFileSync('api/index.ts', content);
console.log('Injection applied!');
