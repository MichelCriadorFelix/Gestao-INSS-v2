const fs = require('fs');
let content = fs.readFileSync('Components/PersonaChat.tsx', 'utf8');

const injection = `
      // Process agenda actions
      const agendaRegex = /\\[ACTION:RESOLVE_AGENDA:([^\\]]+)\\]/g;
      let match;
      while ((match = agendaRegex.exec(fullText)) !== null) {
          const eventId = match[1].trim();
          if (onAgendaAction) {
              onAgendaAction({ action: 'resolve', eventId });
          }
      }
      displayContent = displayContent.replace(/\\[ACTION:RESOLVE_AGENDA:[^\\]]+\\]/g, '').trim();

      const assistantMsg: Message = {`;

content = content.replace('const assistantMsg: Message = {', injection);
fs.writeFileSync('Components/PersonaChat.tsx', content);
