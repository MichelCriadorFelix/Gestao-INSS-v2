const fs = require('fs');
let content = fs.readFileSync('api/index.ts', 'utf8');

const target = `      if (systemState.clients && systemState.clients.length > 0) {
        selectedSystemPrompt += \`CLIENTES E HISTÓRICOS (Andamentos/Eventos por Cliente):\\n\${JSON.stringify(systemState.clients)}\\n\\n\`;
      }`;

const replacement = `      if (systemState.clients && systemState.clients.length > 0) {
        selectedSystemPrompt += \`CLIENTES E HISTÓRICOS (Andamentos/Eventos por Cliente):\\n\${JSON.stringify(systemState.clients)}\\n\\n\`;
      }
    }`;

// Replace each occurrence where target is NOT followed by }
content = content.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\s*\\})', 'g'), replacement);

fs.writeFileSync('api/index.ts', content);
console.log('Fixed systemState closing braces!');
