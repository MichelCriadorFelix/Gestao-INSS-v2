import React from 'react';
import { format, isAfter, isBefore, isToday, isTomorrow, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AgendaEvent } from '../types';
import { CalendarIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface UpcomingEventsWidgetProps {
  events: AgendaEvent[];
  onGoToAgenda: () => void;
  onUpdateEvent: (event: AgendaEvent) => void;
}

const EVENT_TYPES = {
  'audiência': { label: 'Audiência', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  'perícia': { label: 'Perícia', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  'atendimento': { label: 'Atendimento', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  'prazo': { label: 'Prazo', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  'outro': { label: 'Outro', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' }
};

const UpcomingEventsWidget: React.FC<UpcomingEventsWidgetProps> = ({ events, onGoToAgenda, onUpdateEvent }) => {
  const today = startOfDay(new Date());
  
  // Filter events: only pending ones
  // Sort: Overdue first, then closest to today
  const upcomingEvents = events
    .filter(e => e.status !== 'resolved' && e.status !== 'cancelled')
    .sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      const isOverdueA = isBefore(dateA, today);
      const isOverdueB = isBefore(dateB, today);

      if (isOverdueA && !isOverdueB) return -1;
      if (!isOverdueA && isOverdueB) return 1;
      
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      return (a.time || '').localeCompare(b.time || '');
    })
    .slice(0, 8); // Show more since we might have overdue ones

  const getDayLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "dd/MM", { locale: ptBR });
  };

  const handleResolve = (event: AgendaEvent, status: 'resolved' | 'pending', newDate?: string) => {
    const updatedEvent: AgendaEvent = {
      ...event,
      status,
      resolvedAt: status === 'resolved' ? new Date().toISOString() : undefined,
      date: newDate || event.date
    };
    onUpdateEvent(updatedEvent);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary-600" />
          Próximos Compromissos
        </h3>
        <button 
          onClick={onGoToAgenda}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          Ver Agenda
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400">
            <p className="text-sm">Nenhum compromisso pendente.</p>
          </div>
        ) : (
          upcomingEvents.map(event => {
            const eventDate = parseISO(event.date);
            const isOverdue = isBefore(eventDate, today);
            
            return (
              <div 
                key={event.id} 
                className={`flex flex-col gap-3 p-3 rounded-xl border transition-all ${
                  isOverdue 
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center min-w-[48px] pt-0.5">
                    <span className={`text-xs font-bold uppercase ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {getDayLabel(event.date)}
                    </span>
                    <span className={`text-sm font-bold ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-white'}`}>
                      {event.time}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${EVENT_TYPES[event.type].color}`}>
                        {EVENT_TYPES[event.type].label}
                      </span>
                      {(event.type === 'prazo' || isOverdue) && (
                        <ExclamationTriangleIcon className={`h-3.5 w-3.5 ${isOverdue ? 'text-red-500' : 'text-orange-500'}`} />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                      {event.clientName || 'Evento sem cliente'}
                    </p>
                    {event.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700 mt-1">
                  <button
                    onClick={() => handleResolve(event, 'resolved')}
                    className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                  >
                    Resolvido
                  </button>
                  <button
                    onClick={() => {
                      const newDate = prompt('Nova data (AAAA-MM-DD):', event.date);
                      if (newDate && newDate !== event.date) {
                        handleResolve(event, 'pending', newDate);
                      }
                    }}
                    className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                  >
                    Mudar Data
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default UpcomingEventsWidget;
