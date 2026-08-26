const fs = require('fs');
let content = fs.readFileSync('Components/PersonaChat.tsx', 'utf8');

const regex = /systemClients\?: any\[\];/;
content = content.replace(regex, 'systemClients?: any[];\n  onAgendaAction?: (payload: any) => void;');

fs.writeFileSync('Components/PersonaChat.tsx', content);
