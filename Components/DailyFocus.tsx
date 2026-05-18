import React, { useState, useEffect, useMemo } from 'react';
import { AgendaEvent, ClientRecord, ContractRecord, User } from '../types';
import { format, isBefore, startOfDay, addDays, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircleIcon, 
  XMarkIcon, 
  ClockIcon, 
  ExclamationCircleIcon,
  DocumentTextIcon,
  CalendarIcon,
  SparklesIcon
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
}

interface FocusTask {
  id: string;
  title: string;
  description: string;
  type: 'alert' | 'contract' | 'postponed';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  clientId?: string;
  clientName?: string;
  originalAlertKey?: string;
}

interface TaskLogEntry {
  id: string;
  taskId: string;
  title: string;
  action: 'completed' | 'discarded' | 'postponed';
  completedAt: string;
  completedBy: string;
}

export default function DailyFocus({ events, clients, contracts, user, darkMode, onUpdateContractStatus, dailyFocusState, onUpdateDailyFocus }: DailyFocusProps) {
  const resolvedTasks = dailyFocusState?.resolvedTasks || [];
  const postponedTasks = dailyFocusState?.postponedTasks || [];
  const taskLog = dailyFocusState?.taskLog || [];

  const contractTasks = useMemo(() => {
    let tasks: FocusTask[] = [];
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
          let parsedDate;
          try {
            parsedDate = parseISO(contract.createdAt);
            if (isNaN(parsedDate.getTime())) throw new Error("Invalid date");
          } catch (e) {
            parsedDate = new Date();
          }

          tasks.push({
            id: taskId,
            title: `Contrato Pendente - ${contract.firstName} ${contract.lastName}`,
            description: `Contrato assinado em ${format(parsedDate, 'dd/MM/yyyy')}. Necessário protocolar/dar andamento.`,
            type: 'contract',
            priority: 'high',
            dueDate: contract.createdAt,
            clientId: contract.clientId,
            clientName: `${contract.firstName} ${contract.lastName}`
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
      if (a.dueDate && b.dueDate) return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
      return 0;
    });

    return tasks.slice(0, limit);
  }, [contracts, resolvedTasks, postponedTasks, taskLog]);

  const maintenanceTasks = useMemo(() => {
    let tasks: FocusTask[] = [];
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
            let parsedDate = parseDate(dateStr);
            if (!parsedDate) return;

            tasks.push({
              id: taskId,
              title: `${title} - ${client.name}`,
              description: `Vencimento: ${format(parsedDate, 'dd/MM/yyyy')}`,
              type: 'alert',
              priority: isBefore(parsedDate, startOfDay(today)) ? 'high' : 'medium',
              dueDate: parsedDate.toISOString(),
              clientId: client.id,
              clientName: client.name,
              originalAlertKey: key
            });
          }
        }
      };

      checkAlert(client.extensionDate, 'Prorrogação', 'extension');
      checkAlert(client.medExpertiseDate, 'Perícia Médica', 'medExpertise');
      checkAlert(client.socialExpertiseDate, 'Perícia Social', 'socialExpertise');
      checkAlert(client.dcbDate, 'DCB', 'dcb');
      checkAlert(client.ninetyDaysDate, 'Revisão 90 Dias', 'ninetyDays');
      checkAlert(client.securityMandateDate, 'Mandado de Segurança', 'securityMandate');
    });

    // Add Agenda Events for today or overdue
    events.forEach(event => {
      if (event.status === 'resolved' || event.status === 'cancelled') return;
      
      const eventDate = parseISO(event.date);
      if (isBefore(eventDate, startOfDay(today)) || isSameDay(eventDate, today)) {
        const taskId = `agenda-${event.id}`;
        if (!resolvedTasks.includes(taskId) && !postponedTasks.find((p: FocusTask) => p.id === taskId)) {
          tasks.push({
            id: taskId,
            title: `Agenda: ${event.type.charAt(0).toUpperCase() + event.type.slice(1)}`,
            description: `${event.time} - ${event.clientName || event.description}`,
            type: 'alert',
            priority: isBefore(eventDate, startOfDay(today)) ? 'high' : 'medium',
            dueDate: event.date,
            clientId: event.clientId,
            clientName: event.clientName
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
      if (a.dueDate && b.dueDate) return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
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
          <span className="text-xs font-medium px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
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
                    ? 'bg-slate-800 border-slate-700 hover:border-primary-500/50' 
                    : 'bg-white border-slate-200 hover:border-primary-300'
                } ${task.priority === 'high' ? 'ring-1 ring-red-500/50' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${
                    task.type === 'alert' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                    task.type === 'contract' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                  }`}>
                    {task.type === 'alert' ? <ExclamationCircleIcon className="w-5 h-5" /> :
                     task.type === 'contract' ? <DocumentTextIcon className="w-5 h-5" /> :
                     <CalendarIcon className="w-5 h-5" />}
                  </div>
                  {task.priority === 'high' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                      Urgente
                    </span>
                  )}
                </div>
                
                <h3 className={`font-bold text-sm mb-1 line-clamp-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  {task.title}
                </h3>
                <p className={`text-xs mb-4 flex-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {task.description}
                </p>
                
                <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
                  <button 
                    onClick={() => handleAction(task, 'completed')}
                    title="Marcar como Concluído"
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
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
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
