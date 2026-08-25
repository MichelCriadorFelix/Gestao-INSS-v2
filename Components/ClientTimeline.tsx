import React, { useState, useMemo } from 'react';
import { 
  ClientRecord, 
  ClientEventHistory, 
  AgendaEvent, 
  User 
} from '../types';
import { 
  CalendarIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  PlusIcon, 
  TrashIcon, 
  DocumentDuplicateIcon, 
  PrinterIcon, 
  SparklesIcon, 
  TagIcon, 
  MapPinIcon, 
  UserIcon, 
  DocumentTextIcon, 
  ChatBubbleLeftEllipsisIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface ClientTimelineProps {
  client: ClientRecord;
  agendaEvents?: AgendaEvent[];
  user?: User;
  onUpdateHistory: (updatedHistory: ClientEventHistory[]) => void;
  onSaveClientDirectly?: (updatedClient: ClientRecord) => void;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; badgeColor: string }> = {
  'perícia_médica': {
    label: 'Perícia Médica',
    icon: '🩺',
    color: 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300',
    badgeColor: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
  },
  'perícia_social': {
    label: 'Avaliação Social / Perícia',
    icon: '👥',
    color: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
  },
  'audiência': {
    label: 'Audiência Judicial',
    icon: '⚖️',
    color: 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300',
    badgeColor: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
  },
  'prorrogação': {
    label: 'Prorrogação INSS',
    icon: '🔄',
    color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  },
  'dcb': {
    label: 'DCB (Cessação do Benefício)',
    icon: '🛑',
    color: 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300',
    badgeColor: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
  },
  '90_dias': {
    label: 'Prazo 90 Dias (Revisão)',
    icon: '⏳',
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
    badgeColor: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
  },
  'mandado_segurança': {
    label: 'Mandado de Segurança',
    icon: '📜',
    color: 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300',
    badgeColor: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
  },
  'atendimento': {
    label: 'Atendimento / Contato',
    icon: '💬',
    color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
    badgeColor: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
  },
  'cadastro': {
    label: 'Início / Cadastro do Processo',
    icon: '📁',
    color: 'border-slate-500 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-700 dark:text-slate-300',
    badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  },
  'observação': {
    label: 'Ocorrência / Andamento',
    icon: '📝',
    color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  },
  'outro': {
    label: 'Outro Evento',
    icon: '📌',
    color: 'border-slate-400 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-700 dark:text-slate-300',
    badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  }
};

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  'concluído': { label: 'Concluído / Realizado', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
  'remarcado': { label: 'Remarcado (Data Nova)', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800' },
  'pendente': { label: 'Pendente / Agendado', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
  'cancelado': { label: 'Cancelado', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800' },
  'registrado': { label: 'Registrado no Caso', bg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700' }
};

export const ClientTimeline: React.FC<ClientTimelineProps> = ({
  client,
  agendaEvents = [],
  user,
  onUpdateHistory,
  onSaveClientDirectly
}) => {
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Form State para nova ocorrência
  const [formData, setFormData] = useState<Partial<ClientEventHistory>>({
    eventType: 'observação',
    title: '',
    date: new Date().toLocaleDateString('pt-BR'),
    time: '',
    location: '',
    status: 'concluído',
    notes: ''
  });

  // Lista unificada e enriquecida de fatos e eventos do cliente (sem poluição)
  const timelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      source: 'manual' | 'field' | 'agenda';
      eventType: string;
      title: string;
      date: string;
      time?: string;
      location?: string;
      status: string;
      notes?: string;
      performedBy?: string;
      createdAt: string;
      isCurrentActive?: boolean;
    }> = [];

    // 1. Histórico explícito persistido no cliente
    if (client.eventHistory && Array.isArray(client.eventHistory)) {
      client.eventHistory.forEach(h => {
        if (!h.title && !h.notes && !h.date) return;
        items.push({
          id: h.id,
          source: 'manual',
          eventType: h.eventType || 'observação',
          title: h.title || 'Ocorrência Registrada',
          date: h.date || '',
          time: h.time || '',
          location: h.location || '',
          status: h.status || 'registrado',
          notes: h.notes || '',
          performedBy: h.performedBy || '',
          createdAt: h.createdAt || new Date().toISOString()
        });
      });
    }

    // 2. Eventos da Agenda vinculados a este cliente
    const clientAgendaEvents = agendaEvents.filter(e => e.clientId === client.id);
    clientAgendaEvents.forEach(e => {
      // Verifica se já não existe no histórico pelo id ou timestamp
      const exists = items.some(item => item.id === `hist-${e.id}` || item.id === e.id);
      if (!exists && e.date) {
        let evType = 'outro';
        if (e.type === 'perícia') {
          evType = e.description?.toLowerCase().includes('social') ? 'perícia_social' : 'perícia_médica';
        } else if (e.type === 'audiência') {
          evType = 'audiência';
        } else if (e.type === 'prazo') {
          if (e.description?.toLowerCase().includes('prorrogação')) evType = 'prorrogação';
          else if (e.description?.toLowerCase().includes('mandado')) evType = 'mandado_segurança';
          else if (e.description?.toLowerCase().includes('dcb')) evType = 'dcb';
          else if (e.description?.toLowerCase().includes('90')) evType = '90_dias';
          else evType = 'observação';
        } else if (e.type === 'atendimento') {
          evType = 'atendimento';
        }

        const dateFormatted = e.date.includes('-') 
          ? e.date.split('-').reverse().join('/') 
          : e.date;

        items.push({
          id: `agenda-${e.id}`,
          source: 'agenda',
          eventType: evType,
          title: e.description || (e.type ? e.type.toUpperCase() : 'Compromisso'),
          date: dateFormatted,
          time: e.time || '',
          location: e.location || '',
          status: e.status === 'resolved' ? 'concluído' : e.status === 'cancelled' ? 'cancelado' : 'pendente',
          notes: e.resolutionNote || '',
          performedBy: e.resolvedBy || '',
          createdAt: e.resolvedAt || e.date
        });
      }
    });

    // 3. Campos ativos do cadastro do cliente (somente se preenchidos!)
    const addActiveField = (dateVal: string | undefined, evType: string, defaultTitle: string) => {
      if (!dateVal || dateVal.trim() === '' || dateVal === '-') return;
      
      const formattedDate = dateVal.includes('-') && dateVal.length === 10
        ? dateVal.split('-').reverse().join('/')
        : dateVal;

      // Se já houver um registro com a mesma data e mesmo tipo de evento, não duplica
      const alreadyHasExact = items.some(item => item.eventType === evType && item.date === formattedDate);
      if (!alreadyHasExact) {
        items.push({
          id: `field-${evType}-${formattedDate}`,
          source: 'field',
          eventType: evType,
          title: defaultTitle,
          date: formattedDate,
          status: 'pendente',
          notes: 'Registrado nos dados atuais do cliente',
          createdAt: new Date().toISOString(),
          isCurrentActive: true
        });
      }
    };

    addActiveField(client.medExpertiseDate, 'perícia_médica', 'Perícia Médica Agendada');
    addActiveField(client.socialExpertiseDate, 'perícia_social', 'Perícia Social / Avaliação Agendada');
    addActiveField(client.extensionDate, 'prorrogação', 'Prorrogação Requerida / Prazo');
    addActiveField(client.dcbDate, 'dcb', 'Data de Cessação do Benefício (DCB)');
    addActiveField(client.ninetyDaysDate, '90_dias', 'Prazo de 90 Dias (Revisão)');
    addActiveField(client.securityMandateDate, 'mandado_segurança', 'Mandado de Segurança / Prazo Liminar');
    
    if (client.der && client.der.trim() !== '' && client.der !== '-') {
      const derFormatted = client.der.includes('-') ? client.der.split('-').reverse().join('/') : client.der;
      if (!items.some(i => i.eventType === 'cadastro' && i.date === derFormatted)) {
        items.push({
          id: `field-der-${derFormatted}`,
          source: 'field',
          eventType: 'cadastro',
          title: `Data de Entrada do Requerimento (DER)`,
          date: derFormatted,
          status: 'registrado',
          notes: `DER oficial protocolada: ${derFormatted}`,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Ordenar cronologicamente do mais recente para o mais antigo
    return items.sort((a, b) => {
      const parseItemDate = (str: string) => {
        if (!str) return 0;
        if (str.includes('/')) {
          const [d, m, y] = str.split('/').map(Number);
          return new Date(y, m - 1, d).getTime() || 0;
        }
        if (str.includes('-')) {
          return new Date(str).getTime() || 0;
        }
        return 0;
      };

      const timeA = parseItemDate(a.date) || new Date(a.createdAt).getTime() || 0;
      const timeB = parseItemDate(b.date) || new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [client, agendaEvents]);

  const handleSaveNewEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title && !formData.notes) return;

    const newEntry: ClientEventHistory = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      clientId: client.id,
      eventType: formData.eventType as any || 'observação',
      title: formData.title || EVENT_TYPE_CONFIG[formData.eventType || 'observação']?.label || 'Ocorrência',
      date: formData.date || new Date().toLocaleDateString('pt-BR'),
      time: formData.time || '',
      location: formData.location || '',
      status: (formData.status as any) || 'concluído',
      notes: formData.notes || '',
      performedBy: user ? `${user.firstName} ${user.lastName}` : 'Advogado',
      createdAt: new Date().toISOString()
    };

    const currentHistory = client.eventHistory ? [...client.eventHistory] : [];
    const updatedHistory = [newEntry, ...currentHistory];

    onUpdateHistory(updatedHistory);

    if (onSaveClientDirectly) {
      onSaveClientDirectly({
        ...client,
        eventHistory: updatedHistory
      });
    }

    // Limpar form
    setFormData({
      eventType: 'observação',
      title: '',
      date: new Date().toLocaleDateString('pt-BR'),
      time: '',
      location: '',
      status: 'concluído',
      notes: ''
    });
    setIsAddingEvent(false);
  };

  const handleDeleteHistoryItem = (id: string) => {
    if (!confirm('Deseja realmente remover esta ocorrência do histórico?')) return;
    
    const currentHistory = client.eventHistory ? [...client.eventHistory] : [];
    const updatedHistory = currentHistory.filter(h => h.id !== id);

    onUpdateHistory(updatedHistory);
    if (onSaveClientDirectly) {
      onSaveClientDirectly({
        ...client,
        eventHistory: updatedHistory
      });
    }
  };

  const handleCopyReport = () => {
    const header = `=== RELATÓRIO DO PROCESSO & HISTÓRICO DO CLIENTE ===\n`;
    const clientHeader = `Cliente: ${client.name}\nCPF: ${client.cpf || 'Não informado'}\nTipo: ${client.type || 'Cliente'}\nData de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n\n`;

    let body = `--- HISTÓRICO DE OCORRÊNCIAS & FATOS DO CASO ---\n\n`;
    
    if (timelineItems.length === 0) {
      body += `Nenhuma ocorrência registrada até o momento.\n`;
    } else {
      timelineItems.forEach((item, index) => {
        body += `${index + 1}. [${item.date || 'Data N/D'}${item.time ? ` às ${item.time}` : ''}] ${item.title.toUpperCase()}\n`;
        body += `   • Categoria: ${EVENT_TYPE_CONFIG[item.eventType]?.label || item.eventType}\n`;
        body += `   • Status: ${STATUS_CONFIG[item.status]?.label || item.status}\n`;
        if (item.location) body += `   • Local: ${item.location}\n`;
        if (item.notes) body += `   • O que aconteceu: ${item.notes}\n`;
        if (item.performedBy) body += `   • Registrado por: ${item.performedBy}\n`;
        body += `\n`;
      });
    }

    const footer = `\nEscritório Felix & Castro Advocacia Previdenciária e Trabalhista\n`;
    const fullText = header + clientHeader + body + footer;

    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 3000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-bordeaux-900/40 p-4 rounded-2xl border border-slate-200 dark:border-gold-500/20">
        <div>
          <h4 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
            <span>Linha do Tempo & Histórico do Caso</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold border border-primary-200 dark:border-primary-800">
              {timelineItems.length} {timelineItems.length === 1 ? 'fato registrado' : 'fatos registrados'}
            </span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registro cronológico das perícias, audiências, prorrogações e ocorrências de <strong>{client.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleCopyReport}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-gold-500/20 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-bordeaux-900/60 transition shadow-sm"
            title="Copiar relatório completo de fatos do cliente"
          >
            {copiedNotification ? (
              <>
                <CheckIcon className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <DocumentDuplicateIcon className="w-4 h-4 text-slate-500" />
                <span>Copiar Relatório</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAddingEvent(!isAddingEvent)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-600/20 transition"
          >
            {isAddingEvent ? (
              <>
                <XMarkIcon className="w-4 h-4" />
                <span>Fechar</span>
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                <span>+ Registrar Fato / Ocorrência</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Formulário para Inserção Rápida de Ocorrência */}
      {isAddingEvent && (
        <form onSubmit={handleSaveNewEvent} className="bg-white dark:bg-bordeaux-950/60 p-5 rounded-2xl border-2 border-primary-500/30 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-gold-500/20 pb-3">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-primary-500" />
              <h5 className="text-sm font-bold text-slate-800 dark:text-white">Novo Fato / Ocorrência no Processo</h5>
            </div>
            <span className="text-xs text-slate-400">Preencha os dados do acontecimento</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Tipo do Evento
              </label>
              <select
                value={formData.eventType}
                onChange={e => setFormData({ ...formData, eventType: e.target.value as any })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-gold-500/20 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
              >
                <option value="perícia_médica">🩺 Perícia Médica</option>
                <option value="perícia_social">👥 Avaliação Social / Perícia</option>
                <option value="audiência">⚖️ Audiência Judicial</option>
                <option value="prorrogação">🔄 Prorrogação Requerida</option>
                <option value="dcb">🛑 DCB (Cessação do Benefício)</option>
                <option value="90_dias">⏳ Prazo de 90 Dias (Revisão)</option>
                <option value="mandado_segurança">📜 Mandado de Segurança</option>
                <option value="atendimento">💬 Atendimento / Contato com Cliente</option>
                <option value="observação">📝 Ocorrência / Andamento do Processo</option>
                <option value="outro">📌 Outro Evento</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Título / Descrição Curta
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Perícia realizada, aguardando laudo"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-gold-500/20 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Data do Fato / Evento
              </label>
              <input
                type="text"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                placeholder="DD/MM/AAAA"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-gold-500/20 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Horário (Opcional)
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-gold-500/20 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Local / Vara / Agência (Opcional)
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: APS Santos Dumont ou 2ª Vara Federal"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-gold-500/20 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Status da Ocorrência
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-gold-500/20 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
              >
                <option value="concluído">✅ Concluído / Realizado</option>
                <option value="remarcado">🔄 Remarcado (Data Nova)</option>
                <option value="pendente">⏳ Pendente / Agendado</option>
                <option value="cancelado">❌ Cancelado</option>
                <option value="registrado">📋 Registrado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              O que aconteceu? (Detalhes, Ata, Laudos, Resumo)
            </label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Descreva o que ocorreu com o cliente neste fato. Ex: O cliente compareceu pontualmente à perícia, o perito avaliou os exames de imagem e solicitou nova documentação..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-gold-500/20 bg-slate-50 dark:bg-bordeaux-900/40 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingEvent(false)}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-gold-500/20 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-bordeaux-900/40 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
            >
              <CheckIcon className="w-4 h-4" />
              Salvar Ocorrência
            </button>
          </div>
        </form>
      )}

      {/* Linha do Tempo Visual */}
      {timelineItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-bordeaux-900/20 rounded-2xl border border-dashed border-slate-300 dark:border-gold-500/20 text-center">
          <CalendarIcon className="w-12 h-12 text-slate-400 mb-3 opacity-60" />
          <h5 className="font-bold text-sm text-slate-700 dark:text-slate-200">Nenhum evento registrado ainda</h5>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            À medida que perícias forem agendadas, concluídas ou remarcadas, o histórico aparecerá aqui de forma limpa e organizada.
          </p>
          <button
            type="button"
            onClick={() => setIsAddingEvent(true)}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition shadow-sm"
          >
            + Registrar Primeiro Fato
          </button>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-gold-500/20">
          {timelineItems.map((item, idx) => {
            const config = EVENT_TYPE_CONFIG[item.eventType] || EVENT_TYPE_CONFIG['outro'];
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG['registrado'];

            return (
              <div 
                key={item.id || idx}
                className="relative group transition-all"
              >
                {/* Marcador do Ponto na Linha do Tempo */}
                <div className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full border-2 bg-white dark:bg-bordeaux-950 flex items-center justify-center text-xs shadow-sm z-10 ${config.color}`}>
                  <span>{config.icon}</span>
                </div>

                {/* Card do Evento */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  item.isCurrentActive 
                    ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 shadow-sm' 
                    : 'bg-white dark:bg-bordeaux-900/40 border-slate-200 dark:border-gold-500/15 hover:border-slate-300 dark:hover:border-gold-500/30'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-gold-500/10 pb-2.5 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${config.badgeColor}`}>
                        {config.label}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
                        {statusConfig.label}
                      </span>

                      {item.isCurrentActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          Data Ativa no Cadastro
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.date || 'Data a definir'}</span>
                      </div>
                      {item.time && (
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <ClockIcon className="w-3.5 h-3.5 opacity-70" />
                          <span>{item.time}</span>
                        </div>
                      )}
                      
                      {item.source === 'manual' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded transition"
                          title="Remover ocorrência"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-bold text-sm text-slate-800 dark:text-white">
                      {item.title}
                    </h5>

                    {item.location && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span><strong>Local:</strong> {item.location}</span>
                      </p>
                    )}

                    {item.notes && (
                      <div className="p-3 bg-slate-50 dark:bg-bordeaux-950/40 rounded-xl border border-slate-100 dark:border-gold-500/10 text-xs text-slate-700 dark:text-slate-200">
                        <p className="font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                          <ChatBubbleLeftEllipsisIcon className="w-3 h-3" />
                          O que aconteceu / Observação:
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {item.notes}
                        </p>
                      </div>
                    )}

                    {item.performedBy && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 italic pt-1">
                        <UserIcon className="w-3 h-3" />
                        <span>Registrado por: <strong>{item.performedBy}</strong></span>
                      </div>
                    )}
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

export default ClientTimeline;
