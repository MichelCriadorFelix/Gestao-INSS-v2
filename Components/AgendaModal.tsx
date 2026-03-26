import React, { useState } from 'react';
import { CalendarIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { AgendaEvent } from '../types';
import { format, isAfter, isBefore, isToday, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: AgendaEvent[];
  onUpdateEvent: (event: AgendaEvent) => void;
}

const AgendaModal: React.FC<AgendaModalProps> = ({ isOpen, onClose, events, onUpdateEvent }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (!isOpen) return null;

  const today = startOfDay(new Date());
  
  const upcomingEvents = events
    .filter(e => e.status !== 'resolved' && e.status !== 'cancelled')
    .sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      const isOverdueA = isBefore(dateA, today);
      const isOverdueB = isBefore(dateB, today);

      if (isOverdueA && !isOverdueB) return -1;
      if (!isOverdueA && isOverdueB) return 1;
      
      return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    });

  const totalPages = Math.ceil(upcomingEvents.length / itemsPerPage);
  const paginatedEvents = upcomingEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary-600" />
            Próximos Compromissos
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1">
          {paginatedEvents.length === 0 ? (
            <p className="text-center text-slate-500 py-10">Nenhum compromisso pendente.</p>
          ) : (
            <div className="space-y-4">
              {paginatedEvents.map(event => {
                const eventDate = parseISO(event.date);
                const isOverdue = isBefore(eventDate, today);

                return (
                  <div 
                    key={event.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      isOverdue 
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 shadow-sm shadow-red-100 dark:shadow-none' 
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className={`font-bold text-base ${isOverdue ? 'text-red-800 dark:text-red-300' : 'text-slate-800 dark:text-white'}`}>
                          {event.clientName || 'Evento sem cliente'}
                        </span>
                        <span className={`text-xs font-bold uppercase tracking-wider ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {event.type}
                        </span>
                      </div>
                      <div className={`flex flex-col items-end ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}`}>
                        <span className="text-sm font-bold">
                          {format(eventDate, "dd/MM", { locale: ptBR })}
                        </span>
                        <span className="text-xs font-bold">{event.time}</span>
                      </div>
                    </div>
                    
                    <p className={`text-sm mb-4 ${isOverdue ? 'text-red-700/80 dark:text-red-300/70' : 'text-slate-600 dark:text-slate-400'}`}>
                      {event.description}
                    </p>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                      <button
                        onClick={() => handleResolve(event, 'resolved')}
                        className="flex-1 py-2 text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
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
                        className="flex-1 py-2 text-xs font-bold uppercase tracking-wider bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                      >
                        Mudar Data
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Página {currentPage} de {totalPages}</span>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgendaModal;
