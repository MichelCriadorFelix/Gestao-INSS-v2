import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  ScaleIcon, UserGroupIcon, BriefcaseIcon, CalculatorIcon, ArrowRightOnRectangleIcon, 
  ArrowPathRoundedSquareIcon, CloudIcon, BellIcon, Cog6ToothIcon, SunIcon, MoonIcon,
  ArchiveBoxIcon, MagnifyingGlassIcon, PlusIcon, StarIcon, ArrowUturnLeftIcon, ArrowPathIcon, 
  PencilSquareIcon, TrashIcon, ExclamationTriangleIcon, ChevronUpIcon, ChevronDownIcon, 
  ChevronLeftIcon, ChevronRightIcon, CalendarIcon, CheckIcon, BookOpenIcon,
  GlobeAltIcon, AcademicCapIcon, SparklesIcon, Bars3Icon, XMarkIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

// Lazy load large view components to reduce initial bundle size
const Legislation = lazy(() => import('./Legislation'));
const Jurisprudence = lazy(() => import('./Jurisprudence'));
const LaborCalc = lazy(() => import('../LaborCalc'));
const SocialSecurityCalc = lazy(() => import('../SocialSecurityCalc'));
const DrMichelFelix = lazy(() => import('./DrMichelFelix'));
const DraLuanaCastro = lazy(() => import('./DraLuanaCastro'));
const DrFelixECastro = lazy(() => import('./DrFelixECastro'));
const PersonaChat = lazy(() => import('./PersonaChat'));
import { MICHEL_PERSONA } from './personaConfig';
const SecFabriciaFelix = lazy(() => import('./SecFabriciaFelix'));
const Agenda = lazy(() => import('./Agenda'));
const PetitionEditor = lazy(() => import('./PetitionEditor'));
const MeuINSS = lazy(() => import('./MeuINSS'));
const KnowledgeBase = lazy(() => import('./KnowledgeBase'));
const MarketingGenerator = lazy(() => import('./MarketingGenerator'));

import { DashboardProps, ClientRecord, ContractRecord, NotificationItem, AgendaEvent, DailyFocusState } from '../types';
import type { CalculationRecord } from '../LaborCalc';
import type { SocialSecurityData } from '../SocialSecurityCalc';

import LZString from 'lz-string';
import { initSupabase } from '../supabaseClient';
import { supabaseService } from '../services/supabaseService';

export interface SocialSecurityCalculationRecord {
    id: string;
    date: string;
    clientName: string;
    data: SocialSecurityData;
}
import { isUrgentDate, formatCurrency, parseDate, isOverdueDate } from '../utils';
import { parseISO, differenceInDays, startOfDay, format } from 'date-fns';
import StatsCards from './StatsCards';
import ReferralModal from './ReferralModal';
import FinancialStats from './FinancialStats';
import RecordModal from './RecordModal';
import ContractModal from './ContractModal';
import AgendaModal from './AgendaModal';
import SettingsModal from './SettingsModal';
import NotificationsModal from './NotificationsModal';
import CopyButton from './CopyButton';
import { safeSetLocalStorage } from '../utils';

