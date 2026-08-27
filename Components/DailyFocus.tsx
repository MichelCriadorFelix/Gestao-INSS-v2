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

  const renderTaskGroup = (title: string, icon: string, tasks: FocusTask[], emptyMessage: string) => {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 p-1.5 rounded-lg">
              {icon}
            </span>
            {title}
          </h2>
          <span className="text-xs font-medium px-2.5 py-1 bg-slate-200 dark:bg-bordeaux-900/40 text-slate-600 dark:text-slate-300 rounded-full">
            {tasks.length} / 3 Tarefas
          </span>
        </div>

        {tasks.length === 0 ? (
          renderEmptyState(emptyMessage)
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`flex flex-col p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md ${
                  darkMode 
                    ? 'bg-slate-800/95 border-slate-700 hover:border-primary-500/50' 
                    : 'bg-white border-slate-200 hover:border-primary-300'
                } ${task.priority === 'high' ? 'ring-1 ring-red-500/50 dark:ring-red-500/40' : ''}`}
              >
                {/* Header: Icon + Category Badge + Priority */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                      task.type === 'contract' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                      task.categoryBadge?.includes('Perícia') ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                      task.categoryBadge?.includes('Atendimento') ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      task.categoryBadge?.includes('Audiência') ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {task.type === 'contract' ? <DocumentTextIcon className="w-4 h-4" /> :
                       task.categoryBadge?.includes('Perícia') ? <SparklesIcon className="w-4 h-4" /> :
                       task.categoryBadge?.includes('Agenda') ? <CalendarIcon className="w-4 h-4" /> :
                       <ExclamationCircleIcon className="w-4 h-4" />}
                    </div>
                    <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 truncate">
                      {task.categoryBadge || (task.type === 'contract' ? 'Contrato' : 'Prazo')}
                    </span>
                  </div>

                  {task.priority === 'high' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full shrink-0">
                      Urgente
                    </span>
                  )}
                </div>
                
                {/* Title */}
                <h3 className={`font-bold text-sm mb-2.5 leading-snug line-clamp-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {task.title}
                </h3>

                {/* Structured Metadata Box */}
                <div className={`p-2.5 rounded-xl text-xs space-y-1.5 mb-3 flex-1 ${
                  darkMode ? 'bg-slate-900/50 border border-slate-700/60' : 'bg-slate-50 border border-slate-100'
                }`}>
                  {/* Contrato Info */}
                  {task.type === 'contract' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5 opacity-70" /> Assinado em:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {task.eventDateFormatted || 'Data não informada'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5 opacity-70" /> Tempo:
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-[11px]">
                          {task.elapsedOrRemainingText || 'Pendente'}
                        </span>
                      </div>

                      {task.serviceType && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400 truncate">Serviço:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px] text-right">
                            {task.serviceType}
                          </span>
                        </div>
                      )}

                      {task.lawyerName && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Responsável:</span>
                          <span className="font-medium text-primary-600 dark:text-primary-400">
                            {task.lawyerName}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Prazos e Agenda Info */
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5 opacity-70" /> Data:
                        </span>
                        <span className="font-bold text-primary-700 dark:text-primary-300">
                          {task.eventDateFormatted} {task.eventTime ? `às ${task.eventTime}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5 opacity-70" /> Situação:
                        </span>
                        <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                          task.elapsedOrRemainingText?.includes('Atrasado') || task.elapsedOrRemainingText?.includes('Vencido')
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : task.elapsedOrRemainingText === 'Hoje' || task.elapsedOrRemainingText === 'Vence Hoje'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-bold'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {task.elapsedOrRemainingText || 'Pendente'}
                        </span>
                      </div>

                      {task.clientName && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <UserIcon className="w-3 h-3 opacity-70" /> Cliente:
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px] text-right">
                            {task.clientName}
                          </span>
                        </div>
                      )}

                      {task.location && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <TagIcon className="w-3 h-3 opacity-70" /> Local:
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px] text-right">
                            {task.location}
                          </span>
                        </div>
                      )}

                      {task.serviceType && !task.location && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Assunto:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px] text-right">
                            {task.serviceType}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-gold-500/15">
                  <button 
                    onClick={() => handleAction(task, 'completed')}
                    title="Marcar como Concluído / Protocolado"
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition-colors"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase">Feito</span>
                  </button>
                  <button 
                    onClick={() => handleAction(task, 'postponed')}
                    title="Adiar para Amanhã"
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 transition-colors"
                  >
                    <ClockIcon className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase">Adiar</span>
                  </button>
                  <button 
                    onClick={() => handleAction(task, 'discarded')}
                    title="Não é mais necessário"
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-bordeaux-900/40 dark:text-slate-400 dark:hover:bg-bordeaux-900/60 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase">Descartar</span>
                  </button>
                </div>
              </div>
            ))}
            
            {Array.from({ length: 3 - tasks.length }).map((_, i) => (
              <div key={`empty-${i}`} className={`flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed opacity-50 ${darkMode ? 'border-slate-600 bg-slate-800/30' : 'border-slate-300 bg-slate-50/50'}`}>
                <SparklesIcon className={`w-6 h-6 mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <p className={`text-xs text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Espaço livre para novas tarefas.
                </p>
              </div>
            ))}
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
