import React, { useState, useMemo } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays,
  parseISO,
  isBefore,
  startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  PlusIcon, 
  XMarkIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  DocumentTextIcon,
  TrashIcon,
  CheckIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';
import { AgendaEvent, ClientRecord } from '../types';

interface AgendaProps {
  events: AgendaEvent[];
  clients: ClientRecord[];
  onSaveEvent: (event: AgendaEvent) => void;
  onDeleteEvent: (id: string) => void;
}

const EVENT_TYPES = {
  'audiência': { label: 'Audiência', color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  'perícia': { label: 'Perícia', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  'atendimento': { label: 'Atendimento', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  'prazo': { label: 'Prazo', color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
  'outro': { label: 'Outro', color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' }
};

const STATUS_LABELS = {
  'pending': { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  'resolved': { label: 'Resolvido', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  'cancelled': { label: 'Cancelado', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' }
};

const Agenda: React.FC<AgendaProps> = ({ events, clients, onSaveEvent, onDeleteEvent }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<Partial<AgendaEvent>>({
    type: 'atendimento',
    time: '09:00',
    description: '',
    clientName: ''
  });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsPanelOpen(true);
    setIsFormOpen(false);
  };

  const handleOpenForm = () => {
    setFormData({
      type: 'atendimento',
      time: '09:00',
      description: '',
      clientName: '',
      clientId: undefined
    });
    setClientSearch('');
    setIsFormOpen(true);
  };

  const handleSave = (closeForm = true) => {
    if (!selectedDate || !formData.type || !formData.time) return;
    
    const newEvent: AgendaEvent = {
      id: Math.random().toString(36).substr(2, 9),
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: formData.time,
      type: formData.type as any,
      description: formData.description || '',
      clientId: formData.clientId,
      clientName: formData.clientId ? clients.find(c => c.id === formData.clientId)?.name : formData.clientName
    };

    onSaveEvent(newEvent);
    if (closeForm) {
        setIsFormOpen(false);
    }
  };

  const handleToggleResolve = (event: AgendaEvent) => {
    const isResolved = event.status === 'resolved';
    onSaveEvent({
      ...event,
      status: isResolved ? 'pending' : 'resolved',
      resolvedAt: isResolved ? undefined : new Date().toISOString()
    });
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    return clients.filter(c => c.name && c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <CalendarIcon className="h-7 w-7 text-primary-600" />
          Agenda
        </h2>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ChevronLeftIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
          <span className="text-lg font-medium text-slate-700 dark:text-slate-200 min-w-[150px] text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ChevronRightIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-semibold text-sm text-slate-500 dark:text-slate-400 py-2 capitalize">
          {format(addDays(startDate, i), 'EEEE', { locale: ptBR }).split('-')[0]}
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-2">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayEvents = events.filter(e => e.date === dateStr).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const isToday = isSameDay(day, new Date());
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const pendingEvents = dayEvents.filter(e => e.status !== 'resolved' && e.status !== 'cancelled');
        const hasOverdue = pendingEvents.some(e => {
            const eventDate = parseISO(e.date);
            return isBefore(startOfDay(eventDate), startOfDay(new Date()));
        });

        days.push(
          <div
            key={day.toString()}
            onClick={() => handleDayClick(cloneDay)}
            className={`min-h-[100px] p-2 border border-slate-100 dark:border-slate-800/50 transition-all cursor-pointer relative group
              ${!isSameMonth(day, monthStart) ? 'bg-slate-50/50 dark:bg-slate-900/20 text-slate-400' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
              ${isSelected ? 'ring-2 ring-inset ring-primary-500 bg-primary-50/30 dark:bg-primary-900/20' : ''}
              ${hasOverdue ? 'bg-red-50/30 dark:bg-red-900/10' : ''}
            `}
          >
            <div className="flex justify-between items-start">
              <span className={`text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30' : ''} ${hasOverdue && !isToday ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : ''}`}>
                {formattedDate}
              </span>
              {dayEvents.length > 0 && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${hasOverdue ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                  {dayEvents.length}
                </span>
              )}
            </div>
            
            <div className="mt-2 space-y-1 overflow-y-auto max-h-[60px] no-scrollbar">
              {dayEvents.slice(0, 3).map(event => {
                const isResolved = event.status === 'resolved';
                const eventDate = parseISO(event.date);
                const isOverdue = !isResolved && event.status !== 'cancelled' && isBefore(startOfDay(eventDate), startOfDay(new Date()));
                
                return (
                  <div key={event.id} className={`text-xs px-1.5 py-1 rounded truncate border ${isResolved ? 'opacity-50 line-through' : ''} ${isOverdue ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : EVENT_TYPES[event.type].color}`}>
                    <span className="font-medium mr-1">{event.time}</span>
                    {event.clientName || 'Evento'}
                  </div>
                );
              })}
              {dayEvents.length > 3 && (
                <div className="text-xs text-center text-slate-500 font-medium">
                  +{dayEvents.length - 3} mais
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">{rows}</div>;
  };

  const renderSidePanel = () => {
    if (!selectedDate) return null;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayEvents = events.filter(e => e.date === dateStr).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    return (
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out z-50 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white capitalize">
                {format(selectedDate, 'EEEE', { locale: ptBR })}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {format(selectedDate, "d 'de' MMMM, yyyy", { locale: ptBR })}
              </p>
            </div>
            <button onClick={() => setIsPanelOpen(false)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <XMarkIcon className="h-6 w-6 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!isFormOpen ? (
              <>
                <button 
                  onClick={handleOpenForm}
                  className="w-full mb-6 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-xl font-medium transition-colors shadow-sm shadow-primary-500/20"
                >
                  <PlusIcon className="h-5 w-5" />
                  Novo Compromisso
                </button>

                {dayEvents.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="bg-slate-100 dark:bg-slate-800 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CalendarIcon className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum compromisso neste dia.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dayEvents.map(event => {
                      const isResolved = event.status === 'resolved';
                      const eventDate = parseISO(event.date);
                      const isOverdue = !isResolved && event.status !== 'cancelled' && isBefore(startOfDay(eventDate), startOfDay(new Date()));
                      const status = event.status || 'pending';

                      return (
                        <div key={event.id} className={`p-4 rounded-xl border ${isOverdue ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : EVENT_TYPES[event.type].color} bg-opacity-50 dark:bg-opacity-20`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <ClockIcon className="h-4 w-4 opacity-70" />
                              <span className="font-bold">{event.time}</span>
                              {isOverdue && <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider animate-pulse">Atrasado</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleToggleResolve(event)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  isResolved 
                                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300' 
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300'
                                }`}
                                title={isResolved ? "Reabrir compromisso" : "Marcar como resolvido"}
                              >
                                {isResolved ? (
                                  <ArrowUturnLeftIcon className="h-4 w-4" />
                                ) : (
                                  <CheckIcon className="h-4 w-4" />
                                )}
                              </button>
                              <button 
                                onClick={() => onDeleteEvent(event.id)}
                                className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                title="Excluir compromisso"
                              >
                                <TrashIcon className="h-4 w-4 opacity-70 hover:opacity-100 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mb-2">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-white/50 dark:bg-black/20">
                              {EVENT_TYPES[event.type].label}
                            </span>
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${STATUS_LABELS[status].color}`}>
                              {STATUS_LABELS[status].label}
                            </span>
                          </div>
                          
                          {(event.clientName || event.clientId) && (
                            <div className={`font-semibold text-lg mb-1 flex items-center gap-2 ${isResolved ? 'line-through opacity-60' : ''}`}>
                              <UserIcon className="h-4 w-4 opacity-70" />
                              {event.clientName || clients.find(c => c.id === event.clientId)?.name}
                            </div>
                          )}
                          
                          {event.description && (
                            <div className={`text-sm opacity-90 mt-2 whitespace-pre-wrap flex items-start gap-2 ${isResolved ? 'opacity-50' : ''}`}>
                              <DocumentTextIcon className="h-4 w-4 opacity-70 mt-0.5 shrink-0" />
                              <p>{event.description}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-lg text-slate-800 dark:text-white">Adicionar Compromisso</h4>
                  <button onClick={() => setIsFormOpen(false)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancelar</button>
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de Evento</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(EVENT_TYPES).map(([key, { label, color }]) => (
                      <button
                        key={key}
                        onClick={() => setFormData({ ...formData, type: key as any })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          formData.type === key 
                            ? color + ' ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ring-primary-500' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horário */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Horário</label>
                  <input 
                    type="time" 
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white"
                  />
                </div>

                {/* Cliente (Combobox) */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cliente / Pessoa</label>
                  <input 
                    type="text" 
                    placeholder="Digite um nome ou selecione..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setFormData({ ...formData, clientName: e.target.value, clientId: undefined });
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white"
                  />
                  
                  {showClientDropdown && clientSearch && filteredClients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredClients.map(client => (
                        <div 
                          key={client.id}
                          onClick={() => {
                            setFormData({ ...formData, clientId: client.id, clientName: client.name });
                            setClientSearch(client.name);
                            setShowClientDropdown(false);
                          }}
                          className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                        >
                          <div className="font-medium text-slate-800 dark:text-white">{client.name}</div>
                          <div className="text-xs text-slate-500">{client.cpf}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações / Detalhes</label>
                  <textarea 
                    rows={4}
                    placeholder="Link da reunião, número do processo, sala..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white resize-none"
                  />
                </div>

                <div className="flex gap-2 mt-4">
                  <button 
                    onClick={() => handleSave()}
                    disabled={!formData.time}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold transition-colors shadow-md shadow-primary-500/20"
                  >
                    Salvar
                  </button>
                  <button 
                    onClick={() => {
                        handleSave(false);
                        handleOpenForm();
                    }}
                    disabled={!formData.time}
                    className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-white py-3 px-4 rounded-xl font-bold transition-colors"
                  >
                    Salvar e Adicionar Outro
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-slate-50 dark:bg-[#0B1120]">
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>
      </div>

      {/* Backdrop */}
      {isPanelOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsPanelOpen(false)}
        />
      )}

      {renderSidePanel()}
    </div>
  );
};

export default Agenda;