export default function Dashboard({ 
  user, 
  onLogout, 
  darkMode, 
  toggleDarkMode, 
  onOpenSettings, 
  isCloudConfigured,
  isSettingsOpen,
  onCloseSettings,
  onSettingsSaved,
  onRestoreBackup
}: DashboardProps) {
  const [currentView, setCurrentView] = useState<'clients' | 'contracts' | 'labor_calc' | 'social_calc' | 'dr_michel' | 'dra_luana' | 'dr_felix_castro' | 'sec_fabricia' | 'agenda' | 'petition_editor' | 'legislation' | 'jurisprudence' | 'meu_inss' | 'knowledge_base' | 'marketing'>('agenda');
  const [clientFilter, setClientFilter] = useState<'active' | 'archived' | 'referral'>('active');

  const handleClientFilterChange = (filter: 'active' | 'archived' | 'referral') => {
    setClientFilter(filter);
    setCurrentPage(1);
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [savedCalculations, setSavedCalculations] = useState<CalculationRecord[]>([]);
  const [savedSocialCalculations, setSavedSocialCalculations] = useState<SocialSecurityCalculationRecord[]>([]);
  const [drMichelSessions, setDrMichelSessions] = useState<any[]>([]);
  const [draLuanaSessions, setDraLuanaSessions] = useState<any[]>([]);
  const [drFelixCastroSessions, setDrFelixCastroSessions] = useState<any[]>([]);
  const [secFabriciaSessions, setSecFabriciaSessions] = useState<any[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<string[]>([]);
  const [customLaws, setCustomLaws] = useState<any[]>([]);
  const [dailyFocusState, setDailyFocusState] = useState<any>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ClientRecord | null>(null);
  
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [currentContract, setCurrentContract] = useState<ContractRecord | null>(null);
  
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<AgendaEvent | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedType, setLastSavedType] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activePetition, setActivePetition] = useState<any>(null);
  const [activePetitionClientId, setActivePetitionClientId] = useState<string | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleEditClient = async (record: ClientRecord) => {
    setIsFetchingDetails(true);
    try {
        const fullDetails = await supabaseService.getClientDetails(record.id);
        if (fullDetails) {
            setCurrentRecord(fullDetails);
            // Cache full details in records list to avoid re-fetching in other places
            setRecords(prev => prev.map(r => r.id === record.id ? fullDetails : r));
        } else {
            setCurrentRecord(record);
        }
        setIsModalOpen(true);
    } catch (err) {
        console.error("Error fetching client details:", err);
        setCurrentRecord(record);
        setIsModalOpen(true);
    } finally {
        setIsFetchingDetails(false);
    }
  };

  // --- Realtime & Data Fetching Logic ---
    const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    const supabase = initSupabase();

    try {
        const [remoteClients, remoteContracts] = await Promise.all([
            supabaseService.getClients(),
            supabaseService.getContracts()
        ]);

        setRecords(remoteClients || []);
        setContracts(remoteContracts || []);

        const remoteCalculations = await supabaseService.getLaborCalculations().catch(() => []);
        setSavedCalculations(remoteCalculations || []);

        setResolvedAlerts([]);

        const [remoteSocial, remoteMichel, remoteLuana, remoteFelixCastro, remoteFabricia] = await Promise.all([
            supabaseService.getCalculations().catch(() => []),
            supabaseService.getAIConversations('michel').catch(() => []),
            supabaseService.getAIConversations('luana').catch(() => []),
            supabaseService.getAIConversations('felix_castro').catch(() => []),
            supabaseService.getAIConversations('fabricia').catch(() => [])
        ]);

        setSavedSocialCalculations(remoteSocial || []);
        setDrMichelSessions(remoteMichel || []);
        setDraLuanaSessions(remoteLuana || []);
        setDrFelixCastroSessions(remoteFelixCastro || []);
        setSecFabriciaSessions(remoteFabricia || []);

        // Fetch global data from 'clients' table (used as KV store)
        if (supabase) {
          const { data: globalData, error: globalError } = await supabase
            .from('clients')
            .select('id, data')
            .in('id', [7, 8, 9, 10]);

        if (!globalError && globalData) {
            const agenda = globalData.find(d => d.id === 7)?.data;
            if (agenda) setAgendaEvents(agenda);
            else {
                const localAgenda = localStorage.getItem('agenda_events');
                if (localAgenda) setAgendaEvents(JSON.parse(localAgenda));
            }
            
            const resolved = globalData.find(d => d.id === 8)?.data;
            if (resolved) setResolvedAlerts(resolved);
            else {
                const localResolved = localStorage.getItem('inss_resolved_alerts');
                if (localResolved) setResolvedAlerts(JSON.parse(localResolved));
            }

            const laws = globalData.find(d => d.id === 9)?.data;
            if (laws) setCustomLaws(laws);
            else {
                const localLaws = localStorage.getItem('custom_laws');
                if (localLaws) setCustomLaws(JSON.parse(localLaws));
            }

            const focusState = globalData.find(d => d.id === 10)?.data;
            if (focusState) setDailyFocusState(focusState);
            else {
                const localFocus = localStorage.getItem('daily_focus_state');
                if (localFocus) setDailyFocusState(JSON.parse(localFocus));
            }
        }
    } else {
            // Fallback to local storage if global fetch fails or no data in cloud
            const localAgenda = localStorage.getItem('agenda_events');
            if (localAgenda) setAgendaEvents(JSON.parse(localAgenda));
            
            const localResolved = localStorage.getItem('inss_resolved_alerts');
            if (localResolved) setResolvedAlerts(JSON.parse(localResolved));

            const localLaws = localStorage.getItem('custom_laws');
            if (localLaws) setCustomLaws(JSON.parse(localLaws));

            const localFocus = localStorage.getItem('daily_focus_state');
            if (localFocus) setDailyFocusState(JSON.parse(localFocus));
        }

        setIsLoading(false);
    } catch (err: any) {
        console.error("Exception in fetchData:", err);
        setIsLoading(false);
        
        let errorMessage = "Erro de carregamento. Usando dados locais.";
        if (err.message?.includes('fetch') || err.message?.includes('Falha ao buscar')) {
            errorMessage = "⚠️ Erro de Conexão com a Nuvem. Verifique se o projeto Supabase está ativo ou se as chaves nas Configurações estão corretas.";
        }
        
        setDbError(errorMessage);
    }
  };

  // Setup Realtime Subscription
  useEffect(() => {
    fetchData();

    const supabase = initSupabase();
    if (supabase) {
        const channel = supabase.channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'clients_v2'
                },
                async (_payload: any) => {
                    try {
                        const updated = await supabaseService.getClients();
                        setRecords(updated);
                    } catch (e) {
                        console.error('Realtime clients_v2 error', e);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'clients' },
                (payload: any) => {
                    if (payload.new?.id === 8 && Array.isArray(payload.new?.data)) {
                        setResolvedAlerts(payload.new.data);
                        safeSetLocalStorage('inss_resolved_alerts', JSON.stringify(payload.new.data));
                    }
                    if (payload.new?.id === 7) {
                        let newAgenda = payload.new.data;
                        if (typeof newAgenda === 'string') {
                            try {
                                const d = LZString.decompressFromUTF16(newAgenda);
                                newAgenda = d ? JSON.parse(d) : JSON.parse(newAgenda);
                            } catch(e) {}
                        }
                        if (Array.isArray(newAgenda)) {
                            setAgendaEvents(newAgenda);
                            safeSetLocalStorage('agenda_events', JSON.stringify(newAgenda));
                        }
                    }
                }
            )
            // Removed ai_conversations subscription to prevent read loops and high I/O
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'social_security_calculations' },
                () => fetchData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'labor_calculations' },
                () => fetchData()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [isCloudConfigured]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, currentView, clientFilter]);

  const handleSaveCustomLaws = (newLaws: any[]) => {
    setCustomLaws(newLaws);
    safeSetLocalStorage('custom_laws', JSON.stringify(newLaws));
    if (isCloudConfigured) {
        const supabase = initSupabase();
        if (supabase) {
            supabase.from('clients').upsert({ id: 9, data: newLaws }).then(({ error }) => {
                if (error) console.error("Error syncing laws:", error);
            });
        }
    }
  };

  // Compute Alerts
  const activeAlerts = useMemo(() => {
      const alerts: NotificationItem[] = [];
      const today = startOfDay(new Date());

      records.forEach(r => {
          if (r.isArchived) return; // Ignorar arquivados
          
          const checkDate = (dateStr: string, type: string, suffix: string) => {
              if (isUrgentDate(dateStr)) {
                  const id = r.id + suffix;
                  if (resolvedAlerts.includes(id)) return;
                  alerts.push({ id, clientName: r.name, type, date: dateStr });
              }
          };

          checkDate(r.extensionDate, 'Prorrogação', '_ext');
          checkDate(r.medExpertiseDate, 'Perícia Médica', '_med');
          checkDate(r.socialExpertiseDate, 'Perícia Social', '_soc');
          checkDate(r.securityMandateDate, 'Mandado de Segurança', '_mand');
      });

      agendaEvents.forEach(e => {
          if (resolvedAlerts.includes(e.id)) return;
          const eventDate = parseISO(e.date);
          const diffDays = differenceInDays(eventDate, today);
          if (diffDays <= 15) {
              const typeLabel = e.type.charAt(0).toUpperCase() + e.type.slice(1);
              const dateParts = e.date.split('-');
              const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
              alerts.push({ 
                  id: e.id, 
                  clientName: e.clientName || 'Evento sem cliente', 
                  type: `Agenda: ${typeLabel} às ${e.time}`, 
                  date: formattedDate 
              });
          }
      });

      // Sorting: Overdue first, then by date proximity
      return alerts.sort((a, b) => {
          const dateA = a.date.includes('/') ? 
            new Date(parseInt(a.date.split('/')[2]), parseInt(a.date.split('/')[1]) - 1, parseInt(a.date.split('/')[0])) : 
            new Date();
          const dateB = b.date.includes('/') ? 
            new Date(parseInt(b.date.split('/')[2]), parseInt(b.date.split('/')[1]) - 1, parseInt(b.date.split('/')[0])) : 
            new Date();

          const diffA = differenceInDays(dateA, today);
          const diffB = differenceInDays(dateB, today);

          // Both overdue
          if (diffA < 0 && diffB < 0) return diffA - diffB; // Most overdue first? Or closest to today? User said "vencido" first.
          // A overdue, B not
          if (diffA < 0 && diffB >= 0) return -1;
          // B overdue, A not
          if (diffB < 0 && diffA >= 0) return 1;
          
          // Both upcoming
          return diffA - diffB;
      });
  }, [records, agendaEvents, resolvedAlerts]);

  const handleResolveAlert = (id: string, skipAgendaUpdate: boolean = false) => {
      const updated = [...resolvedAlerts, id];
      saveData('resolved_alerts', updated);

      if (skipAgendaUpdate) return;

      // Also mark the corresponding virtual event as resolved
      let fieldKey = '';
      let clientId = '';
      if (id.endsWith('_med')) { fieldKey = 'medExpertiseDate'; clientId = id.slice(0, -4); }
      else if (id.endsWith('_soc')) { fieldKey = 'socialExpertiseDate'; clientId = id.slice(0, -4); }
      else if (id.endsWith('_ext')) { fieldKey = 'extensionDate'; clientId = id.slice(0, -4); }
      else if (id.endsWith('_mand')) { fieldKey = 'securityMandateDate'; clientId = id.slice(0, -5); }
      else if (id.endsWith('_dcb')) { fieldKey = 'dcbDate'; clientId = id.slice(0, -4); }
      else if (id.endsWith('_90d')) { fieldKey = 'ninetyDaysDate'; clientId = id.slice(0, -4); }

      if (clientId && fieldKey) {
          const eventId = `v-${clientId}-${fieldKey}`;
          const existingEvent = agendaEvents.find(e => e.id === eventId);
          
          if (existingEvent) {
              if (existingEvent.status !== 'resolved') {
                  const updatedAgenda = agendaEvents.map(e => e.id === eventId ? { ...e, status: 'resolved' as const } : e);
                  setAgendaEvents(updatedAgenda);
                  saveData('agenda', updatedAgenda);
              }
          } else {
              // We need to create the override
              const client = records.find(c => c.id === clientId);
              if (client) {
                  const dateStr = client[fieldKey as keyof ClientRecord] as string;
                  if (dateStr) {
                      let isoDate = '';
                      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          isoDate = dateStr;
                      } else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                          const parsed = parseDate(dateStr);
                          if (parsed) {
                              const year = parsed.getFullYear();
                              const month = String(parsed.getMonth() + 1).padStart(2, '0');
                              const day = String(parsed.getDate()).padStart(2, '0');
                              isoDate = `${year}-${month}-${day}`;
                          }
                      }
                      
                      if (isoDate) {
                          let type: 'perícia' | 'prazo' | 'outro' = 'prazo';
                          let description = '';
                          if (fieldKey === 'medExpertiseDate') { type = 'perícia'; description = 'Perícia Médica (Automático)'; }
                          else if (fieldKey === 'socialExpertiseDate') { type = 'perícia'; description = 'Perícia Social (Automático)'; }
                          else if (fieldKey === 'extensionDate') { description = 'Prorrogação (Automático)'; }
                          else if (fieldKey === 'securityMandateDate') { description = 'Mandado de Segurança (Automático)'; }
                          else if (fieldKey === 'dcbDate') { description = 'DCB (Automático)'; }
                          else if (fieldKey === 'ninetyDaysDate') { description = '90 Dias (Automático)'; }

                          const newEvent: AgendaEvent = {
                              id: eventId,
                              date: isoDate,
                              time: '00:00',
                              type,
                              description,
                              clientId: client.id,
                              clientName: client.name,
                              status: 'resolved',
                              isVirtual: true,
                              resolvedAt: new Date().toISOString(),
                              resolvedBy: user ? `${user.firstName} ${user.lastName}` : 'Sistema'
                          };
                          
                          const updatedAgenda = [...agendaEvents, newEvent];
                          setAgendaEvents(updatedAgenda);
                          saveData('agenda', updatedAgenda);
                      }
                  }
              }
          }
      }
  };

  // Save Logic (Generic)
  const saveData = async (type: 'clients' | 'contracts' | 'calculations' | 'social_calculations' | 'dr_michel' | 'dra_luana' | 'dr_felix_castro' | 'sec_fabricia' | 'agenda' | 'resolved_alerts' | 'daily_focus', newData: any[], clientToSave?: ClientRecord) => {
      setIsSyncing(true);
      setSaveError(null);
      setLastSavedType(type);
      const supabase = initSupabase();

      // Helper for retries with exponential backoff
      const upsertWithRetry = async (payload: any, retries = 3) => {
          if (!supabase) return null;
          for (let i = 0; i < retries; i++) {
              try {
                  const { error } = await supabase.from('clients').upsert(payload);
                  if (!error) return null;
                  
                  // If it's a payload too large error, we should stop retrying
                  if (error.code === '413' || error.message?.includes('too large')) {
                      return error;
                  }

                  console.warn(`Sync attempt ${i + 1} failed:`, error.message);
                  if (i === retries - 1) return error;
                  await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
              } catch (e: any) {
                  if (i === retries - 1) return e;
                  await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
              }
          }
          return null;
      };

      try {
          if (type === 'clients' && clientToSave) {
              // Save directly to Supabase first
              try {
                  await supabaseService.saveClient(clientToSave);
                  // Update local state and cache
                  setRecords(newData);
                  // safeSetLocalStorage('inss_records', JSON.stringify(newData)); // Removed to avoid QuotaExceededError
              } catch (e: any) {
                  console.error("Sync error (client):", e);
                  setSaveError(`Erro de sincronização (Cliente): ${e.message || 'Erro'}`);
              }
              setIsSyncing(false);
              return;
          } else if (type === 'contracts') {
              setContracts(newData);
              // safeSetLocalStorage('inss_contracts', JSON.stringify(newData)); // Removed to avoid QuotaExceededError
              if (supabase) {
                  try {
                      const compressedData = LZString.compressToUTF16(JSON.stringify(newData));
                      const error = await upsertWithRetry({ id: 2, data: compressedData });
                      if (error) {
                          console.error("Sync error (contracts):", error);
                          setSaveError("Erro de sincronização (Contratos).");
                      }
                  } catch (e) {
                      console.error("Compression or sync error (contracts):", e);
                      setSaveError("Erro de sincronização (Contratos).");
                  }
                  setIsSyncing(false);
                  return;
              }
          } else if (type === 'calculations') {
              setSavedCalculations(newData);
              // safeSetLocalStorage('inss_calculations', JSON.stringify(newData)); // Removed to avoid QuotaExceededError
              if (supabase) {
                  const error = await upsertWithRetry({ id: 3, data: newData });
                  if (error) {
                      console.error("Sync error (calculations):", error);
                      setSaveError("Erro de sincronização (Cálculos).");
                  }
                  setIsSyncing(false);
                  return;
              }
          } else if (type === 'social_calculations') {
              setSavedSocialCalculations(newData);
              // safeSetLocalStorage('social_security_calculations', JSON.stringify(newData)); // Removed to avoid QuotaExceededError
              if (supabase) {
                  const error = await upsertWithRetry({ id: 4, data: newData });
                  if (error) {
                      console.error("Sync error (social):", error);
                      setSaveError("Erro de sincronização (Previdenciário).");
                  }
                  setIsSyncing(false);
                  return;
              }
          } else if (type === 'dr_michel') {
              setDrMichelSessions(newData);
              // safeSetLocalStorage('dr_michel_sessions', JSON.stringify(newData)); // Removed to avoid QuotaExceededError
              if (supabase) {
                  const error = await upsertWithRetry({ id: 5, data: newData });
                  if (error) {
                      console.error("Sync error (Michel):", error);
                      setSaveError("Erro de sincronização (Dr. Michel).");
                  }
                  setIsSyncing(false);
                  return;
              }
          } else if (type === 'dra_luana') {
              setDraLuanaSessions(newData);
              // safeSetLocalStorage('dra_luana_sessions', JSON.stringify(newData)); // Removed to avoid QuotaExceededError
              if (supabase) {
                  const error = await upsertWithRetry({ id: 6, data: newData });
                  if (error) {
                      console.error("Sync error (Luana):", error);
                      setSaveError("Erro de sincronização (Dra. Luana).");
                  }
                  setIsSyncing(false);
                  return;
              }
          } else if (type === 'dr_felix_castro') {
              setDrFelixCastroSessions(newData);
              if (supabase) {
                  const error = await upsertWithRetry({ id: 11, data: newData });
                  if (error) {
                      console.error("Sync error (FelixCastro):", error);
                      setSaveError("Erro de sincronização (Dr. Felix e Castro).");
                  }
                  setIsSyncing(false);
                  return;
              }
          } else if (type === 'sec_fabricia') {
              setSecFabriciaSessions(newData);
              if (supabase) {
                  const error = await upsertWithRetry({ id: 18, data: newData }); // 18 or whichever next logic id, or we just rely on getAIConversations('fabricia') 
                  // Oh wait, AI conversations in supabaseService uses getAIConversations, which uses ai_conversations table! 
                  // Where is upsertWithRetry({ id: 11, data: newData }) pointing to? It points to 'services' table which was a backup or the old local storage sync!
                  if (error) {
                      console.error("Sync error (SecFabricia):", error);
                      setSaveError("Erro de sincronização (Sec. Fabrícia).");
                  }
                  setIsSyncing(false);
                  return;
              }
          } else if (type === 'agenda') {
              if (supabase) {
                  // Proteção: busca o estado atual do Supabase antes de salvar
                  // para nunca sobrescrever com array vazio
                  if (newData.length === 0) {
                      const { data: current } = await supabase
                          .from('clients').select('data').eq('id', 7).maybeSingle();
                      if (current?.data && Array.isArray(current.data) && current.data.length > 0) {
                          setIsSyncing(false);
                          return; // Não sobrescreve dados existentes com array vazio
                      }
                  }
                  const error = await upsertWithRetry({ id: 7, data: newData });
                  if (error) {
                      console.error("Sync error (Agenda):", error);
                      setSaveError("Erro de sincronização (Agenda).");
                  } else {
                      setAgendaEvents(newData);
                      // safeSetLocalStorage('agenda_events', JSON.stringify(newData)); // Removed
                  }
                  setIsSyncing(false);
                  return;
              }
              setAgendaEvents(newData);
              // safeSetLocalStorage('agenda_events', JSON.stringify(newData)); // Removed
          } else if (type === 'resolved_alerts') {
              if (supabase) {
                  // Proteção: nunca sobrescreve alertas resolvidos com array vazio
                  if (newData.length === 0) {
                      const { data: current } = await supabase
                          .from('clients').select('data').eq('id', 8).maybeSingle();
                      if (current?.data && Array.isArray(current.data) && current.data.length > 0) {
                          setIsSyncing(false);
                          return; // Não sobrescreve dados existentes com array vazio
                      }
                  }
                  const error = await upsertWithRetry({ id: 8, data: newData });
                  if (error) {
                      console.error("Sync error (Resolved Alerts):", error);
                      setSaveError("Erro de sincronização (Alertas).");
                  } else {
                      setResolvedAlerts(newData);
                      // safeSetLocalStorage('inss_resolved_alerts', JSON.stringify(newData)); // Removed
                  }
                  setIsSyncing(false);
                  return;
              }
              setResolvedAlerts(newData);
              safeSetLocalStorage('inss_resolved_alerts', JSON.stringify(newData));
          } else if (type === 'daily_focus') {
              setDailyFocusState(newData[0]);
              safeSetLocalStorage('daily_focus_state', JSON.stringify(newData[0]));
              if (supabase) {
                  const error = await upsertWithRetry({ id: 10, data: newData[0] });
                  if (error) {
                      console.error("Sync error (Daily Focus):", error);
                      setSaveError("Erro de sincronização (Foco Diário).");
                  }
                  setIsSyncing(false);
                  return;
              }
          }
          setIsSyncing(false);
      } catch (err: any) {
          console.error("Erro ao salvar:", err);
          setSaveError("Erro: " + (err.message || "Falha na conexão"));
          setIsSyncing(false);
      }
  };

  const handleRetrySync = () => {
      if (!lastSavedType) return;
      
      let dataToSave: any[] = [];
      switch (lastSavedType) {
          case 'clients': dataToSave = records; break;
          case 'contracts': dataToSave = contracts; break;
          case 'calculations': dataToSave = savedCalculations; break;
          case 'social_calculations': dataToSave = savedSocialCalculations; break;
          case 'dr_michel': dataToSave = drMichelSessions; break;
          case 'dra_luana': dataToSave = draLuanaSessions; break;
          case 'dr_felix_castro': dataToSave = drFelixCastroSessions; break;
          case 'sec_fabricia': dataToSave = secFabriciaSessions; break;
          case 'agenda': dataToSave = agendaEvents; break;
          case 'resolved_alerts': dataToSave = resolvedAlerts; break;
      }
      
      if (dataToSave.length > 0) {
          saveData(lastSavedType as any, dataToSave);
      }
  };

  // Handlers for Clients
  const handleClientCreate = async (data: ClientRecord) => {
    // Generate a numeric ID for compatibility with bigint columns (Supabase default)
    const newRecord = { ...data, id: Date.now().toString() };
    const result = await saveData('clients', [newRecord, ...records], newRecord);
    setIsModalOpen(false);
    return result;
  };
  const handleClientUpdate = async (data: ClientRecord) => {
    const oldData = records.find(r => r.id === data.id);
    const updated = records.map(r => r.id === data.id ? data : r);
    const result = await saveData('clients', updated, data);
    setIsModalOpen(false);

    // Sync date changes to agendaEvents overrides
    if (oldData) {
        let agendaUpdated = false;
        const newAgendaEvents = [...agendaEvents];
        
        const checkAndUpdateAgenda = (fieldKey: keyof ClientRecord) => {
            if (oldData[fieldKey] !== data[fieldKey]) {
                const eventId = `v-${data.id}-${fieldKey}`;
                const eventIndex = newAgendaEvents.findIndex(e => e.id === eventId);
                if (eventIndex >= 0) {
                    const newDateStr = data[fieldKey] as string;
                    if (newDateStr) {
                        let isoDate = '';
                        if (newDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            isoDate = newDateStr;
                        } else if (newDateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                            const parsed = parseDate(newDateStr);
                            if (parsed) {
                                const year = parsed.getFullYear();
                                const month = String(parsed.getMonth() + 1).padStart(2, '0');
                                const day = String(parsed.getDate()).padStart(2, '0');
                                isoDate = `${year}-${month}-${day}`;
                            }
                        }
                        if (isoDate && (newAgendaEvents[eventIndex].date !== isoDate || newAgendaEvents[eventIndex].status === 'resolved')) {
                            newAgendaEvents[eventIndex] = { ...newAgendaEvents[eventIndex], date: isoDate, status: 'pending' };
                            agendaUpdated = true;
                        }
                    } else {
                        // Date was cleared, remove the manual override so it disappears
                        newAgendaEvents.splice(eventIndex, 1);
                        agendaUpdated = true;
                    }
                }
            }
        };

        checkAndUpdateAgenda('medExpertiseDate');
        checkAndUpdateAgenda('socialExpertiseDate');
        checkAndUpdateAgenda('extensionDate');
        checkAndUpdateAgenda('securityMandateDate');
        checkAndUpdateAgenda('dcbDate');
        checkAndUpdateAgenda('ninetyDaysDate');

        if (agendaUpdated) {
            setAgendaEvents(newAgendaEvents);
            saveData('agenda', newAgendaEvents);
        }

        let alertsModified = false;
        let newResolvedAlerts = [...resolvedAlerts];

        const alertSuffixMap: Record<string, string> = {
            medExpertiseDate: '_med',
            socialExpertiseDate: '_soc',
            extensionDate: '_ext',
            securityMandateDate: '_mand',
            dcbDate: '_dcb',
            ninetyDaysDate: '_90d'
        };

        Object.keys(alertSuffixMap).forEach(fieldKey => {
            if (oldData[fieldKey as keyof ClientRecord] !== data[fieldKey as keyof ClientRecord]) {
                const suffix = alertSuffixMap[fieldKey];
                const alertId = `${data.id}${suffix}`;
                
                if (newResolvedAlerts.includes(alertId)) {
                    newResolvedAlerts = newResolvedAlerts.filter(id => id !== alertId);
                    alertsModified = true;
                }
            }
        });

        if (alertsModified) {
            setResolvedAlerts(newResolvedAlerts);
            saveData('resolved_alerts', newResolvedAlerts);
        }

        if (dailyFocusState) {
            let tasksModified = false;
            let newResolvedTasks = [...(dailyFocusState.resolvedTasks || [])];
            let newPostponedTasks = [...(dailyFocusState.postponedTasks || [])];

            const alertKeyMap: Record<string, string> = {
                extensionDate: 'extension',
                medExpertiseDate: 'medExpertise',
                socialExpertiseDate: 'socialExpertise',
                dcbDate: 'dcb',
                ninetyDaysDate: 'ninetyDays',
                securityMandateDate: 'securityMandate'
            };

            Object.keys(alertKeyMap).forEach(fieldKey => {
                if (oldData[fieldKey as keyof ClientRecord] !== data[fieldKey as keyof ClientRecord]) {
                    const alertKey = alertKeyMap[fieldKey];
                    const taskId = `alert-${data.id}-${alertKey}`;
                    
                    if (newResolvedTasks.includes(taskId)) {
                        newResolvedTasks = newResolvedTasks.filter(id => id !== taskId);
                        tasksModified = true;
                    }
                    if (newPostponedTasks.find((t: any) => t.id === taskId)) {
                        newPostponedTasks = newPostponedTasks.filter((t: any) => t.id !== taskId);
                        tasksModified = true;
                    }
                }
            });

            if (tasksModified) {
                const newState = {
                    ...dailyFocusState,
                    resolvedTasks: newResolvedTasks,
                    postponedTasks: newPostponedTasks
                };
                setDailyFocusState(newState);
                saveData('daily_focus', [newState]);
            }
        }
    }
    return result;
  };

  const handleSaveClient = async (data: ClientRecord) => {
    if (currentRecord) {
        return handleClientUpdate(data);
    } else {
        return handleClientCreate(data);
    }
  };

  const handleClientDelete = async (id: string) => {
    if (confirm('Excluir cliente permanentemente?')) {
        const updated = records.filter(r => r.id !== id);
        setRecords(updated);
        safeSetLocalStorage('inss_records', JSON.stringify(updated));
        try {
            await supabaseService.deleteClient(id);
        } catch (e) {
            console.error("Error deleting client:", e);
            setSaveError("Erro ao excluir cliente.");
        }
    }
  };
  const handleToggleArchive = (id: string) => {
      const record = records.find(r => r.id === id);
      if (!record) return;
      const newValue = !record.isArchived;
      const action = newValue ? 'arquivar' : 'restaurar';
      
      if (confirm(`Deseja realmente ${action} este cliente?`)) {
          const updatedRecord = { ...record, isArchived: newValue };
          const updated = records.map(r => r.id === id ? updatedRecord : r);
          saveData('clients', updated, updatedRecord);
      }
  }

  const toggleDailyAttention = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      let updatedRecord: ClientRecord | null = null;
      const updated = records.map(r => {
          if (r.id === id) {
              // Cycle: None -> Yellow (Daily) -> Red (Urgent) -> None
              if (!r.isDailyAttention && !r.isUrgentAttention) {
                  updatedRecord = { ...r, isDailyAttention: true, isUrgentAttention: false };
              } else if (r.isDailyAttention) {
                  updatedRecord = { ...r, isDailyAttention: false, isUrgentAttention: true };
              } else {
                  updatedRecord = { ...r, isDailyAttention: false, isUrgentAttention: false };
              }
              return updatedRecord;
          }
          return r;
      });
      if (updatedRecord) {
          saveData('clients', updated, updatedRecord);
      }
  }

  // Handlers for Contracts
  const handleContractCreate = async (data: ContractRecord) => {
      const newRec = { ...data, id: Math.random().toString(36).substr(2, 9) };
      try {
          await supabaseService.saveContract(newRec);
          const updated = [newRec, ...contracts];
          setContracts(updated);
          safeSetLocalStorage('inss_contracts', JSON.stringify(updated));
          setIsContractModalOpen(false);
      } catch (e) {
          console.error("Error creating contract:", e);
          alert("Erro ao salvar contrato no servidor. Por favor, tente novamente.");
      }
  }
  const handleContractUpdate = async (data: ContractRecord) => {
      try {
          await supabaseService.saveContract(data);
          const updated = contracts.map(c => c.id === data.id ? data : c);
          setContracts(updated);
          safeSetLocalStorage('inss_contracts', JSON.stringify(updated));
          setIsContractModalOpen(false);
      } catch (e) {
          console.error("Error updating contract:", e);
          alert("Erro ao atualizar contrato no servidor. Por favor, tente novamente.");
      }
  }

  const handleSaveContract = (data: ContractRecord) => {
    if (currentContract) {
        handleContractUpdate(data);
    } else {
        handleContractCreate(data);
    }
  };

  const handleContractDelete = async (id: string) => {
      if (confirm('Excluir contrato e histórico financeiro?')) {
          try {
              await supabaseService.deleteContract(id);
              const updated = contracts.filter(c => c.id !== id);
              setContracts(updated);
              safeSetLocalStorage('inss_contracts', JSON.stringify(updated));
          } catch (e) {
              console.error("Error deleting contract:", e);
          }
      }
  }

  const handleRecoverLocalContracts = async () => {
      try {
          const localContractsStr = localStorage.getItem('inss_contracts');
          if (!localContractsStr) {
              alert("Nenhum contrato encontrado no cache local.");
              return;
          }
          
          let localContracts = [];
          try {
              const decompressed = LZString.decompressFromUTF16(localContractsStr);
              localContracts = decompressed ? JSON.parse(decompressed) : JSON.parse(localContractsStr);
          } catch (e) {
              localContracts = JSON.parse(localContractsStr);
          }

          if (!Array.isArray(localContracts) || localContracts.length === 0) {
              alert("Nenhum contrato válido encontrado no cache local.");
              return;
          }

          setIsLoading(true);
          let successCount = 0;
          for (const contract of localContracts) {
              try {
                  await supabaseService.saveContract(contract);
                  successCount++;
              } catch (err) {
                  console.error("Erro ao salvar contrato recuperado:", err);
              }
          }

          const remoteContracts = await supabaseService.getContracts();
          setContracts(remoteContracts || []);
          setIsLoading(false);
          alert(`${successCount} contratos recuperados e enviados para o Supabase com sucesso!`);
      } catch (err) {
          console.error("Erro ao recuperar contratos:", err);
          setIsLoading(false);
          alert("Ocorreu um erro ao tentar recuperar os contratos locais.");
      }
  };

  const handleSaveCalculation = async (calc: CalculationRecord) => {
      try {
          await supabaseService.saveLaborCalculation(calc);
          const updated = await supabaseService.getLaborCalculations();
          setSavedCalculations(updated);
          safeSetLocalStorage('inss_calculations', JSON.stringify(updated));
      } catch (error) {
          console.error("Error saving labor calculation:", error);
      }
  };

  const handleDeleteCalculation = async (id: string) => {
      if (confirm('Excluir este cálculo salvo?')) {
          try {
              await supabaseService.deleteLaborCalculation(id);
              const updated = savedCalculations.filter(c => c.id !== id);
              setSavedCalculations(updated);
              safeSetLocalStorage('inss_calculations', JSON.stringify(updated));
          } catch (error) {
              console.error("Error deleting labor calculation:", error);
          }
      }
  };

  const handleSaveSocialCalculation = async (data: SocialSecurityData) => {
      const newCalc = {
          id: new Date().getTime().toString(),
          date: new Date().toISOString(),
          clientName: data.clientName,
          data: data
      };
      
      try {
          await supabaseService.saveCalculation(newCalc);
          const updated = [newCalc, ...savedSocialCalculations];
          setSavedSocialCalculations(updated);
          safeSetLocalStorage('social_security_calculations', JSON.stringify(updated));
          alert('Cálculo Previdenciário salvo com sucesso no banco de dados!');
      } catch (error) {
          console.error("Error saving social calculation:", error);
          alert('Erro ao salvar cálculo no banco de dados.');
      }
  };

  const handleSaveDrMichelSessions = async (sessions: any[]) => {
      setDrMichelSessions(sessions);
      // Evitar QuotaExceededError limitando localStorage às 3 últimas sessões (o histórico total fica no Supabase)
      safeSetLocalStorage('dr_michel_sessions', JSON.stringify(sessions.slice(0, 3)));
  };

  const handleSaveDraLuanaSessions = async (sessions: any[]) => {
      setDraLuanaSessions(sessions);
      safeSetLocalStorage('dra_luana_sessions', JSON.stringify(sessions.slice(0, 3)));
  };

  const handleSaveDrFelixCastroSessions = async (sessions: any[]) => {
      setDrFelixCastroSessions(sessions);
      safeSetLocalStorage('dr_felix_castro_sessions', JSON.stringify(sessions.slice(0, 3)));
  };

  const handleSaveSecFabriciaSessions = async (sessions: any[]) => {
      setSecFabriciaSessions(sessions);
      safeSetLocalStorage('sec_fabricia_sessions', JSON.stringify(sessions.slice(0, 3)));
  };

  // Merge virtual events from clients into agenda
  const mergedAgendaEvents = useMemo(() => {
    const virtualEvents: AgendaEvent[] = [];
    
    records.forEach(r => {
      if (r.isArchived) return;

      const addVirtual = (dateStr: string | undefined, type: 'perícia' | 'prazo' | 'outro', description: string, fieldKey: string) => {
        if (!dateStr) return;

        let isoDate = '';
        
        // Check if it's already YYYY-MM-DD
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          isoDate = dateStr;
        } 
        // Check if it's DD/MM/YYYY (handles 1 or 2 digits for day/month)
        else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          const parsed = parseDate(dateStr);
          if (parsed) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const day = String(parsed.getDate()).padStart(2, '0');
            isoDate = `${year}-${month}-${day}`;
          }
        }

        if (isoDate) {
          virtualEvents.push({
            id: `v-${r.id}-${fieldKey}`,
            date: isoDate,
            time: '00:00',
            type,
            description,
            clientId: r.id,
            clientName: r.name,
            status: 'pending',
            isVirtual: true
          });
        }
      };

      addVirtual(r.medExpertiseDate, 'perícia', 'Perícia Médica (Automático)', 'medExpertiseDate');
      addVirtual(r.socialExpertiseDate, 'perícia', 'Perícia Social (Automático)', 'socialExpertiseDate');
      addVirtual(r.extensionDate, 'prazo', 'Prorrogação (Automático)', 'extensionDate');
      addVirtual(r.securityMandateDate, 'prazo', 'Mandado de Segurança (Automático)', 'securityMandateDate');
      addVirtual(r.dcbDate, 'prazo', 'DCB (Automático)', 'dcbDate');
      addVirtual(r.ninetyDaysDate, 'prazo', '90 Dias (Automático)', 'ninetyDaysDate');
    });

    // Filter out virtual events that have been overridden or "deleted" (cancelled) in agendaEvents
    const manualIds = new Set(agendaEvents.map(e => e.id));
    const filteredVirtual = virtualEvents.filter(v => !manualIds.has(v.id));

    return [...agendaEvents, ...filteredVirtual];
  }, [agendaEvents, records]);

  const handleSaveAgendaEvent = (event: AgendaEvent) => {
      const existing = agendaEvents.find(e => e.id === event.id);
      let updated;
      if (existing) {
          updated = agendaEvents.map(e => e.id === event.id ? event : e);
      } else {
          updated = [...agendaEvents, event];
      }
      setAgendaEvents(updated); // Optimistic Update
      saveData('agenda', updated);

      // Sincronizar com o cliente se for um evento virtual
      if (event.id.startsWith('v-')) {
          const parts = event.id.split('-');
          const fieldKey = parts.pop();
          const clientId = parts.slice(1).join('-');
          
          if (clientId && fieldKey) {
              const client = records.find(c => c.id === clientId);
              if (client) {
                  let clientUpdated = false;
                  const updatedClient = { ...client };
                  
                  // Se a data mudou, atualiza no cliente
                  let eventDateFormatted = event.date;
                  if (event.date && event.date.includes('-')) {
                      const [y, m, d] = event.date.split('-');
                      if (y && m && d) {
                           eventDateFormatted = `${d}/${m}/${y}`;
                      }
                  }
                  const currentClientDate = updatedClient[fieldKey as keyof ClientRecord];
                  
                  if (currentClientDate !== eventDateFormatted && currentClientDate !== event.date) {
                      (updatedClient as any)[fieldKey] = eventDateFormatted;
                      clientUpdated = true;
                  }
                  
                  if (clientUpdated) {
                      const updatedClients = records.map(c => c.id === clientId ? updatedClient : c);
                      setRecords(updatedClients);
                      saveData('clients', updatedClients, updatedClient);
                  }
                  
                  // Se foi marcado como resolvido, adiciona aos alertas resolvidos
                  if (event.status === 'resolved') {
                      let suffix = '';
                      if (fieldKey === 'medExpertiseDate') suffix = '_med';
                      else if (fieldKey === 'socialExpertiseDate') suffix = '_soc';
                      else if (fieldKey === 'extensionDate') suffix = '_ext';
                      else if (fieldKey === 'securityMandateDate') suffix = '_mand';
                      else if (fieldKey === 'dcbDate') suffix = '_dcb';
                      else if (fieldKey === 'ninetyDaysDate') suffix = '_90d';
                      
                      if (suffix) {
                          const alertId = clientId + suffix;
                          if (!resolvedAlerts.includes(alertId)) {
                              handleResolveAlert(alertId, true);
                          }
                      }
                  } else if (event.status === 'pending') {
                      // Se voltou para pendente, remove dos alertas resolvidos
                      let suffix = '';
                      if (fieldKey === 'medExpertiseDate') suffix = '_med';
                      else if (fieldKey === 'socialExpertiseDate') suffix = '_soc';
                      else if (fieldKey === 'extensionDate') suffix = '_ext';
                      else if (fieldKey === 'securityMandateDate') suffix = '_mand';
                      else if (fieldKey === 'dcbDate') suffix = '_dcb';
                      else if (fieldKey === 'ninetyDaysDate') suffix = '_90d';
                      
                      if (suffix) {
                          const alertId = clientId + suffix;
                          if (resolvedAlerts.includes(alertId)) {
                              const newAlerts = resolvedAlerts.filter(id => id !== alertId);
                              setResolvedAlerts(newAlerts);
                              saveData('resolved_alerts', newAlerts);
                          }
                      }
                  }
              }
          }
      }
  };

  const handleSavePetition = async (clientId: string, petition: any) => {
      let client = records.find(c => c.id === clientId);
      if (!client) return;

      // Se o cliente não tiver petições preenchidas (está em modo 'summary'),
      // ou se quisermos garantir que temos a lista mais atualizada do servidor
      if (!client.petitions || client.petitions.length === 0) {
          try {
              const fullClient = await supabaseService.getClientDetails(clientId);
              if (fullClient) {
                  client = fullClient;
                  // Atualiza o estado records com os dados completos
                  setRecords(prev => prev.map(r => r.id === clientId ? fullClient : r));
              }
          } catch (err) {
              console.error("Erro ao buscar detalhes do cliente para salvar petição:", err);
          }
      }

      const existingPetitions = client.petitions || [];
      const index = existingPetitions.findIndex(p => 
          p.id === petition.id || 
          (!p.id && !activePetition?.id && p.title === activePetition?.title && p.content === activePetition?.content)
      );
      
      let updatedPetitions;
      if (index >= 0) {
          updatedPetitions = [...existingPetitions];
          updatedPetitions[index] = petition;
      } else {
          updatedPetitions = [petition, ...existingPetitions];
      }

      const updatedClient = { ...client, petitions: updatedPetitions };
      const updatedClients = records.map(c => c.id === clientId ? updatedClient : c);
      
      // Salva na nuvem e atualiza estado local
      setRecords(updatedClients);
      saveData('clients', updatedClients, updatedClient);
      
      if (!activePetition || activePetition.id === petition.id || !activePetition.id) {
          setActivePetition(petition);
      }
  };

    const handleSaveReferral = async (clientId: string, referrerName: string, referrerPercentage: number, totalFee: number) => {
        const client = records.find(r => r.id === clientId);
        if (!client) return;
        
        const updatedClient = {
            ...client,
            isReferral: true,
            referrerName,
            referrerPercentage,
            totalFee,
        };
        
        const updatedClients = records.map(r => r.id === clientId ? updatedClient : r);
        
        // Update state immediately for UI responsiveness
        setRecords(updatedClients);
        
        // Persist to storage
        await saveData('clients', updatedClients, updatedClient);
    };

  const handleOpenPetition = (petition: any, clientId?: string) => {
      setActivePetition(petition);
      setActivePetitionClientId(clientId || null);
      
      // Se um clientId for fornecido (ex: abrindo do modal do cliente), 
      // podemos usar isso para garantir que o cliente correto seja selecionado
      if (clientId) {
          const client = records.find(c => c.id === clientId);
          if (client) {
              // O PetitionEditor vai procurar o cliente baseado no ID da petição
              // Mas para garantir, podemos passar o cliente selecionado se necessário
              // (Atualmente o PetitionEditor já faz essa busca no useEffect)
          }
      }
      
      setCurrentView('petition_editor');
      setIsModalOpen(false);
  };

  const handleDeleteAgendaEvent = (id: string) => {
      if (confirm('Excluir este compromisso?')) {
          const isVirtual = id.startsWith('v-');
          if (isVirtual) {
              const virtualEvent = mergedAgendaEvents.find(e => e.id === id);
              if (virtualEvent) {
                  const updated = [...agendaEvents, { ...virtualEvent, status: 'cancelled' as const }];
                  setAgendaEvents(updated);
                  saveData('agenda', updated);
                  return;
              }
          }
          const filtered = agendaEvents.filter(e => e.id !== id);
          setAgendaEvents(filtered);
          saveData('agenda', filtered);
      }
  };

  // Sorting and Filtering Logic
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getFilteredData = () => {
      const lowerSearch = searchTerm.toLowerCase();
      
      if (currentView === 'clients') {
          return records.filter(r => {
            const nameMatch = r.name ? r.name.toLowerCase().includes(lowerSearch) : false;
            const cpfMatch = r.cpf ? r.cpf.includes(lowerSearch) : false;
            const searchMatch = !lowerSearch || nameMatch || cpfMatch;
            
            let filterMatch = false;
            if (clientFilter === 'archived') {
                filterMatch = !!r.isArchived;
            } else if (clientFilter === 'referral') {
                filterMatch = !!r.isReferral && !r.isArchived;
            } else {
                filterMatch = !r.isArchived && !r.isReferral;
            }
            
            return searchMatch && filterMatch;
          }).sort((a, b) => {
              // Priority: Red (Urgent) > Yellow (Daily) > None
              const aScore = (a.isUrgentAttention ? 2 : 0) + (a.isDailyAttention ? 1 : 0);
              const bScore = (b.isUrgentAttention ? 2 : 0) + (b.isDailyAttention ? 1 : 0);
              
              if (aScore !== bScore) return bScore - aScore; // Higher score first

              if (sortConfig) {
                  const aVal = (a as any)[sortConfig.key] || '';
                  const bVal = (b as any)[sortConfig.key] || '';
                  if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                  if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
              }
              return (a.name || '').localeCompare(b.name || '');
          });
      } else {
          return contracts.filter(c => 
            ((c.firstName || '').toLowerCase().includes(lowerSearch)) ||
            ((c.lastName || '').toLowerCase().includes(lowerSearch)) ||
            ((c.cpf || '').includes(lowerSearch))
          ).sort((a, b) => {
             // Contracts sort logic
             if (sortConfig) {
                  const aVal = (a as any)[sortConfig.key] || '';
                  const bVal = (b as any)[sortConfig.key] || '';
                  if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                  if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
             }
             const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
             const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
             return dateB - dateA; // Default new first
          });
      }
  }

  const filteredList = getFilteredData();
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedList = filteredList.slice(startIndex, startIndex + itemsPerPage);

  const handleUpdateContractStatus = (contractId: string, newStatus: 'Pendente' | 'Em Andamento' | 'Concluído') => {
    const updatedContracts = contracts.map(c => 
      c.id === contractId ? { ...c, status: newStatus } : c
    );
    setContracts(updatedContracts);
    saveData('contracts', updatedContracts);

    // Also update the client's status if necessary
    const contract = contracts.find(c => c.id === contractId);
    if (contract && contract.clientId) {
      const client = records.find(r => r.id === contract.clientId);
      if (client) {
        const updatedClient = { ...client, status: newStatus };
        const updatedClients = records.map(r => r.id === client.id ? updatedClient : r);
        setRecords(updatedClients);
        saveData('clients', updatedClients, updatedClient);
      }
    }
  };

  // Render Helpers
  const renderSortIcon = (columnKey: string) => {
     if (sortConfig?.key !== columnKey) return null;
     return sortConfig.direction === 'ascending' ? <ChevronUpIcon className="w-3 h-3 ml-1 inline" /> : <ChevronDownIcon className="w-3 h-3 ml-1 inline" />;
  };

  const ThSortable = ({ label, columnKey, align = "left" }: { label: string, columnKey: string, align?: "left"|"center"|"right" }) => (
      <th 
        className={`px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-bordeaux-900/40/80 cursor-pointer hover:bg-slate-200 dark:hover:bg-bordeaux-900/60 transition select-none text-xs uppercase tracking-wider text-${align}`}
        onClick={() => requestSort(columnKey)}
      >
        <div className={`flex items-center ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}>
            {label}
            {renderSortIcon(columnKey)}
        </div>
      </th>
  );

  // Helper for Date Cells with Alerts
  const renderDateCell = (dateStr: string, recordId?: string, suffix?: string) => {
      const overdue = isOverdueDate(dateStr);
      const urgent = !overdue && isUrgentDate(dateStr);
      const isResolved = recordId && suffix ? resolvedAlerts.includes(recordId + suffix) : false;
      const showAsOverdue = overdue && !isResolved;
      const showAsUrgent = urgent && !isResolved;

      return (
          <td className="px-4 py-3">
              <div className={`flex items-center gap-1.5 ${
                showAsOverdue ? 'text-red-700 dark:text-red-400 font-bold' :
                showAsUrgent ? 'text-orange-500 dark:text-orange-400 font-semibold' :
                isResolved ? 'text-emerald-600 dark:text-emerald-400 font-medium' :
                'dark:text-slate-400'}`}>
                  {showAsOverdue && <ExclamationTriangleIcon className="h-4 w-4 animate-pulse" />}
                  {showAsUrgent && <ExclamationTriangleIcon className="h-4 w-4" />}
                  {isResolved && <CheckIcon className="h-4 w-4" />}
                  {dateStr || '-'}
              </div>
          </td>
      );
  };

  const PaginationControls = () => (
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 dark:border-gold-500/20 bg-slate-50/50 dark:bg-bordeaux-900/40/30">
          <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Linhas por página:</span>
              <select 
                  value={itemsPerPage} 
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-white dark:bg-bordeaux-950/60 border border-slate-200 dark:border-gold-500/15 rounded-lg text-xs font-bold py-1.5 px-2 outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
              </select>
          </div>
          
          <div className="flex items-center gap-2">
              <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-gold-500/15 bg-white dark:bg-bordeaux-950/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-bordeaux-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                  <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Página {currentPage} de {totalPages || 1}
              </span>
              <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-gold-500/15 bg-white dark:bg-bordeaux-950/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-bordeaux-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                  <ChevronRightIcon className="h-4 w-4" />
              </button>
          </div>
      </div>
  );

  const handleUpdateDailyFocus = (newState: DailyFocusState) => {
    setDailyFocusState(newState);
    saveData('daily_focus', [newState]);
  };

  const handleViewChange = (view: any) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-cream-50 dark:bg-[#0f0a0a] font-sans transition-colors duration-200 overflow-hidden relative">
      
      {/* OVERLAY (mobile + desktop quando sidebar aberta) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION - Felix & Castro Bordô */}
      <aside className={`fixed inset-y-0 left-0 bg-bordeaux-900 text-cream-50 flex flex-col flex-shrink-0 transition-transform duration-300 ease-out z-50 w-72 shadow-2xl shadow-bordeaux-950/50 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           {/* Padrão de balança decorativo no fundo */}
           <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{backgroundImage: 'radial-gradient(circle at 20% 30%, #C9A961 0%, transparent 40%), radial-gradient(circle at 80% 70%, #C9A961 0%, transparent 40%)'}}></div>
           
           <div className="relative h-20 flex items-center justify-between px-6 border-b border-gold-500/20">
               <div className="flex items-center gap-3">
                   <div className="bg-gradient-to-br from-gold-400 to-gold-600 p-2 rounded-lg shadow-lg shadow-gold-900/40 ring-1 ring-gold-300/50">
                       <ScaleIcon className="h-6 w-6 text-bordeaux-900" />
                   </div>
                   <div>
                       <span className="font-serif font-semibold text-xl tracking-tight text-cream-50 leading-none">Felix &amp; Castro</span>
                       <span className="block text-[10px] uppercase tracking-[0.2em] text-gold-300/80 mt-1">Advocacia Especializada</span>
                   </div>
               </div>
               <button className="p-1.5 text-cream-50/60 hover:text-gold-400 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                   <XMarkIcon className="w-5 h-5" />
               </button>
           </div>

           <div className="relative flex-1 py-5 px-3 space-y-1 overflow-y-auto custom-scrollbar">
               <button 
                   onClick={() => handleViewChange('clients')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'clients' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'clients' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <UserGroupIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Clientes</span>
               </button>

               <button 
                   onClick={() => handleViewChange('contracts')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'contracts' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'contracts' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <BriefcaseIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Contratos &amp; Fin.</span>
               </button>

               <button 
                   onClick={() => handleViewChange('labor_calc')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'labor_calc' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'labor_calc' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <CalculatorIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Calc. Trabalhista</span>
               </button>

               <button 
                   onClick={() => handleViewChange('dra_luana')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'dra_luana' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'dra_luana' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <StarIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Dra. Luana Castro (IA)</span>
               </button>

               <button 
                   onClick={() => handleViewChange('social_calc')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'social_calc' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'social_calc' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <CalculatorIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Calc. Previdenciária</span>
               </button>

               <button 
                   onClick={() => handleViewChange('dr_michel')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'dr_michel' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'dr_michel' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <StarIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Dr. Michel Felix (IA)</span>
               </button>

               <button 
                   onClick={() => handleViewChange('agenda')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'agenda' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'agenda' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <CalendarIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Agenda</span>
               </button>

               <button 
                   onClick={() => handleViewChange('dr_felix_castro')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'dr_felix_castro' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'dr_felix_castro' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <StarIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Dr. Felix e Castro (IA)</span>
               </button>

               <button 
                   onClick={() => handleViewChange('petition_editor')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'petition_editor' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'petition_editor' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <PencilSquareIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Editor de Petições</span>
               </button>

               <button 
                   onClick={() => handleViewChange('legislation')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'legislation' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'legislation' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <BookOpenIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Legislação</span>
               </button>

               <button 
                   onClick={() => handleViewChange('jurisprudence')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'jurisprudence' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'jurisprudence' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <ScaleIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Jurisprudência</span>
               </button>

               <button 
                   onClick={() => handleViewChange('meu_inss')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'meu_inss' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'meu_inss' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <GlobeAltIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Meu INSS</span>
               </button>

               <button 
                   onClick={() => handleViewChange('knowledge_base')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'knowledge_base' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'knowledge_base' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <AcademicCapIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm whitespace-nowrap">Base de Conhecimento</span>
               </button>

               <button 
                   onClick={() => handleViewChange('marketing')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'marketing' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'marketing' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <SparklesIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm whitespace-nowrap">Marketing Jurídico</span>
               </button>

               <button 
                   onClick={() => handleViewChange('sec_fabricia')}
                   className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === 'sec_fabricia' ? 'bg-bordeaux-800 text-gold-300 shadow-inner' : 'text-cream-100/80 hover:bg-bordeaux-800/60 hover:text-gold-200'}`}
               >
                   {currentView === 'sec_fabricia' && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gold-500 rounded-r-full"></span>}
                   <StarIcon className="h-5 w-5 mr-3 shrink-0" />
                   <span className="font-medium text-sm">Sec. Fabrícia Felix (IA)</span>
               </button>
           </div>
           
           <div className="relative p-4 border-t border-gold-500/20 bg-bordeaux-950/40">
               <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-xs font-bold text-bordeaux-900 ring-2 ring-gold-300/30">
                       {user.firstName[0]}
                   </div>
                   <div>
                       <p className="text-sm font-semibold text-cream-50 leading-tight">{user.firstName}</p>
                       <p className="text-[10px] text-gold-300/70 uppercase tracking-wider">{user.role}</p>
                   </div>
               </div>
               <button onClick={onLogout} className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-cream-100/60 hover:text-gold-300 hover:bg-bordeaux-800/60 rounded-lg transition border border-gold-500/10 hover:border-gold-500/30">
                   <ArrowRightOnRectangleIcon className="h-4 w-4" />
                   <span className="text-[11px] font-semibold uppercase tracking-wider">Sair</span>
               </button>
           </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 relative h-screen overflow-hidden bg-cream-50 dark:bg-[#0f0a0a]">
        {/* Navbar (Top) - Bordô premium */}
        <header className="bg-bordeaux-900 dark:bg-bordeaux-950 border-b border-gold-500/30 h-16 flex items-center justify-between px-4 lg:px-6 z-30 shadow-lg shadow-bordeaux-950/20">
             <div className="flex items-center gap-2 lg:gap-4 overflow-hidden">
                 <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-cream-50 hover:bg-bordeaux-800 hover:text-gold-300 rounded-lg shrink-0 transition-colors" title="Abrir menu">
                     <Bars3Icon className="h-5 w-5" />
                 </button>
                 <h2 className="text-base lg:text-xl font-serif font-semibold text-cream-50 truncate tracking-tight">
                     {currentView === 'clients' ? 'Painel de Clientes' : 
                      currentView === 'contracts' ? 'Gestão de Contratos' :
                      currentView === 'labor_calc' ? 'Cálculos Trabalhistas' :
                      currentView === 'petition_editor' ? 'Editor de Petições' :
                      currentView === 'dr_michel' ? 'Dr. Michel Felix — IA Jurídica' :
                      currentView === 'dra_luana' ? 'Dra. Luana Castro — IA Trabalhista' :
                      currentView === 'dr_felix_castro' ? 'Dr. Felix e Castro — IA Generalista (CDC/Civil)' :
                      currentView === 'sec_fabricia' ? 'Sec. Fabrícia Felix — Secretária Jurídica IA' :
                      currentView === 'agenda' ? 'Agenda' :
                      currentView === 'knowledge_base' ? 'Base de Conhecimento' :
                      currentView === 'marketing' ? 'Marketing Jurídico' :
                      currentView === 'legislation' ? 'Legislação e Normas' :
                      currentView === 'jurisprudence' ? 'Jurisprudência' :
                      currentView === 'meu_inss' ? 'Meu INSS' :
                      'Cálculos Previdenciários'}
                 </h2>
                 {isSyncing ? (
                      <span className="text-xs text-gold-300 flex items-center gap-1"><ArrowPathRoundedSquareIcon className="h-3 w-3 animate-spin" /> Salvando...</span>
                 ) : saveError ? (
                      <div className="flex items-center gap-2">
                          <span className="text-xs text-red-300 flex items-center gap-1 font-bold"><ExclamationTriangleIcon className="h-3 w-3" /> {saveError}</span>
                          <button 
                            onClick={handleRetrySync}
                            className="text-[10px] bg-red-900/40 text-red-200 px-2 py-0.5 rounded hover:bg-red-900/60 transition-colors font-bold uppercase border border-red-500/30"
                          >
                            Tentar Novamente
                          </button>
                          <button 
                            onClick={() => setSaveError(null)}
                            className="text-[10px] bg-bordeaux-800 text-cream-100/70 px-2 py-0.5 rounded hover:bg-bordeaux-700 transition-colors font-bold uppercase"
                          >
                            Limpar
                          </button>
                      </div>
                 ) : isCloudConfigured ? (
                     <span className="text-xs text-gold-200 flex items-center gap-1 font-medium bg-gold-500/10 px-2.5 py-1 rounded-full border border-gold-500/30"><CloudIcon className="h-3 w-3" /> Online</span>
                 ) : (
                     <span className="text-xs text-cream-100/60 flex items-center gap-1">Local</span>
                 )}
             </div>

             <div className="flex items-center gap-2">
                 <button onClick={() => setIsNotificationsOpen(true)} className="p-2 text-cream-50/80 hover:text-gold-300 hover:bg-bordeaux-800 rounded-lg relative transition-colors">
                     <BellIcon className="h-5 w-5" />
                     {activeAlerts.length > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-gold-400 ring-2 ring-bordeaux-900 animate-pulse"></span>}
                 </button>
                 <button onClick={onOpenSettings} className="p-2 text-cream-50/80 hover:text-gold-300 hover:bg-bordeaux-800 rounded-lg transition-colors">
                     <Cog6ToothIcon className={`h-5 w-5 ${isCloudConfigured ? 'text-gold-400' : ''}`} />
                 </button>
                 <button onClick={toggleDarkMode} className="p-2 text-cream-50/80 hover:text-gold-300 hover:bg-bordeaux-800 rounded-lg transition-colors" title={darkMode ? 'Modo claro' : 'Modo escuro'}>
                     {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                 </button>
             </div>
        </header>

        <main className="flex-1 overflow-y-auto p-2 lg:p-6 pb-24 lg:pb-6 flex flex-col" style={{WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain'}}>
             
             {/* CONTENT SWITCHER */}
             <Suspense fallback={<div className="flex-1 flex items-center justify-center p-12 text-slate-400">Carregando módulo...</div>}>
             {currentView === 'dr_michel' ? (
                 <PersonaChat 
                    persona={MICHEL_PERSONA}
                    initialSessions={drMichelSessions} 
                    onSaveSessions={handleSaveDrMichelSessions} 
                    onOpenPetition={handleOpenPetition}
                    customLaws={customLaws}
                  />
             ) : currentView === 'dra_luana' ? (
                 <DraLuanaCastro 
                    initialSessions={draLuanaSessions} 
                    onSaveSessions={handleSaveDraLuanaSessions} 
                    onOpenPetition={handleOpenPetition}
                    customLaws={customLaws}
                  />
             ) : currentView === 'dr_felix_castro' ? (
                 <DrFelixECastro 
                    initialSessions={drFelixCastroSessions} 
                    onSaveSessions={handleSaveDrFelixCastroSessions} 
                    onOpenPetition={handleOpenPetition}
                    customLaws={customLaws}
                  />
             ) : currentView === 'sec_fabricia' ? (
                 <SecFabriciaFelix 
                    initialSessions={secFabriciaSessions} 
                    onSaveSessions={handleSaveSecFabriciaSessions}
                    onOpenPetition={handleOpenPetition}
                    customLaws={customLaws}
                  />
             ) : currentView === 'legislation' ? (
                  <Legislation customLaws={customLaws} onSaveCustomLaws={handleSaveCustomLaws} />
             ) : currentView === 'agenda' ? (
                 <Agenda 
                    events={mergedAgendaEvents}
                    clients={records}
                    contracts={contracts}
                    user={user}
                    darkMode={darkMode}
                    dailyFocusState={dailyFocusState}
                    onUpdateDailyFocus={handleUpdateDailyFocus}
                    eventToEdit={eventToEdit}
                    onClearEventToEdit={() => setEventToEdit(null)}
                    onSaveEvent={handleSaveAgendaEvent}
                    onDeleteEvent={handleDeleteAgendaEvent}
                    onUpdateContractStatus={handleUpdateContractStatus}
                 />
             ) : currentView === 'petition_editor' ? (
                  <PetitionEditor 
                     clients={records}
                     onBack={() => {
                         setCurrentView('clients');
                         setActivePetition(null);
                         setActivePetitionClientId(null);
                     }}
                     initialPetition={activePetition}
                     initialClientId={activePetitionClientId}
                     onSavePetition={handleSavePetition}
                  />
             ) : currentView === 'labor_calc' ? (
                 <LaborCalc 
                    clients={records} 
                    contracts={contracts} 
                    savedCalculations={savedCalculations}
                    onSaveCalculation={handleSaveCalculation}
                    onDeleteCalculation={handleDeleteCalculation}
                 />
             ) : currentView === 'social_calc' ? (
                 <SocialSecurityCalc 
                    clients={records}
                    savedCalculations={savedSocialCalculations}
                    onSaveCalculation={handleSaveSocialCalculation}
                    onUpdateCalculations={(list) => {
                        setSavedSocialCalculations(list);
                        safeSetLocalStorage('social_security_calculations', JSON.stringify(list));
                    }}
                 />
             ) : currentView === 'clients' ? (
                 <>
                    {/* ... (Conteúdo de Clients Mantido - Oculto aqui para brevidade, mas o código completo está no topo) ... */}
                     <div className="grid grid-cols-1 mb-6">
                         <StatsCards 
                            records={records.filter(r => !r.isArchived)} 
                            onOpenAgenda={() => setIsAgendaModalOpen(true)}
                         />
                     </div>
                    
                    {/* Action Bar Clients */}
                    <div className="flex flex-col gap-4 mb-6">
                         {/* Toggle Tabs */}
                         <div className="flex bg-slate-200 dark:bg-bordeaux-900/40 p-1 rounded-xl w-fit">
                            <button 
                                onClick={() => handleClientFilterChange('active')} 
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${clientFilter === 'active' ? 'bg-white dark:bg-bordeaux-900/60 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <UserGroupIcon className="h-4 w-4" />
                                Ativos
                            </button>
                            <button 
                                onClick={() => handleClientFilterChange('referral')} 
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${clientFilter === 'referral' ? 'bg-white dark:bg-bordeaux-900/60 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <StarIcon className="h-4 w-4" />
                                Indicações
                            </button>
                            <button 
                                onClick={() => handleClientFilterChange('archived')} 
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${clientFilter === 'archived' ? 'bg-white dark:bg-bordeaux-900/60 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <ArchiveBoxIcon className="h-4 w-4" />
                                Arquivados
                            </button>
                         </div>

                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="relative w-full md:w-[400px] group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                </div>
                                <input
                                type="text"
                                placeholder={clientFilter === 'archived' ? "Buscar em arquivados..." : "Buscar cliente por nome ou CPF..."}
                                className="pl-11 pr-4 py-3 w-full border border-slate-200 dark:border-gold-500/15 bg-white dark:bg-bordeaux-900/40 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-all"
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                />
                            </div>
                            {clientFilter === 'active' && (
                                <button
                                    onClick={() => { setCurrentRecord(null); setIsModalOpen(true); }}
                                    className="fc-btn-primary text-cream-50 font-semibold py-3 px-6 rounded-xl shadow-lg shadow-primary-500/25 flex items-center gap-2"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                    Novo Processo
                                </button>
                            )}
                            {clientFilter === 'referral' && (
                                <button
                                    onClick={() => setIsReferralModalOpen(true)}
                                    className="fc-btn-primary text-cream-50 font-semibold py-3 px-6 rounded-xl shadow-lg shadow-primary-500/25 flex items-center gap-2"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                    Nova Indicação
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Clients Table / Cards */}
                    <div className="bg-white dark:bg-bordeaux-950/60 rounded-2xl shadow-xl border border-slate-200 dark:border-gold-500/20 flex flex-col">
                        {/* Desktop Table (Visible only on md screens and up) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-bordeaux-900/40/80">
                                    <tr>
                                        <th className="px-4 py-3.5 text-center w-14 font-bold text-slate-600 dark:text-slate-400">★</th>
                                        <ThSortable label="Nome" columnKey="name" />
                                        <ThSortable label="CPF" columnKey="cpf" />
                                        {clientFilter === 'referral' && (
                                            <>
                                                <ThSortable label="Indicador" columnKey="referrerName" />
                                                <ThSortable label="Honorários" columnKey="totalFee" />
                                                <ThSortable label="%" columnKey="referrerPercentage" />
                                            </>
                                        )}
                                        <th className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300">Senha</th>
                                        <ThSortable label="Tipo" columnKey="type" />
                                        <ThSortable label="DER" columnKey="der" />
                                        <ThSortable label="P. Médica" columnKey="medExpertiseDate" />
                                        <ThSortable label="P. Social" columnKey="socialExpertiseDate" />
                                        <ThSortable label="Prorrog." columnKey="extensionDate" />
                                        <ThSortable label="DCB" columnKey="dcbDate" />
                                        <ThSortable label="90 Dias" columnKey="ninetyDaysDate" />
                                        <ThSortable label="Mandado" columnKey="securityMandateDate" />
                                        <th className="px-4 py-3.5 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedList.length === 0 ? (
                                        <tr>
                                            <td colSpan={clientFilter === 'referral' ? 16 : 13} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                                Nenhum cliente encontrado {clientFilter === 'archived' ? 'nos arquivos' : ''}.
                                            </td>
                                        </tr>
                                    ) : paginatedList.map((record: any) => {
                                        const isYellow = record.isDailyAttention;
                                        const isRed = record.isUrgentAttention;
                                        
                                        let rowClass = 'hover:bg-slate-50 dark:hover:bg-bordeaux-900/50/50';
                                        if (isYellow) rowClass = 'bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20';
                                        if (isRed) rowClass = 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20';

                                        return (
                                            <tr key={record.id} className={`${rowClass} transition-colors`}>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={(e) => toggleDailyAttention(record.id, e)} title="Alternar Prioridade: Normal -> Atenção -> Urgente">
                                                        {isRed ? (
                                                            <StarIconSolid className="h-5 w-5 text-red-500 animate-pulse" />
                                                        ) : isYellow ? (
                                                            <StarIconSolid className="h-5 w-5 text-yellow-400" />
                                                        ) : (
                                                            <StarIcon className="h-5 w-5 text-slate-300 hover:text-yellow-400" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 font-semibold dark:text-slate-200 uppercase">
                                                    <div className="flex items-center gap-2">
                                                        <span>{record.name}</span>
                                                        {record.whatsapp && (
                                                            <a
                                                                href={`https://wa.me/${(() => { const n = record.whatsapp.replace(/\D/g, ''); return n.startsWith('55') ? n : '55' + n; })()}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={`Abrir WhatsApp: ${record.whatsapp}`}
                                                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60 transition shadow-sm"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.855L.057 23.882l6.186-1.453A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.032-1.388l-.361-.214-3.732.877.944-3.618-.235-.372A9.808 9.808 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                                                                </svg>
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span>{record.cpf}</span>
                                                        <CopyButton text={record.cpf} />
                                                    </div>
                                                </td>
                                                {clientFilter === 'referral' && (
                                                    <>
                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{record.referrerName || '-'}</td>
                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                            {record.totalFee ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(record.totalFee) : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{record.referrerPercentage ? `${record.referrerPercentage}%` : '-'}</td>
                                                    </>
                                                )}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs bg-slate-100 dark:bg-bordeaux-900/40 px-2 py-1 rounded">{record.password}</span>
                                                        <CopyButton text={record.password} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${!record.type ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-primary-50 text-primary-800 border-primary-300/60 dark:bg-bordeaux-900/30 dark:text-gold-300 dark:border-gold-500/30'}`}>{record.type || 'N/D'}</span>
                                                </td>
                                                <td className="px-4 py-3 dark:text-slate-400">{record.der || '-'}</td>
                                                {renderDateCell(record.medExpertiseDate, record.id, '_med')}
                                                {renderDateCell(record.socialExpertiseDate, record.id, '_soc')}
                                                {renderDateCell(record.extensionDate, record.id, '_ext')}
                                                {renderDateCell(record.dcbDate, record.id, '_dcb')}
                                                <td className="px-4 py-3 text-xs italic text-slate-400">
                                                    <div className={`flex items-center gap-1.5 ${resolvedAlerts.includes(record.id + '_90d') ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                                                        {resolvedAlerts.includes(record.id + '_90d') && <CheckIcon className="h-4 w-4" />}
                                                        {record.ninetyDaysDate || '-'}
                                                    </div>
                                                </td>
                                                {renderDateCell(record.securityMandateDate, record.id, '_mand')}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {clientFilter !== 'archived' ? (
                                                            <button 
                                                                onClick={() => handleToggleArchive(record.id)} 
                                                                className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                                                                title="Arquivar"
                                                            >
                                                                <ArchiveBoxIcon className="h-4 w-4" />
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleToggleArchive(record.id)} 
                                                                className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                                title="Restaurar"
                                                            >
                                                                <ArrowUturnLeftIcon className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleEditClient(record)} 
                                                            disabled={isFetchingDetails}
                                                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded disabled:opacity-50"
                                                        >
                                                            {isFetchingDetails && currentRecord?.id === record.id ? (
                                                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <PencilSquareIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <button onClick={() => handleClientDelete(record.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><TrashIcon className="h-4 w-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards (Visible only on screens below md) */}
                        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
                             {paginatedList.length === 0 ? (
                                 <div className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                                     Nenhum cliente encontrado {clientFilter === 'archived' ? 'nos arquivos' : ''}.
                                 </div>
                             ) : paginatedList.map((record: any) => (
                                 <div key={record.id} className="p-4 space-y-4">
                                     <div className="flex justify-between items-start">
                                         <div className="flex items-center gap-3">
                                             <button onClick={(e) => toggleDailyAttention(record.id, e)}>
                                                 {record.isUrgentAttention ? (
                                                     <StarIconSolid className="h-6 w-6 text-red-500" />
                                                 ) : record.isDailyAttention ? (
                                                     <StarIconSolid className="h-6 w-6 text-yellow-400" />
                                                 ) : (
                                                     <StarIcon className="h-6 w-6 text-slate-300" />
                                                 )}
                                             </button>
                                             <div>
                                                 <div className="font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2">
                                                     {record.name}
                                                     {record.whatsapp && (
                                                         <a href={`https://wa.me/${(() => { const n = record.whatsapp.replace(/\D/g, ''); return n.startsWith('55') ? n : '55' + n; })()}`} target="_blank" rel="noopener noreferrer" className="text-green-500">
                                                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                                 <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                                                 <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.855L.057 23.882l6.186-1.453A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.032-1.388l-.361-.214-3.732.877.944-3.618-.235-.372A9.808 9.808 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                                                             </svg>
                                                         </a>
                                                     )}
                                                 </div>
                                                 <div className="text-xs text-slate-500 font-mono tracking-wider">{record.cpf}</div>
                                             </div>
                                         </div>
                                         <div className="flex gap-2">
                                             <button onClick={() => handleEditClient(record)} className="p-2 bg-primary-50 dark:bg-bordeaux-900/30 text-primary-700 dark:text-gold-400 rounded-lg">
                                                 <PencilSquareIcon className="h-5 w-5" />
                                             </button>
                                             <button onClick={() => handleClientDelete(record.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                                                 <TrashIcon className="h-5 w-5" />
                                             </button>
                                         </div>
                                     </div>

                                     <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase text-slate-400">
                                         <div>
                                             <p className="mb-1">Senha</p>
                                             <p className="text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-bordeaux-900/40 p-1.5 rounded">{record.password}</p>
                                         </div>
                                         <div>
                                             <p className="mb-1">Tipo</p>
                                             <p className="text-primary-700 dark:text-gold-400 bg-primary-50 dark:bg-bordeaux-900/30 p-1.5 rounded border border-primary-200/50 dark:border-gold-500/30">{record.type || 'N/D'}</p>
                                         </div>
                                         <div>
                                             <p className="mb-1">DER</p>
                                             <p className="text-slate-700 dark:text-slate-300">{record.der || '-'}</p>
                                         </div>
                                         <div>
                                             <p className="mb-1">Dcb</p>
                                             <p className="text-slate-700 dark:text-slate-300">{record.dcbDate || '-'}</p>
                                         </div>
                                     </div>
                                      
                                     <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50 dark:border-gold-500/20/50">
                                         {record.medExpertiseDate && (
                                             <div className="px-2 py-1 bg-primary-50 dark:bg-primary-900/10 text-primary-600 dark:text-primary-400 rounded text-[9px] font-bold border border-primary-100 dark:border-primary-800">
                                                 P. Médica: {record.medExpertiseDate}
                                             </div>
                                         )}
                                         {record.socialExpertiseDate && (
                                             <div className="px-2 py-1 bg-primary-50 dark:bg-indigo-900/10 text-primary-700 dark:text-gold-400 rounded text-[9px] font-bold border border-indigo-100 dark:border-indigo-800">
                                                 P. Social: {record.socialExpertiseDate}
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             ))}
                        </div>
                        <div className="mt-auto">
                            <PaginationControls />
                        </div>
                    </div>
                 </>
             ) : currentView === 'jurisprudence' ? (
                 <Jurisprudence />
             ) : currentView === 'meu_inss' ? (
                 <MeuINSS />
             ) : currentView === 'knowledge_base' ? (
                 <KnowledgeBase />
             ) : currentView === 'marketing' ? (
                 <MarketingGenerator darkMode={darkMode} user={user} />
             ) : (
                 <>
                    <FinancialStats contracts={contracts} />

                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:w-[400px] group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar contrato por nome ou CPF..."
                                className="pl-11 pr-4 py-3 w-full border border-slate-200 dark:border-gold-500/15 bg-white dark:bg-bordeaux-900/40 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRecoverLocalContracts}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2"
                                title="Recuperar contratos que estavam salvos apenas no navegador"
                            >
                                <ArrowPathIcon className="h-5 w-5" />
                                Recuperar Locais
                            </button>
                            <button
                                onClick={() => { setCurrentContract(null); setIsContractModalOpen(true); }}
                                className="bg-primary-700 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center gap-2"
                            >
                                <PlusIcon className="h-5 w-5" />
                                Novo Contrato
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-bordeaux-950/60 rounded-2xl shadow-xl border border-slate-200 dark:border-gold-500/20 flex flex-col">
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-bordeaux-900/40/80">
                                    <tr>
                                        <ThSortable label="Cliente" columnKey="firstName" />
                                        <ThSortable label="Serviço" columnKey="serviceType" />
                                        <ThSortable label="Responsável" columnKey="lawyer" />
                                        <ThSortable label="Valor Total" columnKey="totalFee" />
                                        <th className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300">Pagamento</th>
                                        <ThSortable label="Status" columnKey="status" />
                                        <th className="px-4 py-3.5 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedList.map((contract: any) => {
                                        const totalPaid = (contract.payments || []).reduce((sum: number, p: any) => p.isPaid ? sum + p.amount : sum, 0);
                                        const totalFee = Number(contract.totalFee) || 0;
                                        const percentPaid = totalFee > 0 ? (totalPaid / totalFee) * 100 : 0;
                                        
                                        return (
                                            <tr key={contract.id} className="hover:bg-slate-50 dark:hover:bg-bordeaux-900/50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold dark:text-slate-200">{contract.firstName} {contract.lastName}</div>
                                                    <div className="text-xs text-slate-400 font-mono">{contract.cpf}</div>
                                                </td>
                                                <td className="px-4 py-3 dark:text-slate-300">{contract.serviceType}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${contract.lawyer === 'Michel' ? 'bg-primary-50 text-primary-800 border-primary-300/60 dark:bg-bordeaux-900/30' : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20'}`}>
                                                        {contract.lawyer === 'Michel' ? '👨‍⚖️ Dr. Michel' : '👩‍⚖️ Dra. Luana'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono font-bold dark:text-slate-200">{formatCurrency(totalFee)}</td>
                                                <td className="px-4 py-3 w-48">
                                                    <div className="w-full bg-slate-200 dark:bg-bordeaux-900/60 rounded-full h-2 mb-1">
                                                        <div className={`h-2 rounded-full ${percentPaid >= 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${Math.min(percentPaid, 100)}%` }}></div>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex justify-between">
                                                        <span>Pago: {formatCurrency(totalPaid)}</span>
                                                        <span>{Math.round(percentPaid)}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                     <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border 
                                                        ${contract.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400' : 
                                                          contract.status === 'Em Andamento' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' : 
                                                          'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                         {contract.status}
                                                     </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => { setCurrentContract(contract); setIsContractModalOpen(true); }} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded"><PencilSquareIcon className="h-4 w-4" /></button>
                                                        <button onClick={() => handleContractDelete(contract.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><TrashIcon className="h-4 w-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                             {paginatedList.length === 0 ? (
                                 <div className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                                     Nenhum contrato encontrado.
                                 </div>
                             ) : paginatedList.map((contract: any) => {
                                 const totalPaid = (contract.payments || []).reduce((sum: number, p: any) => p.isPaid ? sum + p.amount : sum, 0);
                                 const totalFee = Number(contract.totalFee) || 0;
                                 const percentPaid = totalFee > 0 ? (totalPaid / totalFee) * 100 : 0;
                                 
                                 return (
                                     <div key={contract.id} className="p-4 space-y-3">
                                         <div className="flex justify-between items-start">
                                             <div>
                                                 <div className="font-bold text-slate-900 dark:text-white uppercase truncate">
                                                     {contract.firstName} {contract.lastName}
                                                 </div>
                                                 <div className="text-xs text-slate-500 font-mono tracking-wider">{contract.cpf}</div>
                                             </div>
                                             <span className={`px-2 py-0.5 rounded text-[9px] font-bold border 
                                                 ${contract.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                   contract.status === 'Em Andamento' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                                   'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                 {contract.status}
                                             </span>
                                         </div>

                                         <div className="flex justify-between items-center text-xs">
                                             <div className="text-slate-600 dark:text-slate-400 font-medium italic">{contract.serviceType}</div>
                                             <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${contract.lawyer === 'Michel' ? 'bg-primary-50 text-primary-800 border-primary-200/50' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                                 {contract.lawyer === 'Michel' ? 'Michel' : 'Luana'}
                                             </span>
                                         </div>

                                         <div className="space-y-1">
                                             <div className="flex justify-between text-[10px] items-center mb-1">
                                                 <span className="text-slate-500">Valor Total: <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(totalFee)}</span></span>
                                                 <span className="text-slate-500 font-bold">{Math.round(percentPaid)}%</span>
                                             </div>
                                             <div className="w-full bg-slate-100 dark:bg-bordeaux-900/40 rounded-full h-1.5 overflow-hidden">
                                                 <div className={`h-1.5 rounded-full ${percentPaid >= 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${Math.min(percentPaid, 100)}%` }}></div>
                                             </div>
                                         </div>

                                         <div className="flex justify-between items-center pt-2">
                                             <div className="text-[10px] text-slate-500">
                                                 Sinal/Pago: <span className="font-bold text-primary-700 dark:text-gold-400">{formatCurrency(totalPaid)}</span>
                                             </div>
                                             <div className="flex gap-2">
                                                 <button onClick={() => { setCurrentContract(contract); setIsContractModalOpen(true); }} className="p-2 bg-primary-50 dark:bg-indigo-900/20 text-primary-700 dark:text-gold-400 rounded-lg">
                                                     <PencilSquareIcon className="h-4 w-4" />
                                                 </button>
                                                 <button onClick={() => handleContractDelete(contract.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                                                     <TrashIcon className="h-4 w-4" />
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })}
                        </div>
                        <div className="mt-auto">
                            <PaginationControls />
                        </div>
                    </div>
                 </>
             )}
             </Suspense>
        </main>

        <RecordModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSaveClient}
            initialData={currentRecord}
            onOpenPetition={(petition, clientId) => handleOpenPetition(petition, clientId)}
        />
        
        <ContractModal 
            isOpen={isContractModalOpen} 
            onClose={() => setIsContractModalOpen(false)} 
            onSave={handleSaveContract}
            initialData={currentContract}
            clients={records.filter(r => !r.isArchived)}
        />
        
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={onCloseSettings} 
            onSave={onSettingsSaved}
            onRestoreBackup={onRestoreBackup}
        />

        <NotificationsModal 
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            notifications={activeAlerts}
            onResolve={handleResolveAlert}
        />
        <ReferralModal 
            isOpen={isReferralModalOpen} 
            onClose={() => setIsReferralModalOpen(false)} 
            onSave={handleSaveReferral} 
            clients={records.filter(r => !r.isReferral)} 
        />
        <AgendaModal 
            isOpen={isAgendaModalOpen}
            onClose={() => setIsAgendaModalOpen(false)}
            events={mergedAgendaEvents}
            user={user}
            onUpdateEvent={handleSaveAgendaEvent}
            onEditEvent={(event) => {
              setEventToEdit(event);
              setIsAgendaModalOpen(false);
              setCurrentView('agenda');
            }}
        />
      </div>
    </div>
  );
}
