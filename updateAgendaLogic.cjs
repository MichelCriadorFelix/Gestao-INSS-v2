const fs = require('fs');
let content = fs.readFileSync('Components/Dashboard.tsx', 'utf8');

const newFunc = `
  const handleAgendaAction = (payload: any) => {
      try {
          if (payload.action === 'resolve') {
              const eventId = payload.eventId;
              const existingEvent = agendaEvents.find(e => e.id === eventId);
              if (existingEvent) {
                  const updated = agendaEvents.map(e => e.id === eventId ? { ...e, status: 'resolved' as const } : e);
                  setAgendaEvents(updated);
                  saveData('agenda', updated);
              } else if (eventId.startsWith('v-')) {
                  // create an override for virtual event
                  const virtualEvent = mergedAgendaEvents.find(e => e.id === eventId);
                  if (virtualEvent) {
                      const updated = [...agendaEvents, { ...virtualEvent, status: 'resolved' as const }];
                      setAgendaEvents(updated);
                      saveData('agenda', updated);
                  }
              }
          }
      } catch (e) {
          console.error("Erro ao processar acao da agenda", e);
      }
  };

  const handleSaveAgendaEvent`;

content = content.replace('const handleSaveAgendaEvent', newFunc);
fs.writeFileSync('Components/Dashboard.tsx', content);
