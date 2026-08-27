import React, { useState, useEffect, useMemo } from 'react';
import { AgendaEvent, ClientRecord, ContractRecord, User, FocusTask, TaskLogEntry } from '../types';
import { format, isBefore, startOfDay, addDays, parseISO, isSameDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircleIcon, 
  XMarkIcon, 
  ClockIcon, 
  ExclamationCircleIcon,
  DocumentTextIcon,
  CalendarIcon,
  SparklesIcon,
  UserIcon,
  TagIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { isUrgentDate, parseDate } from '../utils';

interface DailyFocusProps {
  events: AgendaEvent[];
  clients: ClientRecord[];
  contracts: ContractRecord[];
  user: User;
  darkMode: boolean;
  onUpdateContractStatus?: (contractId: string, newStatus: 'Pendente' | 'Em Andamento' | 'Concluído') => void;
  dailyFocusState?: any;
  onUpdateDailyFocus?: (state: any) => void;
  /** Propaga a conclusão para o sininho, a agenda e a lista de clientes. */
  onTaskResolved?: (task: FocusTask) => void;
}

// Helper to safely parse dates in various formats: ISO, YYYY-MM-DD, or DD/MM/YYYY
const parseAnyDate = (dateVal: string | undefined | null): Date | null => {
  if (!dateVal) return null;
  const trimmed = String(dateVal).trim();
  if (!trimmed) return null;
  
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  try {
    const d = parseISO(trimmed);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {}

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
};

export default function DailyFocus({ events, clients, contracts, user, darkMode, onUpdateContractStatus, dailyFocusState, onUpdateDailyFocus, onTaskResolved }: DailyFocusProps) {
  const resolvedTasks = dailyFocusState?.resolvedTasks || [];
  const postponedTasks = dailyFocusState?.postponedTasks || [];
  const taskLog = dailyFocusState?.taskLog || [];

  const contractTasks = useMemo(() => {
    const tasks: FocusTask[] = [];
    const today = new Date();

    const completedTodayCount = taskLog.filter((l: TaskLogEntry) => 
      l.action === 'completed' && 
      l.taskId.startsWith('contract-') && 
      isSameDay(parseISO(l.completedAt), today)
    ).length;

    const limit = Math.max(0, 3 - completedTodayCount);

    if (limit === 0) return [];

    postponedTasks.filter((t: FocusTask) => t.type === 'contract').forEach((task: FocusTask) => {
      if (!resolvedTasks.includes(task.id)) tasks.push(task);
    });

    contracts.forEach(contract => {
      if (contract.status === 'Pendente') {
        const taskId = `contract-${contract.id}`;
        if (!resolvedTasks.includes(taskId) && !postponedTasks.find((p: FocusTask) => p.id === taskId)) {
          const parsedDate = parseAnyDate(contract.createdAt) || new Date();
          const todayStart = startOfDay(today);
          const contractDateStart = startOfDay(parsedDate);
          const daysPending = differenceInDays(todayStart, contractDateStart);

          let elapsedText = '';
          if (daysPending <= 0) {
            elapsedText = 'Assinado hoje';
          } else if (daysPending === 1) {
            elapsedText = 'Pendente há 1 dia (ontem)';
          } else if (daysPending < 30) {
            elapsedText = `Pendente há ${daysPending} dias`;
          } else if (daysPending < 60) {
            const remainingDays = daysPending % 30;
            elapsedText = remainingDays === 0 ? 'Pendente há 1 mês' : `Pendente há 1 mês e ${remainingDays}d (${daysPending}d)`;
          } else {
            const months = Math.floor(daysPending / 30);
            const remainingDays = daysPending % 30;
            elapsedText = remainingDays === 0 ? `Pendente há ${months} meses` : `Pendente há ${months} meses e ${remainingDays}d (${daysPending}d)`;
          }

          const clientFullName = `${contract.firstName} ${contract.lastName}`.trim();
          const dateFormatted = format(parsedDate, 'dd/MM/yyyy');

          tasks.push({
            id: taskId,
            title: `Contrato Pendente - ${clientFullName}`,
            description: `Contrato assinado em ${dateFormatted} (${elapsedText}). Necessário protocolar/dar andamento.`,
            type: 'contract',
            priority: daysPending >= 15 ? 'high' : 'high',
            dueDate: contract.createdAt,
            clientId: contract.clientId,
            clientName: clientFullName,
            eventDateFormatted: dateFormatted,
            elapsedOrRemainingText: elapsedText,
            serviceType: contract.serviceType || 'Processo / Benefício',
            lawyerName: contract.lawyer ? (contract.lawyer === 'Michel' ? 'Dr. Michel' : 'Dra. Luana') : undefined,
            categoryBadge: 'Contrato Pendente'
          });
        }
      }
    });

    tasks.sort((a, b) => {
      const isPostponedA = postponedTasks.some((p: FocusTask) => p.id === a.id);
      const isPostponedB = postponedTasks.some((p: FocusTask) => p.id === b.id);
      if (isPostponedA && !isPostponedB) return -1;
      if (!isPostponedA && isPostponedB) return 1;
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      if (a.dueDate && b.dueDate) {
        const dateA = parseAnyDate(a.dueDate)?.getTime() || 0;
        const dateB = parseAnyDate(b.dueDate)?.getTime() || 0;
        return dateA - dateB;
      }
      return 0;
    });

    return tasks.slice(0, limit);
  }, [contracts, resolvedTasks, postponedTasks, taskLog]);

  const maintenanceTasks = useMemo(() => {
    const tasks: FocusTask[] = [];
    const today = new Date();

    const completedTodayCount = taskLog.filter((l: TaskLogEntry) => 
      l.action === 'completed' && 
      (l.taskId.startsWith('alert-') || l.taskId.startsWith('agenda-')) && 
      isSameDay(parseISO(l.completedAt), today)
    ).length;

    const limit = Math.max(0, 3 - completedTodayCount);

    if (limit === 0) return [];

    postponedTasks.filter((t: FocusTask) => t.type === 'alert').forEach((task: FocusTask) => {
      if (!resolvedTasks.includes(task.id)) tasks.push(task);
    });

    clients.forEach(client => {
      if (client.isArchived) return;

      const checkAlert = (dateStr: string | undefined, title: string, key: string) => {
        if (dateStr && isUrgentDate(dateStr)) {
          const taskId = `alert-${client.id}-${key}`;
          if (!resolvedTasks.includes(taskId) && !postponedTasks.find((p: FocusTask) => p.id === taskId)) {
            const parsedDate = parseAnyDate(dateStr);
            if (!parsedDate) return;

            const todayStart = startOfDay(today);
            const targetDateStart = startOfDay(parsedDate);
            const diffDays = differenceInDays(targetDateStart, todayStart);

            let timingText = '';
            if (diffDays === 0) {
              timingText = 'Vence Hoje';
            } else if (diffDays === 1) {
              timingText = 'Vence Amanhã';
            } else if (diffDays === -1) {
              timingText = 'Vencido ontem (1 dia)';
            } else if (diffDays < -1) {
              timingText = `Vencido há ${Math.abs(diffDays)} dias`;
            } else {
              timingText = `Vence em ${diffDays} dias`;
            }

            const dateFormatted = format(parsedDate, 'dd/MM/yyyy');

            tasks.push({
              id: taskId,
              title: `${title} - ${client.name}`,
              description: `Data do Prazo: ${dateFormatted} (${timingText})`,
              type: 'alert',
              priority: isBefore(parsedDate, startOfDay(today)) ? 'high' : 'medium',
              dueDate: parsedDate.toISOString(),
              clientId: client.id,
              clientName: client.name,
              originalAlertKey: key,
              eventDateFormatted: dateFormatted,
              elapsedOrRemainingText: timingText,
              serviceType: client.type || 'Benefício INSS',
              categoryBadge: title
            });
          }
        }
      };

      checkAlert(client.extensionDate, 'Prorrogação', 'extension');
      checkAlert(client.medExpertiseDate, 'Perícia Médica', 'medExpertise');
      checkAlert(client.socialExpertiseDate, 'Perícia Social', 'socialExpertise');
      checkAlert(client.dcbDate, 'DCB (Cessação)', 'dcb');
      checkAlert(client.ninetyDaysDate, 'Revisão 90 Dias', 'ninetyDays');
      checkAlert(client.securityMandateDate, 'Mandado de Segurança', 'securityMandate');
    });

    // Add Agenda Events for today or overdue
    events.forEach(event => {
      if (event.status === 'resolved' || event.status === 'cancelled') return;
      
      const eventDate = parseAnyDate(event.date) || new Date();
      if (isBefore(eventDate, startOfDay(today)) || isSameDay(eventDate, today)) {
        const taskId = `agenda-${event.id}`;
        if (!resolvedTasks.includes(taskId) && !postponedTasks.find((p: FocusTask) => p.id === taskId)) {
          const todayStart = startOfDay(today);
          const eventDateStart = startOfDay(eventDate);
          const diffDays = differenceInDays(eventDateStart, todayStart);

          let timingText = '';
          if (diffDays === 0) {
            timingText = 'Hoje';
          } else if (diffDays === 1) {
            timingText = 'Amanhã';
          } else if (diffDays === -1) {
            timingText = 'Ontem (Atrasado)';
          } else if (diffDays < -1) {
            timingText = `Atrasado há ${Math.abs(diffDays)} dias`;
          } else {
            timingText = `Em ${diffDays} dias`;
          }

          const eventTypeCap = event.type.charAt(0).toUpperCase() + event.type.slice(1);
          const dateFormatted = format(eventDate, 'dd/MM/yyyy');
          const timeStr = event.time || '09:00';
          const clientOrDesc = event.clientName || event.description || 'Compromisso';

          tasks.push({
            id: taskId,
            title: `Agenda: ${eventTypeCap} - ${clientOrDesc}`,
            description: `Data: ${dateFormatted} às ${timeStr} (${timingText})${event.location ? ` • Local: ${event.location}` : ''}`,
            type: 'alert',
            priority: isBefore(eventDate, startOfDay(today)) ? 'high' : 'medium',
            dueDate: event.date,
            clientId: event.clientId,
            clientName: event.clientName || event.description,
            eventDateFormatted: dateFormatted,
            eventTime: timeStr,
            elapsedOrRemainingText: timingText,
            location: event.location,
            serviceType: event.benefitType ? `Benefício: ${event.benefitType}` : undefined,
            categoryBadge: `Agenda (${eventTypeCap})`
          });
        }
      }
    });

    tasks.sort((a, b) => {
      const isPostponedA = postponedTasks.some((p: FocusTask) => p.id === a.id);
      const isPostponedB = postponedTasks.some((p: FocusTask) => p.id === b.id);
      if (isPostponedA && !isPostponedB) return -1;
      if (!isPostponedA && isPostponedB) return 1;
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      if (a.dueDate && b.dueDate) {
        const dateA = parseAnyDate(a.dueDate)?.getTime() || 0;
        const dateB = parseAnyDate(b.dueDate)?.getTime() || 0;
        return dateA - dateB;
      }
      return 0;
    });

    return tasks.slice(0, limit);
  }, [clients, events, resolvedTasks, postponedTasks, taskLog]);

  const handleAction = (task: FocusTask, action: 'completed' | 'discarded' | 'postponed') => {
    let newResolvedTasks = [...resolvedTasks];
    let newPostponedTasks = [...postponedTasks];
    let newTaskLog = [...taskLog];

    if (action === 'postponed') {
      const postponedTask: FocusTask = {
        ...task,
        priority: 'high',
        description: task.description.includes('Adiado') ? task.description : `Adiado. ${task.description}`
      };
      newPostponedTasks = [...newPostponedTasks.filter((p: FocusTask) => p.id !== task.id), postponedTask];
      
      const newLog: TaskLogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        taskId: task.id,
        title: task.title,
        action,
        completedAt: new Date().toISOString(),
        completedBy: `${user.firstName} ${user.lastName}`
      };
      newTaskLog = [newLog, ...newTaskLog].slice(0, 50);
    } else {
      newResolvedTasks = [...newResolvedTasks, task.id];
      newPostponedTasks = newPostponedTasks.filter((p: FocusTask) => p.id !== task.id);

      if (task.type === 'contract' && action === 'completed' && onUpdateContractStatus) {
        const contractId = task.id.replace('contract-', '');
        onUpdateContractStatus(contractId, 'Em Andamento');
      }

      const newLog: TaskLogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        taskId: task.id,
        title: task.title,
        action,
        completedAt: new Date().toISOString(),
        completedBy: `${user.firstName} ${user.lastName}`
      };
      newTaskLog = [newLog, ...newTaskLog].slice(0, 50);
    }

    if (onUpdateDailyFocus) {
      onUpdateDailyFocus({
        resolvedTasks: newResolvedTasks,
        postponedTasks: newPostponedTasks,
        taskLog: newTaskLog
      });
    }

    // Concluir aqui deve refletir no sininho, na agenda e na lista de clientes.
    // 'postponed' (adiar) não resolve nada; 'discarded' também encerra a pendência.
    if (action !== 'postponed' && onTaskResolved) {
      onTaskResolved(task);
    }
  };

  const renderEmptyState = (message: string) => {
    return (
      <div className={`p-6 rounded-2xl border text-center ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
          <SparklesIcon className="w-8 h-8" />
        </div>
        <h3 className={`text-lg font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
          Tudo em dia!
        </h3>
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {message}
        </p>
      </div>
    );
  };

  /**
   * Identidade visual por TIPO de compromisso.
   * Cada natureza (audiência, perícia, atendimento, prazo...) tem cor própria,
   * para reconhecer o compromisso antes mesmo de ler. `accent` pinta a barra
   * lateral e o rótulo; `chip` pinta o selo do tipo.
   */
  const getTaskVisual = (task: FocusTask) => {
    const badge = (task.categoryBadge || '').toLowerCase();
    const isAgenda = badge.includes('agenda');

    const map: { match: boolean; label: string; bar: string; text: string; chip: string; Icon: any }[] = [
      { match: task.type === 'contract',
        label: 'Contrato', bar: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300',
        chip: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/60', Icon: DocumentTextIcon },
      { match: badge.includes('audi'),
        label: isAgenda ? 'Audiência' : 'Audiência', bar: 'bg-rose-600', text: 'text-rose-700 dark:text-rose-300',
        chip: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/60', Icon: ExclamationCircleIcon },
      { match: badge.includes('perícia médica') || badge.includes('pericia medica') || badge.includes('perícia') && badge.includes('méd'),
        label: 'Perícia Médica', bar: 'bg-violet-600', text: 'text-violet-700 dark:text-violet-300',
        chip: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/60', Icon: SparklesIcon },
      { match: badge.includes('social'),
        label: 'Perícia Social', bar: 'bg-indigo-600', text: 'text-indigo-700 dark:text-indigo-300',
        chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800/60', Icon: SparklesIcon },
      { match: badge.includes('perícia') || badge.includes('pericia'),
        label: 'Perícia', bar: 'bg-violet-600', text: 'text-violet-700 dark:text-violet-300',
        chip: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/60', Icon: SparklesIcon },
      { match: badge.includes('atendimento'),
        label: 'Atendimento', bar: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-300',
        chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60', Icon: UserIcon },
      { match: badge.includes('prorroga'),
        label: 'Prorrogação', bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300',
        chip: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60', Icon: ClockIcon },
      { match: badge.includes('dcb') || badge.includes('cessa'),
        label: 'DCB / Cessação', bar: 'bg-orange-600', text: 'text-orange-700 dark:text-orange-300',
        chip: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-800/60', Icon: ExclamationCircleIcon },
      { match: badge.includes('90'),
        label: 'Revisão 90 Dias', bar: 'bg-teal-600', text: 'text-teal-700 dark:text-teal-300',
        chip: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-800/60', Icon: ClockIcon },
      { match: badge.includes('mandado'),
        label: 'Mandado de Segurança', bar: 'bg-fuchsia-600', text: 'text-fuchsia-700 dark:text-fuchsia-300',
        chip: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:ring-fuchsia-800/60', Icon: DocumentTextIcon },
      { match: badge.includes('reuni'),
        label: 'Reunião', bar: 'bg-cyan-600', text: 'text-cyan-700 dark:text-cyan-300',
        chip: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-800/60', Icon: UserIcon },
    ];

    const hit = map.find(m => m.match);
    if (hit) return hit;

    return isAgenda
      ? { label: 'Compromisso', bar: 'bg-bordeaux-700', text: 'text-bordeaux-800 dark:text-gold-300',
          chip: 'bg-bordeaux-50 text-bordeaux-800 ring-bordeaux-200 dark:bg-bordeaux-950/50 dark:text-gold-300 dark:ring-gold-500/25', Icon: CalendarIcon }
      : { label: 'Prazo', bar: 'bg-gold-500', text: 'text-gold-700 dark:text-gold-300',
          chip: 'bg-gold-50 text-gold-800 ring-gold-200 dark:bg-gold-950/40 dark:text-gold-300 dark:ring-gold-500/25', Icon: ExclamationCircleIcon };
  };

  const renderTaskGroup = (title: string, icon: string, tasks: FocusTask[], emptyMessage: string) => {
    return (
      <div className="mb-10">
        {/* Cabeçalho da seção */}
        <div className="flex items-end justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h2 className={`font-serif text-2xl font-bold tracking-tight leading-none ${darkMode ? 'text-cream-50' : 'text-bordeaux-900'}`}>
              {title}
            </h2>
            <div className="mt-2 h-px w-16 bg-gradient-to-r from-gold-500 to-transparent" />
          </div>
          <span className={`shrink-0 text-[11px] font-semibold tracking-wide px-3 py-1 rounded-full ring-1 ${
            darkMode ? 'bg-bordeaux-950/60 text-gold-300 ring-gold-500/25' : 'bg-cream-100 text-bordeaux-800 ring-bordeaux-200'
          }`}>
            {tasks.length} de 3
          </span>
        </div>

        {tasks.length === 0 ? (
          renderEmptyState(emptyMessage)
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tasks.map((task) => {
              const v = getTaskVisual(task);
              const atrasado = task.elapsedOrRemainingText?.includes('Atrasado') || task.elapsedOrRemainingText?.includes('Vencido');
              const hoje = task.elapsedOrRemainingText === 'Hoje' || task.elapsedOrRemainingText === 'Vence Hoje';
              const Icon = v.Icon;

              return (
                <div
                  key={task.id}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 ${
                    darkMode
                      ? 'bg-bordeaux-950/40 border-gold-500/15 hover:border-gold-500/35 shadow-lg shadow-black/20'
                      : 'bg-white border-cream-200 hover:border-gold-300 shadow-sm hover:shadow-lg hover:shadow-bordeaux-900/5'
                  }`}
                >
                  {/* Barra de cor: identifica o tipo num relance */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${v.bar}`} />

                  <div className="pl-5 pr-4 pt-4 pb-3 flex-1 flex flex-col">
                    {/* Tipo + urgência */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded-md ring-1 ${v.chip}`}>
                        <Icon className="w-3 h-3" />
                        {v.label}
                      </span>
                      {(atrasado || hoje) && (
                        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-md ${
                          atrasado
                            ? 'bg-red-600 text-white'
                            : 'bg-gold-500 text-bordeaux-950'
                        }`}>
                          {atrasado ? 'Atrasado' : 'Hoje'}
                        </span>
                      )}
                    </div>

                    {/* Nome do cliente — protagonista, SEM corte */}
                    <h3 className={`font-serif text-lg font-bold leading-tight break-words mb-3 ${
                      darkMode ? 'text-cream-50' : 'text-bordeaux-900'
                    }`}>
                      {task.clientName || task.title}
                    </h3>

                    {/* Dados essenciais */}
                    <div className="space-y-1.5 text-[13px] mb-4">
                      <div className={`flex items-baseline gap-2 ${darkMode ? 'text-cream-100/80' : 'text-slate-700'}`}>
                        <CalendarIcon className="w-3.5 h-3.5 shrink-0 translate-y-0.5 opacity-50" />
                        <span className="font-semibold tabular-nums">
                          {task.eventDateFormatted}
                          {task.eventTime && <span className="font-normal opacity-70"> · {task.eventTime}</span>}
                        </span>
                      </div>

                      {task.elapsedOrRemainingText && !atrasado && !hoje && (
                        <div className={`flex items-baseline gap-2 ${darkMode ? 'text-cream-100/55' : 'text-slate-500'}`}>
                          <ClockIcon className="w-3.5 h-3.5 shrink-0 translate-y-0.5 opacity-50" />
                          <span>{task.elapsedOrRemainingText}</span>
                        </div>
                      )}

                      {task.location && (
                        <div className={`flex items-baseline gap-2 ${darkMode ? 'text-cream-100/55' : 'text-slate-500'}`}>
                          <MapPinIcon className="w-3.5 h-3.5 shrink-0 translate-y-0.5 opacity-50" />
                          <span className="break-words">{task.location}</span>
                        </div>
                      )}

                      {task.serviceType && !task.location && (
                        <div className={`flex items-baseline gap-2 ${darkMode ? 'text-cream-100/55' : 'text-slate-500'}`}>
                          <TagIcon className="w-3.5 h-3.5 shrink-0 translate-y-0.5 opacity-50" />
                          <span className="break-words">{task.serviceType}</span>
                        </div>
                      )}

                      {task.type === 'contract' && task.lawyerName && (
                        <div className={`flex items-baseline gap-2 ${darkMode ? 'text-cream-100/55' : 'text-slate-500'}`}>
                          <UserIcon className="w-3.5 h-3.5 shrink-0 translate-y-0.5 opacity-50" />
                          <span>{task.lawyerName}</span>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className={`mt-auto flex items-center gap-1.5 pt-3 border-t ${
                      darkMode ? 'border-gold-500/12' : 'border-cream-200'
                    }`}>
                      <button
                        onClick={() => handleAction(task, 'completed')}
                        title="Marcar como concluído"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Feito
                      </button>
                      <button
                        onClick={() => handleAction(task, 'postponed')}
                        title="Adiar"
                        className={`inline-flex items-center justify-center p-2 rounded-lg transition active:scale-[0.98] ${
                          darkMode
                            ? 'text-gold-300 hover:bg-gold-500/12'
                            : 'text-amber-600 hover:bg-amber-50'
                        }`}
                      >
                        <ClockIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAction(task, 'discarded')}
                        title="Descartar — não é mais necessário"
                        className={`inline-flex items-center justify-center p-2 rounded-lg transition active:scale-[0.98] ${
                          darkMode
                            ? 'text-cream-100/40 hover:bg-white/5 hover:text-cream-100/70'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      {renderTaskGroup(
        "Processos Pendentes (Protocolos)",
        "📄",
        contractTasks,
        "Você não tem contratos pendentes para protocolar no momento."
      )}

      {renderTaskGroup(
        "Manutenção Periódica (Prazos)",
        "⏰",
        maintenanceTasks,
        "Você não tem alertas de manutenção de benefícios urgentes no momento."
      )}

      {/* Task Log (Optional view for recent completions) */}
      {taskLog.length > 0 && (
        <div className="mt-8">
          <h3 className={`text-sm font-bold mb-3 uppercase tracking-wider opacity-60 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            Últimas Ações
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">
            {taskLog.slice(0, 5).map((log: TaskLogEntry) => (
              <div key={log.id} className={`flex items-center justify-between p-2.5 rounded-lg text-xs ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-2">
                  {log.action === 'completed' ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XMarkIcon className="w-4 h-4 text-slate-400" />
                  )}
                  <span className={`font-medium truncate max-w-[200px] ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {log.title}
                  </span>
                </div>
                <div className={`text-[10px] flex items-center gap-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span>{log.completedBy}</span>
                  <span>•</span>
                  <span>{format(parseISO(log.completedAt), "dd/MM HH:mm")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
