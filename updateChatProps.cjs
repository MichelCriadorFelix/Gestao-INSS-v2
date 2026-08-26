const fs = require('fs');
let content = fs.readFileSync('Components/Dashboard.tsx', 'utf8');

content = content.replace(/agendaEvents={agendaEvents}/g, 'agendaEvents={mergedAgendaEvents}\n                    onAgendaAction={handleAgendaAction}');

fs.writeFileSync('Components/Dashboard.tsx', content);
