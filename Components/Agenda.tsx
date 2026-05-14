import React, { useState, useMemo, useEffect } from 'react';
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
import { AgendaEvent, ClientRecord, User, ContractRecord } from '../types';
import ResolutionNoteModal from './ResolutionNoteModal';
import DailyFocus from './DailyFocus';

interface AgendaProps {
  events: AgendaEvent[];
  clients: ClientRecord[];
  contracts: ContractRecord[];
  user: User;
  darkMode: boolean;
  eventToEdit?: AgendaEvent | null;
  onClearEventToEdit?: () => void;
  onSaveEvent: (event: AgendaEvent) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateContractStatus?: (contractId: string, newStatus: 'Pendente' | 'Em Andamento' | 'Concluído') => void;
  dailyFocusState?: any;
  onUpdateDailyFocus?: (state: any) => void;
}

const EVENT_TYPES = {
  'audiência': { label: 'Audiência', color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  'perícia': { label: 'Perícia', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  'atendimento': { label: 'Atendimento', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  'prazo': { label: 'Prazo', color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
  'outro': { label: 'Outro', color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-gold-500/15' }
};

const STATUS_LABELS = {
  'pending': { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  'resolved': { label: 'Resolvido', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  'cancelled': { label: 'Cancelado', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' }
};

const Agenda: React.FC<AgendaProps> = ({ events, clients, contracts, user, darkMode, eventToEdit, onClearEventToEdit, onSaveEvent, onDeleteEvent, onUpdateContractStatus, dailyFocusState, onUpdateDailyFocus }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [eventToResolve, setEventToResolve] = useState<AgendaEvent | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<AgendaEvent>>({
    type: 'atendimento',
    time: '09:00',
    description: '',
    location: '',
    clientName: ''
  });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  useEffect(() => {
    if (eventToEdit) {
      const eventDate = parseISO(eventToEdit.date);
      setCurrentDate(eventDate);
      setSelectedDate(eventDate);
      setIsPanelOpen(true);
      
      setFormData({
        ...eventToEdit
      });
      setClientSearch(eventToEdit.clientName || '');
      setIsFormOpen(true);

      if (onClearEventToEdit) {
        onClearEventToEdit();
      }
    }
  }, [eventToEdit, onClearEventToEdit]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsPanelOpen(true);
    setIsFormOpen(false);
  };

  const handleOpenForm = (event?: AgendaEvent) => {
    if (event) {
      setFormData({
        ...event
      });
      setClientSearch(event.clientName || '');
    } else {
      setFormData({
        type: 'atendimento',
        time: '09:00',
        description: '',
        location: '',
        clientName: '',
        clientId: undefined
      });
      setClientSearch('');
    }
    setIsFormOpen(true);
  };

  const handleSave = (closeForm = true) => {
    if (!selectedDate || !formData.type || !formData.time) return;
    
    const newEvent: AgendaEvent = {
      ...formData,
      id: formData.id || Math.random().toString(36).substr(2, 9),
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: formData.time,
      type: formData.type as any,
      description: formData.description || '',
      location: formData.location || '',
      clientId: formData.clientId,
      clientName: formData.clientId ? clients.find(c => c.id === formData.clientId)?.name : formData.clientName,
      status: formData.status || 'pending',
    } as AgendaEvent;

    onSaveEvent(newEvent);
    if (closeForm) {
        setIsFormOpen(false);
    }
  };

  const handleToggleResolve = (event: AgendaEvent) => {
    const isResolved = event.status === 'resolved';
    if (isResolved) {
        // Se já estiver resolvido, volta para pendente e limpa a nota
        onSaveEvent({
          ...event,
          status: 'pending',
          resolvedAt: undefined,
          resolvedBy: undefined,
          resolutionNote: undefined
        });
    } else {
        // Se estiver pendente, abre o modal para escrever a nota
        setEventToResolve(event);
        setIsResolutionModalOpen(true);
    }
  };

  const getPericiaMsgTemplate = (
    event: AgendaEvent,
    client: ClientRecord | undefined
  ): string => {
    const gender = event.gender || (client?.gender) || 'M';
    const benefitType = event.benefitType || 'incapacidade';
    const isFem = gender === 'F';
    const isBpc = benefitType === 'bpc';
    const isSocial = event.type === 'perícia' && event.description?.toLowerCase().includes('social');

    const dateFormatted = event.date
      ? event.date.split('-').reverse().join('/')
      : '[DATA]';
    const hora = event.time || '[HORA]';
    const local = event.location || '[LOCAL]';
    const nome = event.clientName || client?.name || '';
    const extra = event.extraInstructions?.trim() || '';

    const pronoun = isFem ? 'a senhora' : 'o senhor';
    const pronoun2 = isFem ? 'da senhora' : 'do senhor';
    const pronoun3 = isFem ? 'sozinha' : 'sozinho';
    const vestuario = isFem
      ? 'Roupa simples, do dia a dia. *Não use:* maquiagem, unhas postiças, cabelo elaborado, brincos chamativos, cordão, pulseira ou perfume forte.'
      : 'Roupa simples, do dia a dia. *Não use:* cordão, relógio, anel, pulseira ou qualquer acessório.';
    const tipoEvento = isSocial ? 'Avaliação Social' : 'Perícia Médica';
    const perito = isSocial ? 'assistente social' : 'perito';

    let docs = '';
    if (isSocial && isBpc) {
      docs = `*Documentos ${isFem ? 'da requerente' : 'do requerente'} (originais):*\n` +
        `✅ RG e CPF\n` +
        `✅ Comprovante de residência atualizado\n` +
        `✅ Laudos e exames organizados por tipo e data\n\n` +
        `*⚠️ MUITO IMPORTANTE — Documentos de TODOS que moram na casa:*\n` +
        `✅ RG e CPF de cada morador\n` +
        `✅ Comprovante de renda de cada um (holerite, extrato ou declaração)\n` +
        `✅ Certidão de nascimento dos menores\n` +
        `✅ Se houver idoso ou deficiente na casa, documentos deles também\n\n` +
        `💡 *Importante:* Bolsa Família e BPC de outro morador *não entram* no cálculo de renda — isso é lei.`;
    } else {
      docs = `Organize assim, nessa ordem:\n` +
        `1️⃣ Laudo médico com o CID (diagnóstico) — *esse vem primeiro*\n` +
        `2️⃣ Outros laudos médicos (do mais antigo ao mais recente)\n` +
        `3️⃣ Exames de imagem (ressonância, tomografia, raio-x)\n` +
        `4️⃣ Exames laboratoriais\n` +
        `5️⃣ Receitas médicas\n` +
        `6️⃣ RG e CPF originais`;
    }

    const respostas = isSocial
      ? `✅ Fale somente sobre as limitações, dificuldades e dependência de terceiros ${isFem ? 'da senhora' : 'do senhor'}.\n` +
        `✅ Sobre renda: informe somente o que cada morador *efetivamente recebe* todo mês. Não omita, não invente.\n` +
        `⚠️ Se perguntarem com quem mora: informe o nome e grau de parentesco de cada um.\n` +
        `⚠️ Se perguntarem o que ${pronoun} faz no dia a dia: fale somente das dificuldades e dependência.\n` +
        `❌ Não mencione melhorias na saúde ou na situação financeira.\n` +
        `❌ Responda somente o que for perguntado.`
      : `✅ Fale *somente sobre as limitações e dificuldades* — o que ${pronoun} NÃO consegue fazer, as dores, o que piora, o que impede de trabalhar.\n` +
        `❌ *Não mencione nenhuma melhora*, mesmo que em algum dia se sinta um pouco melhor. O que vale é o pior dia.\n` +
        `⚠️ *Se o ${perito} perguntar "consegue andar?"* — não diga "consigo, mas com dificuldade." Diga: *"Tenho muita dificuldade, sinto muita dor, preciso parar bastante."* Sempre pela limitação.\n` +
        `⚠️ *Se perguntar o que faz em casa:* fale somente do que NÃO consegue fazer ${pronoun3}, o que precisa de ajuda.`;

    const acomp = isSocial
      ? `Leve um acompanhante. ⚠️ *Atenção:* a ${perito} pode chamá-lo separadamente. Ele precisa falar somente das dificuldades ${pronoun2} e da situação real da família — sem inventar e sem omitir renda.`
      : `Leve um acompanhante de confiança. ⚠️ *Atenção:* o ${perito} pode chamá-lo separadamente. Ele precisa falar somente das dificuldades ${pronoun2} — nunca de melhorias.\n\nO acompanhante também deve estar com roupa simples${isFem ? ', sem maquiagem' : ''}, sem acessórios, sem perfume forte.`;

    const postura = isSocial
      ? `${isFem ? 'Seja respeitosa e calma' : 'Seja respeitoso e calmo'}. Responda com clareza e objetividade. Não discuta nem questione a ${perito} durante a avaliação.`
      : `${isFem ? 'Seja respeitosa e calma' : 'Seja respeitoso e calmo'}. Não discuta com o ${perito}, mesmo que ele pareça indiferente — isso é normal. Se tiver dificuldade para sentar, se mover ou ficar em pé, demonstre naturalmente, sem forçar e sem exagerar.`;

    return `*FELIX E CASTRO ADVOCACIA*\n` +
      `*${tipoEvento}${nome ? ' — ' + nome : ''} — Leia com atenção!*\n\n` +
      `📅 Data: ${dateFormatted}\n` +
      `🕐 Horário: ${hora} *(chegue com 30 min de antecedência)*\n` +
      `📍 Local: ${local}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📁 *DOCUMENTOS — leve TUDO no original*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${docs}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${isFem ? '👗' : '👔'} *VESTIMENTA — muito importante*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${vestuario} O ${perito} observa tudo — aparência simples é fundamental.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *ACOMPANHANTE*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${acomp}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🗣️ *COMO RESPONDER ${isSocial ? 'À ASSISTENTE SOCIAL' : 'AO PERITO'}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${respostas}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏛️ *POSTURA NA ${isSocial ? 'AVALIAÇÃO' : 'PERÍCIA'}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${postura}\n` +
      (extra ? `\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *INSTRUÇÕES ESPECÍFICAS*\n━━━━━━━━━━━━━━━━━━━━━━\n${extra}\n` : '') +
      `\nQualquer dúvida, fale comigo antes da perícia. 🤝\n` +
      `*Felix e Castro Advocacia Previdenciária*`;
  };

  const handleConfirmResolution = (note: string) => {
    if (!eventToResolve) return;
    
    const resolvedEvent = {
      ...eventToResolve,
      status: 'resolved' as const,
      resolvedAt: new Date().toISOString(),
      resolvedBy: `${user.firstName} ${user.lastName}`,
      resolutionNote: note
    };

    onSaveEvent(resolvedEvent);

    // Ao resolver qualquer evento vinculado a um cliente,
    // muda o contrato de Pendente para Em Andamento automaticamente
    if (resolvedEvent.clientId && onUpdateContractStatus && contracts) {
        const linked = contracts.find(c =>
            c.clientId === resolvedEvent.clientId &&
            c.status === 'Pendente'
        );
        if (linked) {
            onUpdateContractStatus(linked.id, 'Em Andamento');
        }
    }
    
    setIsResolutionModalOpen(false);
    setEventToResolve(null);
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    return clients.filter(c => c.name && c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-serif font-semibold text-slate-800 dark:text-cream-50 flex items-center gap-2">
          <CalendarIcon className="h-7 w-7 text-primary-600" />
          Agenda
        </h2>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-bordeaux-900/50 transition-colors">
            <ChevronLeftIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
          <span className="text-lg font-medium text-slate-700 dark:text-slate-200 min-w-[150px] text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-bordeaux-900/50 transition-colors">
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
        const dayEvents = events.filter(e => e.date === dateStr && e.status !== 'cancelled').sort((a, b) => (a.time || '').localeCompare(b.time || ''));
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
            className={`min-h-[100px] p-2 border border-slate-100 dark:border-gold-500/20/50 transition-all cursor-pointer relative group
              ${!isSameMonth(day, monthStart) ? 'bg-slate-50/50 dark:bg-slate-900/20 text-slate-400' : 'bg-white dark:bg-bordeaux-950/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-bordeaux-900/50/50'}
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
    return <div className="bg-white dark:bg-bordeaux-950/60 rounded-2xl shadow-sm border border-slate-200 dark:border-gold-500/20 overflow-hidden">{rows}</div>;
  };

  const renderSidePanel = () => {
    if (!selectedDate) return null;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayEvents = events.filter(e => e.date === dateStr && e.status !== 'cancelled').sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    return (
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-bordeaux-950/60 shadow-2xl border-l border-slate-200 dark:border-gold-500/20 transform transition-transform duration-300 ease-in-out z-50 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-gold-500/20 flex justify-between items-center bg-cream-50 dark:bg-bordeaux-900/40/50">
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white capitalize">
                {format(selectedDate, 'EEEE', { locale: ptBR })}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {format(selectedDate, "d 'de' MMMM, yyyy", { locale: ptBR })}
              </p>
            </div>
            <button onClick={() => setIsPanelOpen(false)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-bordeaux-900/60 transition-colors">
              <XMarkIcon className="h-6 w-6 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!isFormOpen ? (
              <>
                <button 
                  onClick={() => handleOpenForm()}
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
                                onClick={() => handleOpenForm(event)}
                                className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                                title="Editar compromisso"
                              >
                                <TagIcon className="h-4 w-4 opacity-70" />
                              </button>
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
                                className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
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
                            {event.isVirtual && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-primary-100 text-primary-800 dark:bg-blue-900/40 dark:text-gold-300">
                                Automático
                              </span>
                            )}
                          </div>
                          
                          {(event.clientName || event.clientId) && (
                            <div className={`font-semibold text-lg mb-1 flex items-center gap-2 ${isResolved ? 'line-through opacity-60' : ''}`}>
                              <UserIcon className="h-4 w-4 opacity-70" />
                              {event.clientName || clients.find(c => c.id === event.clientId)?.name}
                            </div>
                          )}
                          
                          {event.location && (
                            <div className={`text-sm font-medium mt-1 flex items-center gap-2 ${isResolved ? 'opacity-60' : ''}`}>
                              <TagIcon className="h-4 w-4 opacity-70" />
                              {event.location}
                            </div>
                          )}
                          
                          {event.description && (
                            <div className={`text-sm opacity-90 mt-2 whitespace-pre-wrap flex items-start gap-2 ${isResolved ? 'opacity-50' : ''}`}>
                              <DocumentTextIcon className="h-4 w-4 opacity-70 mt-0.5 shrink-0" />
                              <p>{event.description}</p>
                            </div>
                          )}

                          {/* Botão WhatsApp para Perícias */}
                          {event.type === 'perícia' && event.clientId && (() => {
                            const client = clients.find(c => c.id === event.clientId);
                            if (!client?.whatsapp) return null;
                            const wn = client.whatsapp.replace(/\D/g, '');
                            const whatsapp = wn.startsWith('55') ? wn : '55' + wn;
                            const msg = getPericiaMsgTemplate(event, client);
                            const encoded = encodeURIComponent(msg);
                            return (
                              <a
                                href={`https://wa.me/${whatsapp}?text=${encoded}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.855L.057 23.882l6.186-1.453A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.032-1.388l-.361-.214-3.732.877.944-3.618-.235-.372A9.808 9.808 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                                </svg>
                                Enviar Orientações da Perícia
                              </a>
                            );
                          })()}
                          {isResolved && event.resolutionNote && (
                            <div className="mt-3 bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <CheckIcon className="h-3 w-3" />
                                Conclusão
                              </p>
                              <p className="text-xs text-slate-700 dark:text-slate-300 italic">"{event.resolutionNote}"</p>
                              <div className="mt-2 flex justify-between items-center text-[9px] text-slate-400 font-medium">
                                <span>Por: {event.resolvedBy}</span>
                                <span>{event.resolvedAt && format(parseISO(event.resolvedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                              </div>
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
                  <h4 className="font-bold text-lg text-slate-800 dark:text-white">
                    {formData.id ? 'Editar Compromisso' : 'Adicionar Compromisso'}
                  </h4>
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
                            : 'bg-white dark:bg-bordeaux-950/40 border-slate-200 dark:border-gold-500/15 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-bordeaux-900/60'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Data (Apenas se estiver editando) */}
                  {formData.id && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data</label>
                      <input 
                        type="date" 
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full p-2.5 bg-cream-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Horário */}
                  <div className={formData.id ? "" : "col-span-2"}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Horário</label>
                    <input 
                      type="time" 
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full p-2.5 bg-cream-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Local */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Sala 01, Fórum, Clínica..."
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full p-2.5 bg-cream-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white"
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
                    className="w-full p-2.5 bg-cream-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white"
                  />
                  
                  {showClientDropdown && clientSearch && filteredClients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-bordeaux-950/40 border border-slate-200 dark:border-gold-500/15 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredClients.map(client => (
                        <div 
                          key={client.id}
                          onClick={() => {
                            setFormData({ ...formData, clientId: client.id, clientName: client.name });
                            setClientSearch(client.name);
                            setShowClientDropdown(false);
                          }}
                          className="p-3 hover:bg-slate-50 dark:hover:bg-bordeaux-900/60 cursor-pointer border-b border-slate-100 dark:border-gold-500/15/50 last:border-0"
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
                    className="w-full p-3 bg-cream-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white resize-none"
                  />
                </div>

                {/* Campos extras para Perícia */}
                {formData.type === 'perícia' && (
                  <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30">
                    <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Configurações da Perícia (WhatsApp)</p>
                    
                    {/* Gênero */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Gênero do Cliente</label>
                      <div className="flex gap-2">
                        <button type="button"
                          onClick={() => setFormData({ ...formData, gender: 'M' })}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${formData.gender === 'M' ? 'bg-primary-700 text-white border-blue-600' : 'bg-white dark:bg-bordeaux-950/40 border-slate-200 dark:border-gold-500/15 text-slate-600 dark:text-slate-400'}`}
                        >👨 Masculino</button>
                        <button type="button"
                          onClick={() => setFormData({ ...formData, gender: 'F' })}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${formData.gender === 'F' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white dark:bg-bordeaux-950/40 border-slate-200 dark:border-gold-500/15 text-slate-600 dark:text-slate-400'}`}
                        >👩 Feminino</button>
                      </div>
                    </div>

                    {/* Tipo de Benefício */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de Benefício</label>
                      <div className="flex gap-2">
                        <button type="button"
                          onClick={() => setFormData({ ...formData, benefitType: 'incapacidade' })}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${formData.benefitType === 'incapacidade' || !formData.benefitType ? 'bg-primary-700 text-white border-indigo-600' : 'bg-white dark:bg-bordeaux-950/40 border-slate-200 dark:border-gold-500/15 text-slate-600 dark:text-slate-400'}`}
                        >🏥 Incapacidade</button>
                        <button type="button"
                          onClick={() => setFormData({ ...formData, benefitType: 'bpc' })}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${formData.benefitType === 'bpc' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-bordeaux-950/40 border-slate-200 dark:border-gold-500/15 text-slate-600 dark:text-slate-400'}`}
                        >📋 BPC/LOAS</button>
                      </div>
                    </div>

                    {/* Instruções Específicas */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Instruções Específicas do Caso</label>
                      <textarea
                        rows={3}
                        placeholder="Ex: Não tome remédio que diminui a dor no dia da perícia. Leve a muleta. Informe que tem crise X vezes por semana..."
                        value={formData.extraInstructions || ''}
                        onChange={(e) => setFormData({ ...formData, extraInstructions: e.target.value })}
                        className="w-full p-3 bg-white dark:bg-bordeaux-950/40 border border-slate-200 dark:border-gold-500/15 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-white resize-none text-sm"
                      />
                    </div>
                  </div>
                )}

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
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Calendar Section */}
          <div>
            {renderHeader()}
            {renderDays()}
            {renderCells()}
          </div>

          {/* Daily Focus Section */}
          <div className="bg-white dark:bg-bordeaux-950/60 rounded-2xl shadow-sm border border-slate-200 dark:border-gold-500/20 p-6">
            <DailyFocus 
              events={events}
              clients={clients} 
              contracts={contracts} 
              user={user} 
              darkMode={darkMode} 
              onUpdateContractStatus={onUpdateContractStatus}
              dailyFocusState={dailyFocusState}
              onUpdateDailyFocus={onUpdateDailyFocus}
            />
          </div>
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

      <ResolutionNoteModal
        isOpen={isResolutionModalOpen}
        onClose={() => {
          setIsResolutionModalOpen(false);
          setEventToResolve(null);
        }}
        onConfirm={handleConfirmResolution}
        event={eventToResolve}
        user={user}
      />
    </div>
  );
};

export default Agenda;
