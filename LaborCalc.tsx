import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalculatorIcon, 
  BanknotesIcon, 
  ClockIcon, 
  ExclamationTriangleIcon, 
  DocumentTextIcon, 
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
  ArchiveBoxIcon,
  PencilSquareIcon,
  UserIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CalendarIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';
import { jsPDF } from "jspdf";
import { ClientRecord, ContractRecord } from './types';
import { supabaseService } from './services/supabaseService';
import { getMinWage, getProceduralRite } from './utils';

// --- Estilos CSS (Tailwind) ---
const STYLES = {
  LABEL_TEXT: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5",
  LABEL_TINY: "block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1",
  INPUT_FIELD: "w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition text-sm font-medium shadow-sm",
  INPUT_TINY: "w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500",
  BTN_PRIMARY: "px-5 py-2.5 text-white font-medium bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 transition flex items-center gap-2 transform active:scale-95",
  BTN_SECONDARY: "px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition shadow-sm transform active:scale-95",
  BTN_SECONDARY_SM: "px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition",
  CARD_SECTION: "bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800",
  CARD_TITLE: "font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 text-lg",
  EMPTY_MSG: "text-center text-sm text-slate-500 dark:text-slate-400 italic py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20"
};

// --- Tipos e Interfaces ---

export interface CalculationRecord {
    id: string;
    date: string;
    employeeName: string;
    totalValue: number;
    data: LaborData;
}

interface LaborData {
  // Dados Contratuais
  employeeName: string;
  startDate: string;
  endDate: string;
  baseSalary: number;
  terminationReason: 'sem_justa_causa' | 'pedido_demissao' | 'justa_causa' | 'rescisao_indireta' | 'sem_anotacao';
  noticePeriod: 'trabalhado' | 'indenizado' | 'dispensado' | 'nao_pago'; // 'nao_pago' treated as indenizado for calculation but maybe different label? User said "quando não tem o pagamento... que seria indenizado"
  hasFgtsBalance: number; // Saldo já depositado para cálculo da multa
  hasFgtsPenaltyBalance: number; // Multa de 40% já paga
  fgtsPenaltyAllDeposited: boolean; // Se a multa de 40% foi totalmente depositada
  clientReport?: string; // Relato do cliente / Fatos relevantes
  
  // Jornada Contratual (Informativo)
  contractualSchedule: {
      type: 'segunda_sexta' | 'segunda_sabado' | '6x1' | '12x36' | '24x48' | 'outros';
      schedules: {
          id: string;
          days: string; // e.g., "Segunda a Sexta"
          selectedDays?: number[]; // [1, 2, 3, 4, 5] for Mon-Fri
          startTime: string; // HH:mm
          endTime: string; // HH:mm
          breakStartTime: string; // HH:mm
          breakEndTime: string; // HH:mm
      }[];
      customDescription?: string;
      customMonthlyDays?: number; // Para escalas personalizadas
  };

  // Adicionais
  insalubridadeLevel: 'nenhum' | 'minimo' | 'medio' | 'maximo'; // 10, 20, 40%
  periculosidade: boolean; // 30%
  adicionalNoturno: {
    active: boolean;
    applySumula60?: boolean; // Súmula 60 TST - Prorrogação
    extendedEndTime?: string; // Horário fim real (ex: 07:00)
    periods: {
      id: string;
      hoursPerMonth: number;
      daysPerMonth?: number; // New: Dias trabalhados no mês
      hoursPerDay?: number; // New: Horas noturnas por dia
      startDate: string;
      endDate: string;
    }[];
  };
  intrajornada: {
      active: boolean;
      periods: {
          id: string;
          hoursPerDay: number; // Quantidade (horas/dia suprimidas)
          daysPerMonth?: number; // New: Dias trabalhados no mês
          startDate: string;
          endDate: string;
      }[];
  };

  // Diferenças Salariais
  wageGap: {
    active: boolean;
    floorSalary: number; // Piso da categoria
    paidSalary: number; // Quanto realmente recebia
    startDate: string;
    endDate: string;
  }[];

  // Adicionais e Horas Extras (Lote)
  overtime: {
    id: string;
    percentage: number; // 50, 60, 100 ou custom
    customPercentage?: number;
    hoursPerMonth: number;
    startDate: string;
    endDate: string;
    applyDsr: boolean;
  }[];

  // Feriados, Domingos e Banco de Horas
  employeeGender?: 'M' | 'F';
  uncompensatedHolidays?: number;
  uncompensatedSundays?: number;
  consecutiveSundaysWorked?: number; // Para mulheres (Art 386 CLT)
  timeBankBalance?: number;
  timeBankOvertimePercentage?: number;

  // Direitos CCT
  cctRights: {
      id: string;
      name: string;
      frequency: 'daily' | 'monthly' | 'annual';
      startDate: string;
      endDate: string;
      startYear: number;
      endYear: number;
      daysPerMonth?: number; // Dias trabalhados por mês (apenas para diário)
      value: string; // Texto ou valor numérico
      parsedValue: number; // Valor numérico para soma
      integratesSalary: boolean; // Se integra o salário para base de FGTS
  }[];

  // Estabilidade / Indenizações
  stability: {
    active: boolean;
    type: 'gestante' | 'acidentaria' | 'cipa' | 'outros';
    endDate: string; // Data fim da estabilidade
  };
  
  // Multas e Outros
  applyFine477: boolean; // Atraso pagamento
  applyFine467: boolean; // Verbas incontroversas
  moralDamages: number;
  
  // FGTS
  fgtsAllDeposited: boolean; // Se todos os depósitos foram feitos (Tab 1)
  fgtsNoDeposits: boolean; // Se nenhum depósito foi feito (Tab 3)
  unpaidFgtsMonths: number; // Quantos meses não foi depositado (Legacy/Manual)
  fgtsSpecificMissingPeriods: { // Períodos específicos sem depósito
      id: string;
      startDate: string;
      endDate: string;
  }[];
  
  unpaid13thPeriods: { id: string; year: number; month: number; }[]; // Anos de 13o não pagos (mês/ano)
  vacationPeriods: {
      id: string;
      startDate: string; // Data inicio aquisitivo
      endDate: string;   // Data fim aquisitivo
      isDouble: boolean;
  }[];
  claim13thProportional: boolean;
  claimVacationProportional: boolean;
  attorneyFees: number; // 5, 10, 15, 20, 25, 30%
  
  // Novos Campos
  salaryBalance: {
    active: boolean;
    days: number; // Dias de saldo
    customAmount?: number; // Valor manual opcional
  };
  severancePaid: number; // Valor já pago na rescisão (dedução)
  salaryHistory: {
    id: string;
    startDate: string;
    endDate: string;
    salary: number;
  }[];
  salaryOffTheBooks: {
    id: string;
    amount: number;
    startDate: string;
    endDate: string;
  }[];
}

const INITIAL_LABOR_DATA: LaborData = {
  employeeName: '',
  clientReport: '',
  startDate: '',
  endDate: '',
  baseSalary: 0,
  terminationReason: 'sem_justa_causa',
  noticePeriod: 'indenizado',
  hasFgtsBalance: 0,
  hasFgtsPenaltyBalance: 0,
  fgtsPenaltyAllDeposited: false,
  contractualSchedule: {
      type: 'segunda_sexta',
      schedules: [
          {
              id: 'initial',
              days: 'Segunda a Sexta',
              selectedDays: [1, 2, 3, 4, 5],
              startTime: '08:00',
              endTime: '17:00',
              breakStartTime: '12:00',
              breakEndTime: '13:00'
          }
      ],
      customDescription: '',
      customMonthlyDays: 22
  },
  insalubridadeLevel: 'nenhum',
  periculosidade: false,
  adicionalNoturno: { active: false, periods: [] },
  intrajornada: { active: false, periods: [] },
  wageGap: [],
  overtime: [],
  employeeGender: 'M',
  uncompensatedHolidays: 0,
  uncompensatedSundays: 0,
  consecutiveSundaysWorked: 0,
  timeBankBalance: 0,
  timeBankOvertimePercentage: 50,
  cctRights: [],
  stability: { active: false, type: 'gestante', endDate: '' },
  applyFine477: false,
  applyFine467: false,
  moralDamages: 0,
  fgtsAllDeposited: false,
  fgtsNoDeposits: false,
  unpaidFgtsMonths: 0,
  fgtsSpecificMissingPeriods: [],
  unpaid13thPeriods: [],
  vacationPeriods: [],
  claim13thProportional: true,
  claimVacationProportional: true,
  attorneyFees: 0,
  salaryBalance: { active: true, days: 0 },
  severancePaid: 0,
  salaryHistory: [],
  salaryOffTheBooks: []
};

// --- Helpers de Cálculo ---

const parseDate = (dateStr: string) => {
  if (!dateStr) return null;
  // Usar T12:00:00 para evitar que o fuso horário mude a data para o dia anterior
  return new Date(dateStr + 'T12:00:00');
};

const diffMonths = (d1: Date, d2: Date) => {
  let months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
};

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const getSalaryAtDate = (date: Date, history: LaborData['salaryHistory'], currentSalary: number): number => {
    if (!history || history.length === 0) return currentSalary;
    
    // Find history record that covers the date
    const record = history.find(h => {
        const start = parseDate(h.startDate);
        const end = h.endDate ? parseDate(h.endDate) : new Date(); // Assume open-ended if no end date? Or maybe current date.
        // Actually, if no end date, it might mean "until now".
        // Let's assume history records are sequential and cover periods.
        if (!start) return false;
        
        if (h.endDate) {
             const endDate = parseDate(h.endDate);
             return date >= start && endDate && date <= endDate;
        } else {
             return date >= start;
        }
    });

    return record ? Number(record.salary) : currentSalary;
};

const countMonths15DayRule = (start: Date, end: Date): number => {
    let months = 0;
    // Normalize to start of day
    const s = new Date(start); s.setHours(0,0,0,0);
    const e = new Date(end); e.setHours(0,0,0,0);
    
    let currentYear = s.getFullYear();
    let currentMonth = s.getMonth();
    
    const endYear = e.getFullYear();
    const endMonth = e.getMonth();
    
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        
        const activeStart = s > monthStart ? s : monthStart;
        const activeEnd = e < monthEnd ? e : monthEnd;
        
        if (activeStart <= activeEnd) {
            const diffTime = Math.abs(activeEnd.getTime() - activeStart.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
            
            if (diffDays >= 15) {
                months++;
            }
        }
        
        // Next month
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
    }
    return months;
};

const calculateFgtsExact = (start: Date, end: Date, history: LaborData['salaryHistory'], currentSalary: number): { value: number, months: number } => {
    let totalFgts = 0;
    let totalMonths = 0;
    // Normalize start to beginning of day
    const s = new Date(start); s.setHours(0,0,0,0);
    const e = new Date(end); e.setHours(0,0,0,0);
    
    let current = new Date(s.getFullYear(), s.getMonth(), 1);
    
    while (current <= e) {
        const year = current.getFullYear();
        const month = current.getMonth();
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        
        const activeStart = s > monthStart ? s : monthStart;
        const activeEnd = e < monthEnd ? e : monthEnd;
        
        if (activeStart <= activeEnd) {
            let daysWorked = 30;
            const isFullMonth = activeStart <= monthStart && activeEnd >= monthEnd;
            
            if (!isFullMonth) {
                const diffTime = Math.abs(activeEnd.getTime() - activeStart.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                daysWorked = Math.min(diffDays, 30);
            }
            
            // Get salary for this month (check 15th)
            const checkDate = new Date(year, month, Math.min(15, monthEnd.getDate()));
            const salary = getSalaryAtDate(checkDate, history, currentSalary);
            
            const monthlyBase = (salary / 30) * daysWorked;
            totalFgts += monthlyBase * 0.08;
            
            // Count as a month if worked at least 15 days? Or just count any participation?
            // User wants "months count". Usually 15 days rule applies for 13th/Vacation, but FGTS is daily.
            // Let's count it as a month if there was any contribution.
            if (totalFgts > 0) totalMonths++;
        }
        
        current.setMonth(current.getMonth() + 1);
    }
    return { value: totalFgts, months: totalMonths };
};

// Helper to parse Brazilian currency string to number
const parseBrazilianNumber = (val: string): number => {
    if (!val) return 0;
    // Remove everything that is not digit, comma, dot or minus
    let normalized = val.replace(/[^\d,.-]/g, '');
    // Remove all dots (thousand separators) and replace comma with dot (decimal)
    normalized = normalized.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
};

// Helper to calculate benefits iterating month by month (proportional)
const calculateBenefitExact = (
    start: Date, 
    end: Date, 
    history: LaborData['salaryHistory'], 
    currentSalary: number,
    calcFn: (salary: number, daysWorked: number) => number,
    fullMonthDays: number = 30
): { value: number, months: number, memory: string[] } => {
    let totalValue = 0;
    let totalMonths = 0;
    const memory: string[] = [];
    
    // Normalize
    const s = new Date(start); s.setHours(0,0,0,0);
    const e = new Date(end); e.setHours(0,0,0,0);
    
    let current = new Date(s.getFullYear(), s.getMonth(), 1);
    
    while (current <= e) {
        const year = current.getFullYear();
        const month = current.getMonth();
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        
        const activeStart = s > monthStart ? s : monthStart;
        const activeEnd = e < monthEnd ? e : monthEnd;
        
        if (activeStart <= activeEnd) {
            let daysWorked = fullMonthDays;
            const isFullMonth = activeStart <= monthStart && activeEnd >= monthEnd;
            
            if (!isFullMonth) {
                const diffTime = Math.abs(activeEnd.getTime() - activeStart.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                daysWorked = Math.min(diffDays, fullMonthDays);
            }
            
            // Get salary
            const checkDate = new Date(year, month, Math.min(15, monthEnd.getDate()));
            const salary = getSalaryAtDate(checkDate, history, currentSalary);
            
            const val = calcFn(salary, daysWorked);
            
            if (val > 0) {
                totalValue += val;
                totalMonths++;
                memory.push(`${month + 1}/${year}: R$ ${formatCurrency(val)} (${daysWorked} dias)`);
            }
        }
        current.setMonth(current.getMonth() + 1);
    }
    
    return { value: totalValue, months: totalMonths, memory };
};

const calculateLaborResults = (calcData: LaborData) => {
    const results = [];
    const start = parseDate(calcData.startDate);
    const end = parseDate(calcData.endDate);
    const salary = Number(calcData.baseSalary);

    if (!salary) return [];

    // 1. Saldo de Salário
    if (end && salary && calcData.salaryBalance.active) {
        let balance = 0;
        let days = calcData.salaryBalance.days;
        
        // Se dias for 0, tenta calcular automático
        if (days === 0) {
            days = end.getDate();
        }

        if (calcData.salaryBalance.customAmount) {
            balance = calcData.salaryBalance.customAmount;
        } else {
            balance = (salary / 30) * days;
        }
        
        results.push({ 
            desc: `Saldo de Salário (${days} dias)`, 
            value: balance, 
            category: 'Rescisórias',
            details: `Salário Base: ${formatCurrency(salary)}\nDias Trabalhados: ${days}\nCálculo: (${formatCurrency(salary)} / 30) * ${days} = ${formatCurrency(balance)}`
        });
    }

    // 2. Aviso Prévio
    let noticeValue = 0;
    let noticeDays = 0;
    const isIndemnified = calcData.noticePeriod === 'indenizado' || calcData.noticePeriod === 'nao_pago';
    const shouldPayNotice = isIndemnified && calcData.terminationReason !== 'justa_causa' && calcData.terminationReason !== 'pedido_demissao';

    if (start && end && salary && shouldPayNotice) {
        const years = Math.floor(diffMonths(start, end) / 12);
        const extraDays = Math.min(years * 3, 60); // Lei 12.506
        noticeDays = 30 + extraDays;
        noticeValue = (salary / 30) * noticeDays;
        results.push({ 
            desc: `Aviso Prévio Indenizado (${noticeDays} dias)`, 
            value: noticeValue, 
            category: 'Rescisórias',
            details: `Salário Base: ${formatCurrency(salary)}\nDias de Aviso: ${noticeDays} (30 + ${noticeDays - 30} proporcionais)\nCálculo: (${formatCurrency(salary)} / 30) * ${noticeDays} = ${formatCurrency(noticeValue)}`
        });
    }

    // Reflexos do Aviso Prévio (se indenizado)
    if (noticeDays > 0 && isIndemnified && start && end) {
        // A projeção do aviso prévio integra o tempo de serviço para todos os efeitos legais (Lei 12.506/2011, Súmula 371 TST).
        // Calculamos a diferença de avos entre a data de saída real e a data projetada.
        const projectedEndDate = new Date(end.getTime() + (noticeDays * 24 * 60 * 60 * 1000));
        
        // Para 13º Salário: Conta-se do início do ano (ou admissão) até o fim.
        const startOfYear = new Date(end.getFullYear(), 0, 1);
        const effectiveStart = start > startOfYear ? start : startOfYear;
        
        const monthsNormal = countMonths15DayRule(effectiveStart, end);
        const monthsProjected = countMonths15DayRule(effectiveStart, projectedEndDate);
        const totalReflexMonths = Math.max(0, monthsProjected - monthsNormal);
        
        if (totalReflexMonths > 0) {
            const valReflex13 = (salary / 12) * totalReflexMonths;
            results.push({ 
                desc: `Reflexo Aviso Prévio em 13º (${totalReflexMonths}/12 avos)`, 
                value: valReflex13, 
                category: 'Rescisórias',
                details: `Projeção: ${noticeDays} dias\nData Projetada: ${projectedEndDate.toLocaleDateString()}\nAvos Adicionais: ${totalReflexMonths} (Diferença entre projeção e data real)`
            });
            
            const valReflexVac = (salary / 12) * totalReflexMonths;
            const valReflexVacTotal = valReflexVac + (valReflexVac / 3);
            results.push({ 
                desc: `Reflexo Aviso Prévio em Férias + 1/3 (${totalReflexMonths}/12 avos)`, 
                value: valReflexVacTotal, 
                category: 'Rescisórias',
                details: `Projeção: ${noticeDays} dias\nData Projetada: ${projectedEndDate.toLocaleDateString()}\nAvos Adicionais: ${totalReflexMonths}`
            });
            
            const valReflexFgts = noticeValue * 0.08;
            results.push({ desc: `Reflexo Aviso Prévio em FGTS (8%)`, value: valReflexFgts, category: 'FGTS' });
        }
    }

    // 3. 13º Salário Proporcional
    if (end && salary && start) {
        if (calcData.claim13thProportional) {
            // 1. Proporcional do Ano de Saída
            const endYear = end.getFullYear();
            const startYear = start.getFullYear();

            // Se entrou e saiu no mesmo ano, o cálculo é único (meses trabalhados no ano)
            if (startYear === endYear) {
                const months = countMonths15DayRule(start, end);
                const thirteenth = (salary / 12) * months;
                results.push({ 
                    desc: `13º Salário Proporcional (${endYear}) - ${months}/12 avos`, 
                    value: thirteenth, 
                    category: 'Rescisórias',
                    details: `Salário Base: ${formatCurrency(salary)}\nMeses Trabalhados: ${months}\nCálculo: (${formatCurrency(salary)} / 12) * ${months} = ${formatCurrency(thirteenth)}`
                });
            } else {
                // Proporcional do Ano de Saída (Janeiro até Data Saída)
                const startOfEndYear = new Date(endYear, 0, 1);
                const monthsExitYear = countMonths15DayRule(startOfEndYear, end);
                if (monthsExitYear > 0) {
                    const thirteenthExit = (salary / 12) * monthsExitYear;
                    results.push({ 
                        desc: `13º Salário Proporcional (${endYear}) - ${monthsExitYear}/12 avos`, 
                        value: thirteenthExit, 
                        category: 'Rescisórias',
                        details: `Salário Base: ${formatCurrency(salary)}\nMeses Trabalhados: ${monthsExitYear}\nCálculo: (${formatCurrency(salary)} / 12) * ${monthsExitYear} = ${formatCurrency(thirteenthExit)}`
                    });
                }

                // Proporcional do Ano de Admissão (Data Admissão até Dezembro)
                // Verifica se o ano de admissão não está na lista de "Vencidos" (unpaid13thPeriods) para não duplicar
                // Se o usuário marcou "Calcular Proporcional", entende-se que quer os que não foram pagos integralmente.
                // Mas geralmente "Proporcional" na rescisão refere-se ao ano corrente.
                // O usuário pediu explicitamente: "TEM PELO MENOS DOIS PERÍODOS PROPORCIONAIS... AO MARCAR A CAIXINHA... DEVE APARECER OS VALORES DE AMBOS"
                
                // Vamos verificar se o ano de admissão já foi pago (está nos vencidos? ou assume-se não pago?)
                // Se o usuário pediu para calcular proporcional, vamos adicionar o do ano de admissão também se for diferente do ano de saída.
                
                const isAdmissionYearPaid = calcData.unpaid13thPeriods.some(p => p.year === startYear);
                
                if (!isAdmissionYearPaid) {
                    const endOfStartYear = new Date(startYear, 11, 31);
                    const monthsAdmissionYear = countMonths15DayRule(start, endOfStartYear);
                    
                    if (monthsAdmissionYear > 0 && monthsAdmissionYear < 12) {
                        // Busca salário da época (Dezembro do ano de admissão)
                        const refDate = new Date(startYear, 11, 20);
                        const historicalSalary = getSalaryAtDate(refDate, calcData.salaryHistory, salary);
                        
                        const thirteenthAdmission = (historicalSalary / 12) * monthsAdmissionYear;
                        results.push({ 
                            desc: `13º Salário Proporcional (${startYear}) - ${monthsAdmissionYear}/12 avos`, 
                            value: thirteenthAdmission, 
                            category: 'Rescisórias',
                            details: `Salário Base (Histórico): ${formatCurrency(historicalSalary)}\nMeses Trabalhados: ${monthsAdmissionYear}\nCálculo: (${formatCurrency(historicalSalary)} / 12) * ${monthsAdmissionYear} = ${formatCurrency(thirteenthAdmission)}`
                        });
                    }
                }
            }
        }
        
        if (calcData.unpaid13thPeriods.length > 0) {
            calcData.unpaid13thPeriods.forEach(p => {
                // Determine reference date for salary lookup (Dec 20th of that year)
                const refDate = new Date(p.year, (p.month || 12) - 1, 20);
                const historicalSalary = getSalaryAtDate(refDate, calcData.salaryHistory, salary);
                
                const label = p.month ? `${String(p.month).padStart(2, '0')}/${p.year}` : `${p.year}`;
                results.push({ 
                    desc: `13º Salário Vencido (${label})`, 
                    value: historicalSalary, 
                    category: 'Rescisórias',
                    details: `Salário Base (Histórico): ${formatCurrency(historicalSalary)}\nCálculo: Valor integral do salário da época.`
                });
            });
        }
    }

    // 4. Férias
    if (salary) {
        // Vencidas (Lista de Períodos)
        calcData.vacationPeriods.forEach((vac, idx) => {
            let baseVal = salary;
            let periodLabel = "Período Indefinido";
            
            if (vac.startDate && vac.endDate) {
                const vacStart = parseDate(vac.startDate);
                const vacEnd = parseDate(vac.endDate);
                
                if (vacStart && vacEnd) {
                    periodLabel = `${vacStart.toLocaleDateString('pt-BR')} a ${vacEnd.toLocaleDateString('pt-BR')}`;
                    
                    // Calculate concessive period end (end date + 1 year)
                    const concessiveEnd = new Date(vacEnd);
                    concessiveEnd.setFullYear(concessiveEnd.getFullYear() + 1);
                    
                    // Determine reference date for salary
                    // "senão recebi as férias deve ser referente ao salário de fevereiro 2023 (que era a última data que tinha para receber as férias)"
                    // If concessive period ended in the past, use that date. If it's in the future relative to now/termination, use termination salary.
                    const terminationDate = end || new Date();
                    const refDate = concessiveEnd < terminationDate ? concessiveEnd : terminationDate;
                    
                    baseVal = getSalaryAtDate(refDate, calcData.salaryHistory, salary);
                    
                    // Check if period is less than a year (using 15 day rule)
                    // If the user inputs a full year (e.g. 01/01/2021 to 31/12/2021), countMonths should be 12.
                    // If partial, calculate proportional.
                    const months = countMonths15DayRule(vacStart, vacEnd);
                    if (months < 12) {
                        baseVal = (baseVal / 12) * months;
                        periodLabel += ` (${months}/12 avos)`;
                    }
                }
            }
            
            let vacValue = baseVal + (baseVal / 3);
            
            if (vac.isDouble) {
                vacValue = vacValue * 2;
                results.push({ 
                    desc: `Férias Vencidas em Dobro + 1/3 (${periodLabel})`, 
                    value: vacValue, 
                    category: 'Rescisórias',
                    details: `Salário Base: ${formatCurrency(baseVal)}\nTerço Constitucional: ${formatCurrency(baseVal/3)}\nValor Simples: ${formatCurrency(baseVal + baseVal/3)}\nDobro: ${formatCurrency(vacValue)}`
                });
            } else {
                results.push({ 
                    desc: `Férias Vencidas + 1/3 (${periodLabel})`, 
                    value: vacValue, 
                    category: 'Rescisórias',
                    details: `Salário Base: ${formatCurrency(baseVal)}\nTerço Constitucional: ${formatCurrency(baseVal/3)}\nCálculo: ${formatCurrency(baseVal)} + ${formatCurrency(baseVal/3)} = ${formatCurrency(vacValue)}`
                });
            }
        });
        
        if (end && calcData.claimVacationProportional && start) {
            // Determine start of current vesting period (anniversary of start date)
            let vestingStart = new Date(start);
            vestingStart.setFullYear(end.getFullYear());
            
            // If anniversary in current year is after end date, then the vesting period started last year
            if (vestingStart > end) {
                vestingStart.setFullYear(end.getFullYear() - 1);
            }

            const effectiveMonths = countMonths15DayRule(vestingStart, end);
            
            if (effectiveMonths > 0) {
                const vacProp = (salary / 12) * effectiveMonths;
                const vacPropTotal = vacProp + (vacProp / 3);
                results.push({ 
                    desc: `Férias Proporcionais + 1/3 (${effectiveMonths}/12)`, 
                    value: vacPropTotal, 
                    category: 'Rescisórias',
                    details: `Salário Base: ${formatCurrency(salary)}\nProporcional: ${effectiveMonths}/12 avos\nValor Férias: ${formatCurrency(vacProp)}\nTerço Constitucional: ${formatCurrency(vacProp/3)}\nTotal: ${formatCurrency(vacPropTotal)}`
                });
            }
        }
    }

    // 5. Adicionais
    if (start && end) {
        const monthsWorked = diffMonths(start, end);
        const minimumWage = 1412;
        
        if (calcData.insalubridadeLevel !== 'nenhum') {
            let perc = 0;
            if (calcData.insalubridadeLevel === 'minimo') perc = 0.10;
            if (calcData.insalubridadeLevel === 'medio') perc = 0.20;
            if (calcData.insalubridadeLevel === 'maximo') perc = 0.40;
            
            const result = calculateBenefitExact(start, end, calcData.salaryHistory, salary, (sal, days) => {
                const monthlyVal = minimumWage * perc;
                return (monthlyVal / 30) * days;
            });
            
            results.push({ 
                desc: `Adicional Insalubridade (${perc * 100}% s/ Mínimo - ${result.months} meses)`, 
                value: result.value, 
                category: 'Adicionais',
                details: `Base: Salário Mínimo (${formatCurrency(minimumWage)})\nPercentual: ${perc * 100}%\nMeses Calculados: ${result.months}\nTotal: ${formatCurrency(result.value)}\n\nMemória (Últimos 12 meses):\n${result.memory.slice(-12).join('\n')}`
            });
            results.push({ 
                desc: `Reflexos Insalubridade (Férias, 13º, FGTS)`, 
                value: result.value * 0.3, 
                category: 'Reflexos',
                details: `Base de Cálculo: ${formatCurrency(result.value)}\nReflexos Estimados (30%): Férias + 1/3, 13º Salário, FGTS + 40%`
            });
        }

        if (calcData.periculosidade && salary) {
            const result = calculateBenefitExact(start, end, calcData.salaryHistory, salary, (sal, days) => {
                const monthlyVal = sal * 0.30;
                return (monthlyVal / 30) * days;
            });

            results.push({ 
                desc: `Adicional Periculosidade (30% - ${result.months} meses)`, 
                value: result.value, 
                category: 'Adicionais',
                details: `Base: Salário Base (Evolução Salarial)\nPercentual: 30%\nMeses Calculados: ${result.months}\nTotal: ${formatCurrency(result.value)}\n\nMemória (Últimos 12 meses):\n${result.memory.slice(-12).join('\n')}`
            });
            results.push({ 
                desc: `Reflexos Periculosidade (Férias, 13º, FGTS)`, 
                value: result.value * 0.3, 
                category: 'Reflexos',
                details: `Base de Cálculo: ${formatCurrency(result.value)}\nReflexos Estimados (30%): Férias + 1/3, 13º Salário, FGTS + 40%`
            });
        }

        if (calcData.adicionalNoturno.active && salary) {
            calcData.adicionalNoturno.periods.forEach((period, idx) => {
                const pStart = parseDate(period.startDate) || start;
                const pEnd = parseDate(period.endDate) || end;
                
                if (pStart && pEnd && period.hoursPerMonth > 0) {
                    const workDaysPerMonth = period.daysPerMonth || 26; // Default to 26 as per user request
                    
                    // Súmula 60 TST Calculation
                    let extendedHoursPerMonth = 0;
                    let extendedDetails = '';
                    
                    if (calcData.adicionalNoturno.applySumula60 && calcData.adicionalNoturno.extendedEndTime) {
                        const [endHour, endMin] = calcData.adicionalNoturno.extendedEndTime.split(':').map(Number);
                        // Calculate time difference from 05:00 (which is 5 * 60 minutes)
                        // If end time is e.g. 02:00 (next day), we assume it's past 05:00 only if it's explicitly > 05:00?
                        // Usually "Prorrogação" means it went past 05:00. If user puts 07:00, it's 2 hours.
                        // If user puts 04:00, it's not extended.
                        
                        let diffMinutes = (endHour * 60 + endMin) - (5 * 60);
                        
                        // Handle case where shift goes into next day but user inputs time like "07:00"
                        // Assuming the input is the end time of the shift.
                        // If end time is < 05:00, no extension.
                        
                        if (diffMinutes > 0) {
                             // Apply night hour reduction (52.5 min = 0.875 hours)
                             // Factor = 60 / 52.5 = 1.142857
                             const nightFactor = 60 / 52.5;
                             const extendedNightMinutes = diffMinutes * nightFactor;
                             const extendedNightHoursPerDay = extendedNightMinutes / 60;
                             
                             extendedHoursPerMonth = extendedNightHoursPerDay * workDaysPerMonth;
                             
                             extendedDetails = `[Súmula 60 TST - Prorrogação da Jornada Noturna]\n` +
                                               `Término Real da Jornada: ${calcData.adicionalNoturno.extendedEndTime}\n` +
                                               `Horas Prorrogadas/Dia (Relógio): ${(diffMinutes/60).toFixed(2)}h (05:00 às ${calcData.adicionalNoturno.extendedEndTime})\n` +
                                               `Fator de Redução da Hora Noturna: 1.1428 (52min30s)\n` +
                                               `Horas Prorrogadas/Dia (Noturnas): ${extendedNightHoursPerDay.toFixed(2)}h\n` +
                                               `Dias Considerados: ${workDaysPerMonth}\n` +
                                               `Adicional Mensal Extra: ${extendedHoursPerMonth.toFixed(2)}h`;
                        }
                    }

                    const totalHoursPerMonth = period.hoursPerMonth + extendedHoursPerMonth;

                    const result = calculateBenefitExact(pStart, pEnd, calcData.salaryHistory, salary, (sal, days) => {
                        const hourlyRate = sal / 220;
                        const nightRate = hourlyRate * 0.20;
                        const monthlyVal = nightRate * totalHoursPerMonth;
                        return (monthlyVal / workDaysPerMonth) * days;
                    }, workDaysPerMonth);
                    
                    const detailsStr = `Salário Hora: Base / 220\n` +
                        `Adicional Noturno: 20%\n` +
                        (period.hoursPerDay ? `Horas/Dia (Base): ${period.hoursPerDay}\n` : '') +
                        (period.daysPerMonth ? `Dias/Mês: ${period.daysPerMonth}\n` : '') +
                        `Horas Base/Mês (22h-05h): ${period.hoursPerMonth}\n` +
                        (extendedHoursPerMonth > 0 ? `Horas Prorrogadas/Mês (Súmula 60): ${extendedHoursPerMonth.toFixed(2)}\n` : '') +
                        `Total Horas/Mês (Base + Prorrogação): ${totalHoursPerMonth.toFixed(2)}\n` +
                        `Meses Calculados: ${result.months}\n` +
                        `Total: ${formatCurrency(result.value)}\n\n` +
                        (extendedDetails ? extendedDetails + '\n\n' : '') +
                        `Memória (Últimos 12 meses):\n${result.memory.slice(-12).join('\n')}`;

                    results.push({ 
                        desc: `Adicional Noturno (${totalHoursPerMonth.toFixed(1)}h/mês - ${result.months} meses - Período ${idx + 1})`, 
                        value: result.value, 
                        category: 'Adicionais',
                        details: detailsStr
                    });
                    results.push({ 
                        desc: `Reflexos Ad. Noturno (Férias, 13º, FGTS, DSR) - Período ${idx + 1}`, 
                        value: result.value * 0.35, 
                        category: 'Reflexos',
                        details: `Base de Cálculo: ${formatCurrency(result.value)}\nReflexos Estimados (35%): DSR, Férias + 1/3, 13º Salário, FGTS + 40%`
                    });
                }
            });
        }

        // Intrajornada
        if (calcData.intrajornada && calcData.intrajornada.active && salary) {
            calcData.intrajornada.periods.forEach((period, idx) => {
                const pStart = parseDate(period.startDate) || start;
                const pEnd = parseDate(period.endDate) || end;
                
                if (pStart && pEnd && period.hoursPerDay > 0) {
                    const workDaysPerMonth = period.daysPerMonth || 26; // Default to 26 as per user request

                    const result = calculateBenefitExact(pStart, pEnd, calcData.salaryHistory, salary, (sal, days) => {
                        const hourlyRate = sal / 220;
                        const intraRate = hourlyRate * 1.5;
                        
                        // User formula: (Sal/220) * Hours/Day * DaysWorked * 1.5
                        const monthlyVal = intraRate * period.hoursPerDay * workDaysPerMonth;
                        return (monthlyVal / workDaysPerMonth) * days;
                    }, workDaysPerMonth);
                    
                    const detailsStr = `Salário Hora: Base / 220\n` +
                        `Adicional (50%): 1.5x\n` +
                        `Horas/Dia: ${period.hoursPerDay}\n` +
                        `Dias Trabalhados/Mês: ${workDaysPerMonth}\n` +
                        `Meses Calculados: ${result.months}\n` +
                        `Total: ${formatCurrency(result.value)}\n\n` +
                        `Memória (Últimos 12 meses):\n${result.memory.slice(-12).join('\n')}`;

                    results.push({ 
                        desc: `Adicional Intrajornada (${period.hoursPerDay}h/dia - ${result.months} meses)`, 
                        value: result.value, 
                        category: 'Adicionais',
                        details: detailsStr
                    });
                    results.push({ 
                        desc: `Reflexos Intrajornada (Férias, 13º, FGTS, DSR)`, 
                        value: result.value * 0.35, 
                        category: 'Reflexos',
                        details: `Base de Cálculo: ${formatCurrency(result.value)}\nReflexos Estimados (35%): DSR, Férias + 1/3, 13º Salário, FGTS + 40%`
                    });
                }
            });
        }
    }

    // 6. Diferença Salarial
    calcData.wageGap.forEach((gap, idx) => {
        const gapStart = parseDate(gap.startDate) || start;
        const gapEnd = parseDate(gap.endDate) || end;
        
        if (gapStart && gapEnd && gap.floorSalary > gap.paidSalary) {
            const result = calculateBenefitExact(gapStart, gapEnd, calcData.salaryHistory, salary, (sal, days) => {
                // Here we use the gap values directly, ignoring history salary as we have explicit paidSalary
                const monthlyDiff = gap.floorSalary - gap.paidSalary;
                return (monthlyDiff / 30) * days;
            });

            results.push({ 
                desc: `Diferença Salarial (Período ${idx + 1}: ${result.months} meses)`, 
                value: result.value, 
                category: 'Salários',
                details: `Piso Salarial: ${formatCurrency(gap.floorSalary)}\nSalário Pago: ${formatCurrency(gap.paidSalary)}\nDiferença Mensal: ${formatCurrency(gap.floorSalary - gap.paidSalary)}\nMeses Calculados: ${result.months}\nTotal: ${formatCurrency(result.value)}\n\nMemória (Últimos 12 meses):\n${result.memory.slice(-12).join('\n')}`
            });
            const reflex = result.value * 0.3;
            results.push({ 
                desc: `Reflexos s/ Diferença Salarial (Est. 30%)`, 
                value: reflex, 
                category: 'Reflexos',
                details: `Base de Cálculo: ${formatCurrency(result.value)}\nReflexos Estimados (30%): Férias + 1/3, 13º Salário, FGTS`
            });
        }
    });

        calcData.overtime.forEach((ot, idx) => {
            const otStart = parseDate(ot.startDate) || start;
            const otEnd = parseDate(ot.endDate) || end;
            const workDaysPerMonth = 26; // Standard work days as per user request for HE proportionality
            
            if (otStart && otEnd && ot.hoursPerMonth > 0) {
                const perc = ot.percentage === -1 ? (ot.customPercentage || 50) : ot.percentage;
                
                const result = calculateBenefitExact(otStart, otEnd, calcData.salaryHistory, salary, (sal, days) => {
                    const hourlyRate = sal / 220;
                    const otRate = hourlyRate * (1 + (perc / 100));
                    const monthlyVal = otRate * ot.hoursPerMonth;
                    // User formula for proportional: (MonthlyVal / workDaysPerMonth) * DaysWorked
                    return (monthlyVal / workDaysPerMonth) * days;
                }, workDaysPerMonth);
            
            results.push({ 
                desc: `Horas Extras ${perc}% (${ot.hoursPerMonth}h/mês x ${result.months} meses)`, 
                value: result.value, 
                category: 'Horas Extras',
                details: `Salário Hora: Base / 220\nPercentual: ${perc}%\nHoras/Mês: ${ot.hoursPerMonth}\nMeses Calculados: ${result.months}\nTotal: ${formatCurrency(result.value)}\n\nMemória (Últimos 12 meses):\n${result.memory.slice(-12).join('\n')}`
            });
            
            if (ot.applyDsr) {
                const dsr = result.value * 0.1666;
                results.push({ 
                    desc: `DSR sobre H.E. (Lote ${idx+1})`, 
                    value: dsr, 
                    category: 'Horas Extras',
                    details: `Base de Cálculo (Horas Extras): ${formatCurrency(result.value)}\nEstimativa DSR (1/6): 16,66%\nTotal: ${formatCurrency(dsr)}`
                });
            }
        }
    });

    // 7.1 Feriados, Domingos e Banco de Horas
    if (calcData.uncompensatedHolidays && calcData.uncompensatedHolidays > 0) {
        const dailyRate = salary / 30;
        const holidaysValue = calcData.uncompensatedHolidays * (dailyRate * 2);
        results.push({
            desc: `Feriados Trabalhados em Dobro (${calcData.uncompensatedHolidays} dias)`,
            value: holidaysValue,
            category: 'Horas Extras',
            details: `Salário Dia: ${formatCurrency(dailyRate)}\nDias Trabalhados: ${calcData.uncompensatedHolidays}\nCálculo: ${calcData.uncompensatedHolidays} x (${formatCurrency(dailyRate)} x 2) = ${formatCurrency(holidaysValue)}\nFundamento: Súmula 146 do TST`
        });
    }

    if (calcData.uncompensatedSundays && calcData.uncompensatedSundays > 0) {
        const dailyRate = salary / 30;
        const sundaysValue = calcData.uncompensatedSundays * (dailyRate * 2);
        results.push({
            desc: `Domingos Trabalhados em Dobro (${calcData.uncompensatedSundays} dias)`,
            value: sundaysValue,
            category: 'Horas Extras',
            details: `Salário Dia: ${formatCurrency(dailyRate)}\nDias Trabalhados: ${calcData.uncompensatedSundays}\nCálculo: ${calcData.uncompensatedSundays} x (${formatCurrency(dailyRate)} x 2) = ${formatCurrency(sundaysValue)}\nFundamento: Súmula 146 do TST`
        });
    }

    if (calcData.employeeGender === 'F' && calcData.consecutiveSundaysWorked && calcData.consecutiveSundaysWorked > 0) {
        const dailyRate = salary / 30;
        const consecutiveSundaysValue = calcData.consecutiveSundaysWorked * (dailyRate * 2);
        results.push({
            desc: `Domingos Consecutivos - Mulheres (${calcData.consecutiveSundaysWorked} dias)`,
            value: consecutiveSundaysValue,
            category: 'Horas Extras',
            details: `Salário Dia: ${formatCurrency(dailyRate)}\nDomingos Irregulares: ${calcData.consecutiveSundaysWorked}\nCálculo: ${calcData.consecutiveSundaysWorked} x (${formatCurrency(dailyRate)} x 2) = ${formatCurrency(consecutiveSundaysValue)}\nFundamento: Art. 386 da CLT e ADPF 151 do STF`
        });
    }

    if (calcData.timeBankBalance && calcData.timeBankBalance > 0) {
        const hourlyRate = salary / 220;
        const perc = calcData.timeBankOvertimePercentage || 50;
        const timeBankRate = hourlyRate * (1 + (perc / 100));
        const timeBankValue = calcData.timeBankBalance * timeBankRate;
        results.push({
            desc: `Saldo de Banco de Horas (${calcData.timeBankBalance}h a ${perc}%)`,
            value: timeBankValue,
            category: 'Horas Extras',
            details: `Salário Hora: ${formatCurrency(hourlyRate)}\nAdicional: ${perc}%\nHora Extra: ${formatCurrency(timeBankRate)}\nTotal de Horas: ${calcData.timeBankBalance}\nCálculo: ${calcData.timeBankBalance} x ${formatCurrency(timeBankRate)} = ${formatCurrency(timeBankValue)}`
        });
    }

    // 8. Estabilidade Provisória
    let stabilityFgts = 0;
    if (calcData.stability.active && salary) {
        const stabEnd = parseDate(calcData.stability.endDate);
        const stabStart = end || new Date();
        
        if (stabEnd && stabEnd > stabStart) {
            const monthsStab = diffMonths(stabStart, stabEnd);
            const stabValue = salary * monthsStab;
            const typeLabel = calcData.stability.type === 'gestante' ? 'Gestante' : 
                              calcData.stability.type === 'acidentaria' ? 'Acidentária' : 
                              calcData.stability.type === 'cipa' ? 'CIPA' : 'Outros';
            
            let legalBasis = '';
            if (calcData.stability.type === 'gestante') legalBasis = 'Art. 10, II, "b" do ADCT e Súmula 244 do TST';
            else if (calcData.stability.type === 'acidentaria') legalBasis = 'Art. 118 da Lei 8.213/91 e Súmula 378 do TST';
            else if (calcData.stability.type === 'cipa') legalBasis = 'Art. 10, II, "a" do ADCT e Súmula 339 do TST';
            else legalBasis = 'Legislação Específica / Convenção Coletiva';

            results.push({ 
                desc: `Indenização Estabilidade ${typeLabel} (${monthsStab} meses)`, 
                value: stabValue, 
                category: 'Indenizações',
                details: `Período de Estabilidade: ${stabStart.toLocaleDateString('pt-BR')} a ${stabEnd.toLocaleDateString('pt-BR')}\n` +
                         `Base de Cálculo (Salário): ${formatCurrency(salary)}\n` +
                         `Meses de Estabilidade: ${monthsStab}\n` +
                         `Cálculo: ${formatCurrency(salary)} x ${monthsStab} meses = ${formatCurrency(stabValue)}\n` +
                         `Fundamento Legal: ${legalBasis}`
            });
            
            // FGTS sobre estabilidade (Súmula 396 TST - período de estabilidade conta como tempo de serviço)
            stabilityFgts = stabValue * 0.08;
            results.push({ 
                desc: `FGTS sobre Estabilidade (${monthsStab} meses)`, 
                value: stabilityFgts, 
                category: 'FGTS',
                details: `Base de Cálculo (Indenização Estabilidade): ${formatCurrency(stabValue)}\n` +
                         `Alíquota FGTS: 8%\n` +
                         `Cálculo: ${formatCurrency(stabValue)} x 8% = ${formatCurrency(stabilityFgts)}\n` +
                         `Fundamento Legal: Súmula 396 do TST (tempo de serviço fictício)`
            });
        }
    }

    // 9. Direitos CCT
    if (calcData.cctRights && calcData.cctRights.length > 0) {
        calcData.cctRights.forEach(right => {
            const val = parseBrazilianNumber(right.value);
            if (val > 0) {
                let quantity = 0;
                let unit = '';
                let total = 0;

                let customDesc = '';

                if (right.frequency === 'daily') {
                    const start = parseDate(right.startDate);
                    const end = parseDate(right.endDate);
                    if (start && end) {
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
                        
                        if (right.daysPerMonth && right.daysPerMonth > 0) {
                            // Calculate based on fixed days per month
                            // Logic: (Total Days / 30) * Days Per Month
                            const months = totalDays / 30;
                            quantity = Math.round(months * right.daysPerMonth);
                            unit = 'dias';
                            total = val * quantity;
                            customDesc = `CCT: ${right.name} (${months.toFixed(1)} meses x ${right.daysPerMonth} dias = ${quantity} dias)`;
                        } else {
                            // Default: pay every day
                            quantity = totalDays;
                            unit = 'dias';
                            total = val * quantity;
                        }
                    }
                } else if (right.frequency === 'monthly') {
                    const start = parseDate(right.startDate);
                    const end = parseDate(right.endDate);
                    if (start && end) {
                        quantity = diffMonths(start, end);
                        unit = 'meses';
                        total = val * quantity;
                    }
                } else if (right.frequency === 'annual') {
                    if (right.startYear) {
                        quantity = 1;
                        unit = 'ano';
                        total = val * quantity;
                        customDesc = `CCT: ${right.name} (Ref. ${right.startYear})`;
                    }
                }

                if (total > 0) {
                    let details = '';
                    if (right.frequency === 'daily') {
                         details = `Cálculo Diário:\nValor Unitário: ${formatCurrency(val)}\nQuantidade: ${quantity} dias\nTotal: ${formatCurrency(total)}`;
                         if (right.daysPerMonth) {
                             details += `\n(Considerando ${right.daysPerMonth} dias trabalhados por mês)`;
                         }
                    } else if (right.frequency === 'monthly') {
                         details = `Cálculo Mensal:\nValor Mensal: ${formatCurrency(val)}\nQuantidade: ${quantity} meses\nTotal: ${formatCurrency(total)}`;
                    } else {
                         details = `Cálculo Anual:\nValor Anual: ${formatCurrency(val)}\nQuantidade: ${quantity} ano(s)\nTotal: ${formatCurrency(total)}`;
                    }
                    
                    const category = right.integratesSalary ? 'Convenção Coletiva (Salarial)' : 'Convenção Coletiva (Indenizatória)';
                    if (right.integratesSalary) details += `\n* Integra Salário para FGTS`;
                    
                    results.push({ desc: customDesc || `CCT: ${right.name} (${quantity} ${unit})`, value: total, category, details });
                }
            }
        });
    }

    // 10. FGTS + 40%
    let totalFgtsDeposited = 0;
    let totalFgtsMissing = 0;
    let missingMonthsCount = 0;
    let depositedMonthsCount = 0;
    let calculationDescription = "";
    let missingDetails = "";

    // A. FGTS Depositado
    if (calcData.fgtsAllDeposited) {
        if (calcData.hasFgtsBalance > 0) {
            totalFgtsDeposited = calcData.hasFgtsBalance;
            depositedMonthsCount = diffMonths(start || new Date(), end || new Date()); // Estimate
        } else if (start && end) {
            const result = calculateFgtsExact(start, end, calcData.salaryHistory, salary);
            totalFgtsDeposited = result.value;
            depositedMonthsCount = result.months;
        }
    } else {
        totalFgtsDeposited = Number(calcData.hasFgtsBalance) || 0;
    }

    // B. FGTS Não Depositado
    if (calcData.fgtsNoDeposits && start && end) {
        const result = calculateFgtsExact(start, end, calcData.salaryHistory, salary);
        totalFgtsMissing = result.value;
        missingMonthsCount = result.months;
        calculationDescription = " (Período Integral)";
        missingDetails = `Cálculo realizado mês a mês sobre o salário histórico.\nCompetências Calculadas: ${missingMonthsCount}\nTotal: ${formatCurrency(totalFgtsMissing)}`;
    } else {
        if (calcData.fgtsSpecificMissingPeriods.length > 0) {
            calcData.fgtsSpecificMissingPeriods.forEach(p => {
                const pStart = parseDate(p.startDate);
                const pEnd = parseDate(p.endDate);
                if (pStart && pEnd) {
                    const result = calculateFgtsExact(pStart, pEnd, calcData.salaryHistory, salary);
                    totalFgtsMissing += result.value;
                    missingMonthsCount += result.months;
                }
            });
        } else if (calcData.unpaidFgtsMonths > 0) {
             totalFgtsMissing = (salary * 0.08) * calcData.unpaidFgtsMonths;
             missingMonthsCount = calcData.unpaidFgtsMonths;
             missingDetails = `Cálculo Estimado: ${calcData.unpaidFgtsMonths} meses * (${formatCurrency(salary)} * 8%)`;
        }
    }

    if (totalFgtsMissing > 0) {
        results.push({ 
            desc: `FGTS Não Depositado${calculationDescription} - ${missingMonthsCount} meses`, 
            value: totalFgtsMissing, 
            category: 'FGTS',
            details: missingDetails
        });
    }
    
    // FGTS sobre Verbas Rescisórias
    const verbasSalariais = results.filter(r => 
        ['Rescisórias', 'Salários', 'Horas Extras', 'Adicionais', 'Convenção Coletiva (Salarial)'].includes(r.category) && 
        !r.desc.includes('Férias') // Férias indenizadas não incide FGTS
    );
    
    const baseFgtsRescisorio = verbasSalariais.reduce((sum, item) => sum + item.value, 0);
    const fgtsOnRescisory = baseFgtsRescisorio * 0.08;
    
    if (fgtsOnRescisory > 0) {
        let composition = "Composição da Base de Cálculo:\n";
        verbasSalariais.forEach(v => {
            // Shorten description for cleaner list
            let shortDesc = v.desc.split('(')[0].trim();
            if (shortDesc.length > 40) shortDesc = shortDesc.substring(0, 37) + '...';
            composition += `(+) ${shortDesc}: ${formatCurrency(v.value)}\n`;
        });

        results.push({ 
            desc: `FGTS sobre Verbas Rescisórias`, 
            value: fgtsOnRescisory, 
            category: 'FGTS',
            details: `${composition}(=) Base Total: ${formatCurrency(baseFgtsRescisorio)}\nAlíquota: 8%\nTotal: ${formatCurrency(fgtsOnRescisory)}`
        });
    }
    
    // Base para multa de 40%:
    const totalFgtsParaMulta = totalFgtsDeposited + totalFgtsMissing + stabilityFgts + fgtsOnRescisory;
    
    if (calcData.terminationReason === 'sem_justa_causa' || calcData.terminationReason === 'rescisao_indireta' || calcData.terminationReason === 'sem_anotacao') {
        const multa40Total = totalFgtsParaMulta * 0.40;
        const multa40Paga = calcData.fgtsPenaltyAllDeposited ? multa40Total : (Number(calcData.hasFgtsPenaltyBalance) || 0);
        const multa40Restante = Math.max(0, multa40Total - multa40Paga);
        
        if (multa40Restante > 0) {
            let fineDetails = `Base de Cálculo da Multa de 40%:\n`;
            if (totalFgtsDeposited > 0) fineDetails += `(+) FGTS Depositado: ${formatCurrency(totalFgtsDeposited)}\n`;
            if (totalFgtsMissing > 0) fineDetails += `(+) FGTS Não Depositado: ${formatCurrency(totalFgtsMissing)}\n`;
            if (fgtsOnRescisory > 0) fineDetails += `(+) FGTS sobre Rescisão: ${formatCurrency(fgtsOnRescisory)}\n`;
            if (stabilityFgts > 0) fineDetails += `(+) FGTS sobre Estabilidade: ${formatCurrency(stabilityFgts)}\n`;
            fineDetails += `(=) Base Total: ${formatCurrency(totalFgtsParaMulta)}\n`;
            fineDetails += `(x) Alíquota (40%): ${formatCurrency(multa40Total)}\n`;
            if (multa40Paga > 0) fineDetails += `(-) Valor Já Pago: ${formatCurrency(multa40Paga)}\n`;
            fineDetails += `(=) Multa em Falta: ${formatCurrency(multa40Restante)}`;

            results.push({ 
                desc: `Multa 40% do FGTS (Em Falta)`, 
                value: multa40Restante, 
                category: 'FGTS',
                details: fineDetails
            });
        }
    }

    // 11. Multas Art. 477 e 467
    if (calcData.applyFine477 && salary) {
        results.push({ 
            desc: `Multa Art. 477 (Atraso)`, 
            value: salary, 
            category: 'Multas',
            details: `Valor equivalente a um salário base do empregado.\nBase: ${formatCurrency(salary)}`
        });
    }

    if (calcData.applyFine467) {
        // User requested categories for Art. 467:
        // Saldo de Salário, Aviso Prévio, 13º, Férias, Intrajornada, Horas Extras, DSR, Reflexos
        const includedCategories = ['Rescisórias', 'Horas Extras', 'Adicionais', 'Reflexos'];
        
        const verbasParaMulta = results.filter(r => includedCategories.includes(r.category));
        const rescisorySum = verbasParaMulta.reduce((acc, curr) => acc + curr.value, 0);
            
        let composition = "Composição da Base de Cálculo:\n";
        verbasParaMulta.forEach(v => {
            let shortDesc = v.desc.split('(')[0].trim();
            if (shortDesc.length > 40) shortDesc = shortDesc.substring(0, 37) + '...';
            composition += `(+) ${shortDesc}: ${formatCurrency(v.value)}\n`;
        });

        const fine467 = rescisorySum * 0.5;
        results.push({ 
            desc: `Multa Art. 467 (50% Incontroverso)`, 
            value: fine467, 
            category: 'Multas',
            details: `${composition}\nTotal da Base: ${formatCurrency(rescisorySum)}\nMulta (50%): ${formatCurrency(fine467)}`
        });
    }

    // 12. Danos Morais
    if (calcData.moralDamages > 0) {
        results.push({ desc: `Indenização por Danos Morais`, value: Number(calcData.moralDamages), category: 'Indenizações' });
    }

    // 13. Honorários Advocatícios
    const currentTotal = results.reduce((acc, curr) => acc + curr.value, 0);
    if (calcData.attorneyFees > 0) {
        let composition = "Composição da Base de Cálculo (Total Bruto):\n";
        results.forEach(v => {
            let shortDesc = v.desc.split('(')[0].trim();
            if (shortDesc.length > 40) shortDesc = shortDesc.substring(0, 37) + '...';
            composition += `(+) ${shortDesc}: ${formatCurrency(v.value)}\n`;
        });

        const feesValue = currentTotal * (calcData.attorneyFees / 100);
        results.push({ 
            desc: `Honorários Advocatícios (${calcData.attorneyFees}%)`, 
            value: feesValue, 
            category: 'Honorários',
            details: `${composition}\nBase de Cálculo (Total Bruto Estimado): ${formatCurrency(currentTotal)}\nPercentual: ${calcData.attorneyFees}%\nValor: ${formatCurrency(feesValue)}`
        });
    }

    // 14. Integração de Salário por Fora (Reflexos)
    calcData.salaryOffTheBooks.forEach((off, idx) => {
        const offStart = parseDate(off.startDate) || start;
        const offEnd = parseDate(off.endDate) || end;
        
        if (offStart && offEnd && off.amount > 0) {
            // Cálculo do valor proporcional acumulado no período
            const result = calculateBenefitExact(offStart, offEnd, [], off.amount, (val, days) => {
                return (val / 30) * days;
            });
            
            const totalOff = result.value;
            const months = result.months;

            // 1. Reflexo em DSR (1/6) - Súmula 172 TST
            const reflexDsr = totalOff * 0.1666;
            
            // 2. Reflexo em 13º Salário (1/12 por mês)
            const reflex13 = (totalOff / 12);
            
            // 3. Reflexo em Férias + 1/3 (1/12 + 1/3)
            const reflexVac = (totalOff / 12) * 1.3333;
            
            // 4. Reflexo em FGTS (8%)
            const reflexFgts = totalOff * 0.08;
            
            // 5. Reflexo em Multa FGTS (40% sobre o reflexo do FGTS)
            const reflexFgtsFine = reflexFgts * 0.4;
            
            // 6. Reflexo em Aviso Prévio (se indenizado e se o período cobre o fim do contrato)
            let reflexNotice = 0;
            if (shouldPayNotice && offEnd >= (end || new Date())) {
                reflexNotice = (off.amount / 30) * noticeDays;
            }

            // 7. Reflexos em Adicionais (Periculosidade e Noturno)
            let reflexPeri = 0;
            if (calcData.periculosidade) {
                reflexPeri = totalOff * 0.30;
            }

            let reflexNoturno = 0;
            if (calcData.adicionalNoturno.active) {
                calcData.adicionalNoturno.periods.forEach(p => {
                    const pStart = parseDate(p.startDate) || start;
                    const pEnd = parseDate(p.endDate) || end;
                    
                    if (pStart && pEnd) {
                        const overlapStart = offStart > pStart ? offStart : pStart;
                        const overlapEnd = offEnd < pEnd ? offEnd : pEnd;
                        
                        if (overlapStart && overlapEnd && overlapStart < overlapEnd && p.hoursPerMonth > 0) {
                            const resultNot = calculateBenefitExact(overlapStart, overlapEnd, [], off.amount, (val, days) => {
                                const hourlyRate = val / 220;
                                const nightRate = hourlyRate * 0.20;
                                return (nightRate * p.hoursPerMonth / 30) * days;
                            });
                            reflexNoturno += resultNot.value;
                        }
                    }
                });
            }

            let reflexHe = 0;
            calcData.overtime.forEach(ot => {
                const otStart = parseDate(ot.startDate) || start;
                const otEnd = parseDate(ot.endDate) || end;
                if (otStart && otEnd) {
                    const overlapStart = offStart > otStart ? offStart : otStart;
                    const overlapEnd = offEnd < otEnd ? offEnd : otEnd;
                    
                    if (overlapStart && overlapEnd && overlapStart < overlapEnd && ot.hoursPerMonth > 0) {
                        const perc = ot.percentage === -1 ? (ot.customPercentage || 50) : ot.percentage;
                        const resultHe = calculateBenefitExact(overlapStart, overlapEnd, [], off.amount, (val, days) => {
                            const hourlyRate = val / 220;
                            const otRate = hourlyRate * (1 + (perc / 100));
                            return (otRate * ot.hoursPerMonth / 30) * days;
                        });
                        reflexHe += resultHe.value;
                    }
                }
            });

            const totalReflex = reflexDsr + reflex13 + reflexVac + reflexFgts + reflexFgtsFine + reflexNotice + reflexPeri + reflexNoturno + reflexHe;

            results.push({
                desc: `Integração Salário por Fora (Reflexos - Período ${idx + 1})`,
                value: totalReflex,
                category: 'Reflexos',
                details: `Valor Mensal "Por Fora": ${formatCurrency(off.amount)}\n` +
                         `Período: ${offStart.toLocaleDateString('pt-BR')} a ${offEnd.toLocaleDateString('pt-BR')}\n` +
                         `Meses Calculados: ${months}\n` +
                         `Total Acumulado no Período: ${formatCurrency(totalOff)}\n\n` +
                         `Reflexos Calculados:\n` +
                         `- DSR (1/6): ${formatCurrency(reflexDsr)}\n` +
                         `- 13º Salário: ${formatCurrency(reflex13)}\n` +
                         `- Férias + 1/3: ${formatCurrency(reflexVac)}\n` +
                         `- FGTS (8%): ${formatCurrency(reflexFgts)}\n` +
                         `- Multa FGTS (40%): ${formatCurrency(reflexFgtsFine)}\n` +
                         (reflexNotice > 0 ? `- Aviso Prévio (${noticeDays} dias): ${formatCurrency(reflexNotice)}\n` : '') +
                         (reflexPeri > 0 ? `- Adicional Periculosidade (30%): ${formatCurrency(reflexPeri)}\n` : '') +
                         (reflexNoturno > 0 ? `- Adicional Noturno: ${formatCurrency(reflexNoturno)}\n` : '') +
                         (reflexHe > 0 ? `- Horas Extras: ${formatCurrency(reflexHe)}\n` : '') +
                         `Total de Reflexos Devidos: ${formatCurrency(totalReflex)}\n\n` +
                         `Fundamento: Art. 457, §1º da CLT.`
            });
        }
    });

    // 15. Deduções
    if (calcData.severancePaid > 0) {
        results.push({ desc: `Valor Pago na Rescisão (Dedução)`, value: -Math.abs(calcData.severancePaid), category: 'Deduções' });
    }

    return results;
};

interface LaborCalcProps {
    clients?: ClientRecord[];
    contracts?: ContractRecord[];
    savedCalculations?: CalculationRecord[];
    onSaveCalculation?: (calc: CalculationRecord) => void;
    onDeleteCalculation?: (id: string) => void;
}

export default function LaborCalc({ clients = [], contracts = [], savedCalculations = [], onSaveCalculation, onDeleteCalculation }: LaborCalcProps) {
  const [data, setData] = useState<LaborData>(INITIAL_LABOR_DATA);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [calcResult, setCalcResult] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [showSavedList, setShowSavedList] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // --- Handlers ---
  const handleInputChange = (field: keyof LaborData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedName = e.target.value;
      if (!selectedName) return;

      // Tenta achar em clientes ou contratos
      const client = clients.find(c => c.name === selectedName);
      const contract = contracts.find(c => `${c.firstName} ${c.lastName}` === selectedName);

      if (client) {
          setData(prev => ({ ...prev, employeeName: client.name }));
      } else if (contract) {
          setData(prev => ({ ...prev, employeeName: `${contract.firstName} ${contract.lastName}` }));
      }
  };

  const addOvertimeBatch = () => {
    setData(prev => ({
      ...prev,
      overtime: [...prev.overtime, {
        id: Math.random().toString(),
        percentage: 50,
        hoursPerMonth: 0,
        startDate: prev.startDate,
        endDate: prev.endDate,
        applyDsr: true
      }]
    }));
  };

  const removeOvertimeBatch = (id: string) => {
    setData(prev => ({ ...prev, overtime: prev.overtime.filter(o => o.id !== id) }));
  };

  const addWageGap = () => {
      setData(prev => ({
          ...prev,
          wageGap: [...prev.wageGap, {
              active: true,
              floorSalary: 0,
              paidSalary: prev.baseSalary,
              startDate: prev.startDate,
              endDate: prev.endDate
          }]
      }));
  };

  const removeWageGap = (idx: number) => {
      const newGaps = [...data.wageGap];
      newGaps.splice(idx, 1);
      setData(prev => ({ ...prev, wageGap: newGaps }));
  };

  const addNightShiftPeriod = () => {
    setData(prev => ({
      ...prev,
      adicionalNoturno: {
        ...prev.adicionalNoturno,
        periods: [
          ...prev.adicionalNoturno.periods,
          {
            id: Math.random().toString(),
            hoursPerMonth: 0,
            startDate: prev.startDate,
            endDate: prev.endDate
          }
        ]
      }
    }));
  };

  const removeNightShiftPeriod = (id: string) => {
    setData(prev => ({
      ...prev,
      adicionalNoturno: {
        ...prev.adicionalNoturno,
        periods: prev.adicionalNoturno.periods.filter(p => p.id !== id)
      }
    }));
  };

  const addIntrajornadaPeriod = () => {
      const newId = Math.random().toString(36).substr(2, 9);
      setData(prev => ({
          ...prev,
          intrajornada: {
              ...prev.intrajornada,
              periods: [...prev.intrajornada.periods, { id: newId, hoursPerDay: 1, startDate: data.startDate, endDate: data.endDate }]
          }
      }));
  };

  const removeIntrajornadaPeriod = (id: string) => {
      setData(prev => ({
          ...prev,
          intrajornada: {
              ...prev.intrajornada,
              periods: prev.intrajornada.periods.filter(p => p.id !== id)
          }
      }));
  };

  const addFgtsPeriod = () => {
      const newId = Math.random().toString(36).substr(2, 9);
      setData(prev => ({
          ...prev,
          fgtsSpecificMissingPeriods: [...prev.fgtsSpecificMissingPeriods, { id: newId, startDate: prev.startDate, endDate: prev.endDate }]
      }));
  };

  const removeFgtsPeriod = (id: string) => {
      setData(prev => ({
          ...prev,
          fgtsSpecificMissingPeriods: prev.fgtsSpecificMissingPeriods.filter(p => p.id !== id)
      }));
  };

  const addSalaryOffTheBooks = () => {
    setData(prev => ({
      ...prev,
      salaryOffTheBooks: [...prev.salaryOffTheBooks, {
        id: Math.random().toString(36).substr(2, 9),
        amount: 0,
        startDate: prev.startDate,
        endDate: prev.endDate
      }]
    }));
  };

  const removeSalaryOffTheBooks = (id: string) => {
    setData(prev => ({
      ...prev,
      salaryOffTheBooks: prev.salaryOffTheBooks.filter(s => s.id !== id)
    }));
  };

  const updateSalaryOffTheBooks = (id: string, field: string, value: any) => {
    setData(prev => ({
      ...prev,
      salaryOffTheBooks: prev.salaryOffTheBooks.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const addContractualSchedule = () => {
    setData(prev => ({
      ...prev,
      contractualSchedule: {
        ...prev.contractualSchedule,
        schedules: [
          ...(prev.contractualSchedule.schedules || []),
          {
            id: Math.random().toString(36).substr(2, 9),
            days: 'Sábado',
            selectedDays: [6],
            startTime: '08:00',
            endTime: '12:00',
            breakStartTime: '',
            breakEndTime: ''
          }
        ]
      }
    }));
  };

  const removeContractualSchedule = (id: string) => {
    setData(prev => ({
      ...prev,
      contractualSchedule: {
        ...prev.contractualSchedule,
        schedules: prev.contractualSchedule.schedules.filter(s => s.id !== id)
      }
    }));
  };

  const updateContractualScheduleItem = (id: string, field: string, value: any) => {
    setData(prev => ({
      ...prev,
      contractualSchedule: {
        ...prev.contractualSchedule,
        schedules: prev.contractualSchedule.schedules.map(s => 
          s.id === id ? { ...s, [field]: value } : s
        )
      }
    }));
  };

  const updateFgtsPeriod = (id: string, field: 'startDate' | 'endDate', value: string) => {
      setData(prev => ({
          ...prev,
          fgtsSpecificMissingPeriods: prev.fgtsSpecificMissingPeriods.map(p => p.id === id ? { ...p, [field]: value } : p)
      }));
  };

  const addCctRight = () => {
      const newId = Math.random().toString(36).substr(2, 9);
      setData(prev => ({
          ...prev,
          cctRights: [
              ...prev.cctRights,
              { 
                  id: newId, 
                  name: '', 
                  frequency: 'monthly',
                  startDate: '',
                  endDate: '',
                  startYear: new Date().getFullYear(),
                  endYear: new Date().getFullYear(),
                  daysPerMonth: 0,
                  value: '', 
                  parsedValue: 0,
                  integratesSalary: false
              }
          ]
      }));
  };

  const removeCctRight = (id: string) => {
      setData(prev => ({
          ...prev,
          cctRights: prev.cctRights.filter(r => r.id !== id)
      }));
  };

  const updateCctRight = (id: string, field: keyof LaborData['cctRights'][0], value: any) => {
      setData(prev => ({
          ...prev,
          cctRights: prev.cctRights.map(r => {
              if (r.id === id) {
                  const updated = { ...r, [field]: value };
                  if (field === 'value') {
                      updated.parsedValue = parseBrazilianNumber(String(value));
                  }
                  return updated;
              }
              return r;
          })
      }));
  };

  const addVacationPeriod = () => {
      setData(prev => ({
          ...prev,
          vacationPeriods: [
              ...prev.vacationPeriods,
              { id: Math.random().toString(), startDate: '', endDate: '', isDouble: false }
          ]
      }));
  };

  const removeVacationPeriod = (id: string) => {
      setData(prev => ({
          ...prev,
          vacationPeriods: prev.vacationPeriods.filter(v => v.id !== id)
      }));
  };

  const updateVacationPeriod = (id: string, field: 'startDate' | 'endDate' | 'isDouble', value: any) => {
      setData(prev => ({
          ...prev,
          vacationPeriods: prev.vacationPeriods.map(v => v.id === id ? { ...v, [field]: value } : v)
      }));
  };

  const addSalaryHistory = () => {
      setData(prev => ({
          ...prev,
          salaryHistory: [
              ...prev.salaryHistory,
              { id: Math.random().toString(), startDate: prev.startDate, endDate: prev.endDate, salary: prev.baseSalary }
          ]
      }));
  };

  const removeSalaryHistory = (id: string) => {
      setData(prev => ({
          ...prev,
          salaryHistory: prev.salaryHistory.filter(s => s.id !== id)
      }));
  };

  const updateSalaryHistory = (id: string, field: keyof LaborData['salaryHistory'][0], value: any) => {
      setData(prev => ({
          ...prev,
          salaryHistory: prev.salaryHistory.map(s => s.id === id ? { ...s, [field]: value } : s)
      }));
  };

  const add13thPeriod = () => {
      setData(prev => ({
          ...prev,
          unpaid13thPeriods: [
              ...prev.unpaid13thPeriods,
              { id: Math.random().toString(), year: new Date().getFullYear() - 1, month: 12 }
          ]
      }));
  };

  const remove13thPeriod = (id: string) => {
      setData(prev => ({
          ...prev,
          unpaid13thPeriods: prev.unpaid13thPeriods.filter(p => p.id !== id)
      }));
  };

  const update13thPeriod = (id: string, field: 'year' | 'month', value: number) => {
      setData(prev => ({
          ...prev,
          unpaid13thPeriods: prev.unpaid13thPeriods.map(p => p.id === id ? { ...p, [field]: value } : p)
      }));
  };

  const handleSave = async (forceNew = false) => {
      if (!data.employeeName) {
          alert("Informe o nome do cliente para salvar.");
          return;
      }
      
      const newId = Math.random().toString(36).substr(2, 9);
      const recordId = forceNew ? newId : (editingId || newId);

      const record: CalculationRecord = {
          id: recordId,
          date: new Date().toISOString(),
          employeeName: data.employeeName,
          totalValue: totalValue,
          data: data
      };

      try {
          await supabaseService.saveLaborCalculation(record);
          
          if (onSaveCalculation) {
              onSaveCalculation(record);
          }
          setEditingId(recordId);
          alert(editingId && !forceNew ? "Cálculo atualizado com sucesso!" : "Cálculo salvo com sucesso!");
      } catch (error) {
          console.error("Error saving labor calculation:", error);
          alert("Erro ao salvar cálculo no banco de dados.");
      }
  };

  const loadCalculation = (calc: CalculationRecord) => {
      const mergedData = { ...INITIAL_LABOR_DATA, ...calc.data };
      // Ensure arrays are initialized if missing in saved data
      if (!mergedData.salaryHistory) mergedData.salaryHistory = [];
      if (!mergedData.unpaid13thPeriods) mergedData.unpaid13thPeriods = [];
      if (!mergedData.vacationPeriods) mergedData.vacationPeriods = [];
      if (!mergedData.adicionalNoturno) mergedData.adicionalNoturno = { active: false, periods: [] };
      if (!mergedData.wageGap) mergedData.wageGap = [];
      if (!mergedData.overtime) mergedData.overtime = [];
      if (!mergedData.salaryBalance) mergedData.salaryBalance = { active: true, days: 0 };
      
      setData(mergedData);
      setEditingId(calc.id);
      setShowSavedList(false);
      calculate(mergedData); // Recalcula para mostrar resultados
  };

  // --- ENGINE DE CÁLCULO ---
  const calculate = (calcData = data) => {
    const results = calculateLaborResults(calcData);
    setCalcResult(results);
    setTotalValue(results.reduce((acc, curr) => acc + curr.value, 0));
    setActiveTab(6); // Ir para resultados
  };

  const generatePDF = (calcDataInput?: LaborData) => {
      // @ts-ignore
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      
      const dataToUse = calcDataInput || data;
      let resultsToUse = calcResult;
      let totalToUse = totalValue;

      if (calcDataInput) {
          resultsToUse = calculateLaborResults(calcDataInput);
          totalToUse = resultsToUse.reduce((acc, curr) => acc + curr.value, 0);
      }
      
      // Header
      doc.setFillColor(30, 58, 138); // Primary Blue
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("RELATÓRIO DE CÁLCULO TRABALHISTA", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text("Estimativa Preliminar", pageWidth / 2, 28, { align: "center" });

      // Info Cliente
      let y = 55;
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DADOS DO PROCESSO / CLIENTE", margin, y);
      doc.setLineWidth(0.5);
      doc.line(margin, y+2, pageWidth - margin, y+2);
      
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Cliente: ${dataToUse.employeeName || 'Não informado'}`, margin, y);
      doc.text(`Data Base: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, y, { align: "right" });
      y += 6;
      doc.text(`Admissão: ${parseDate(dataToUse.startDate)?.toLocaleDateString('pt-BR') || '-'}`, margin, y);
      doc.text(`Demissão: ${parseDate(dataToUse.endDate)?.toLocaleDateString('pt-BR') || '-'}`, pageWidth - margin, y, { align: "right" });
      y += 6;
      doc.text(`Salário Base: ${formatCurrency(dataToUse.baseSalary)}`, margin, y);
      doc.text(`Motivo: ${dataToUse.terminationReason.replace(/_/g, ' ').toUpperCase()}`, pageWidth - margin, y, { align: "right" });
      
      // Jornada Contratual
      if (dataToUse.contractualSchedule) {
          y += 6;
          const { type, schedules, customDescription } = dataToUse.contractualSchedule;
          
          const typeLabels: any = {
              'segunda_sexta': 'Segunda a Sexta',
              'segunda_sabado': 'Segunda a Sábado',
              '12x36': 'Escala 12x36',
              '24x48': 'Escala 24x48',
              'outros': 'Personalizada'
          };
          
          let label = typeLabels[type] || type;
          if (type === 'outros' && customDescription) label += ` (${customDescription})`;
          doc.text(`Escala: ${label}`, margin, y);

          (schedules || []).forEach(s => {
              y += 6;
              const breakInfo = s.breakStartTime && s.breakEndTime ? ` (Int: ${s.breakStartTime}-${s.breakEndTime})` : ' (Sem int.)';
              doc.text(`- ${s.days}: ${s.startTime} às ${s.endTime}${breakInfo}`, margin + 5, y);
          });
      }

      // Relato do Cliente
      if (dataToUse.clientReport) {
          y += 10;
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("RELATO DO CLIENTE / FATOS RELEVANTES:", margin, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          const reportLines = doc.splitTextToSize(dataToUse.clientReport, pageWidth - (margin * 2));
          doc.text(reportLines, margin, y);
          y += (reportLines.length * 4) + 5;
      }

      // Tabela de Verbas
      y += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DETALHAMENTO DAS VERBAS", margin, y);
      doc.line(margin, y+2, pageWidth - margin, y+2);
      y += 10;

      // Header Tabela
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y - 6, pageWidth - (margin*2), 8, 'F');
      doc.setFontSize(10);
      doc.text("DESCRIÇÃO", margin + 2, y);
      doc.text("VALOR (R$)", pageWidth - margin - 2, y, { align: "right" });
      y += 10;

      doc.setFont("helvetica", "normal");
      let currentCategory = '';

      resultsToUse.forEach((item) => {
          if (y > pageHeight - 40) { doc.addPage(); y = 30; }

          if (item.category !== currentCategory) {
              y += 4;
              doc.setFont("helvetica", "bold");
              doc.setTextColor(30, 58, 138);
              doc.text(item.category.toUpperCase(), margin, y);
              doc.line(margin, y+1, pageWidth-margin, y+1);
              y += 6;
              currentCategory = item.category;
              doc.setTextColor(0);
              doc.setFont("helvetica", "normal");
          }

          doc.text(item.desc, margin + 2, y);
          doc.text(formatCurrency(item.value), pageWidth - margin - 2, y, { align: "right" });
          y += 6;
      });

      // Check space for Total and Rito
      if (y > pageHeight - 45) {
          doc.addPage();
          y = 30;
      }

      // Total
      y += 5;
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      doc.setFillColor(30, 58, 138);
      doc.rect(margin, y - 8, pageWidth - (margin*2), 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("TOTAL ESTIMADO:", margin + 4, y);
      doc.text(formatCurrency(totalToUse), pageWidth - margin - 4, y, { align: "right" });

      // Rito Processual
      y += 15;
      const rite = getProceduralRite(totalToUse);
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`RITO PROCESSUAL APLICÁVEL: ${rite.name.toUpperCase()}`, margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Base: ${rite.description} (Salário Mínimo: ${formatCurrency(getMinWage())})`, margin, y);

      // Memória de Cálculo Detalhada
      doc.addPage();
      y = 30;
      doc.setTextColor(0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("MEMÓRIA DE CÁLCULO DETALHADA", margin, y);
      doc.setLineWidth(0.5);
      doc.line(margin, y+2, pageWidth - margin, y+2);
      y += 10;
      
      doc.setFontSize(10);

      resultsToUse.forEach((item) => {
          if (item.details) {
              // Check if we need a new page
              const detailsLines = doc.splitTextToSize(item.details, pageWidth - (margin * 2) - 10);
              const neededHeight = (detailsLines.length * 4) + 15;
              
              if (y + neededHeight > pageHeight - 20) { 
                  doc.addPage(); 
                  y = 30; 
              }
              
              doc.setFont("helvetica", "bold");
              doc.setTextColor(30, 58, 138);
              doc.text(item.desc, margin, y);
              y += 5;
              
              doc.setFont("courier", "normal"); // Monospace for alignment
              doc.setFontSize(9);
              doc.setTextColor(50);
              
              doc.text(detailsLines, margin + 5, y);
              
              y += (detailsLines.length * 4) + 8; // Adjust spacing
              
              doc.setFont("helvetica", "normal");
              doc.setFontSize(10);
              doc.setTextColor(0);
          }
      });

      // Explicação Metodológica (Justificado)
      if (y > pageHeight - 60) { doc.addPage(); y = 30; } else { y += 10; }

      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("METODOLOGIA DE CÁLCULO", margin, y);
      doc.line(margin, y+2, pageWidth - margin, y+2);
      y += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const text = "O presente cálculo é uma estimativa preliminar realizada com base nas informações fornecidas pelo cliente e nos parâmetros da CLT. As verbas rescisórias consideram o saldo de salário, aviso prévio (indenizado ou trabalhado), férias vencidas e proporcionais acrescidas de 1/3, e 13º salário proporcional. Adicionais como insalubridade e periculosidade foram calculados sobre o salário mínimo e salário base, respectivamente, conforme legislação vigente. A multa de 40% do FGTS é estimada sobre o saldo informado somado aos depósitos mensais devidos no período. Este documento não possui valor de sentença judicial e está sujeito a alterações mediante análise de provas documentais e convenções coletivas da categoria.";
      
      const splitText = doc.splitTextToSize(text, pageWidth - (margin * 2));
      doc.text(splitText, margin, y, { align: "justify", maxWidth: pageWidth - (margin * 2) });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Gerado por Felix e Castro Advocacia Especializada em ${new Date().toLocaleDateString()} - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      }

      doc.save(`Relatorio_Calculo_${dataToUse.employeeName || 'Trabalhista'}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header da Calculadora */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center shadow-sm z-10">
         <div className="flex items-center gap-3">
             <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                 <CalculatorIcon className="h-6 w-6" />
             </div>
             <div>
                 <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">Calculadora Trabalhista</h2>
                 <p className="text-xs text-slate-500 dark:text-slate-400">Estimativas Rescisórias & Indenizatórias</p>
             </div>
         </div>
         <div className="flex gap-2">
            <button onClick={() => setShowSavedList(!showSavedList)} className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
                <ArchiveBoxIcon className="h-4 w-4" /> {showSavedList ? 'Ocultar Salvos' : 'Ver Salvos'}
            </button>
            <button onClick={() => { setData(INITIAL_LABOR_DATA); setEditingId(null); setCalcResult([]); setTotalValue(0); setActiveTab(1); }} className="text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                <TrashIcon className="h-4 w-4" /> Limpar
            </button>
            {totalValue > 0 && (
                <button onClick={() => generatePDF()} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center gap-2 transition">
                    <DocumentTextIcon className="h-4 w-4" />
                    Baixar PDF
                </button>
            )}
         </div>
      </div>

      {/* Saved List Overlay */}
      {showSavedList && (
          <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 animate-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Cálculos Salvos</h3>
              {savedCalculations.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Nenhum cálculo salvo.</p>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {savedCalculations.map(calc => (
                          <div key={calc.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                              <div>
                                  <p className="font-bold text-slate-800 dark:text-white text-sm">{calc.employeeName}</p>
                                  <p className="text-xs text-slate-500">{new Date(calc.date).toLocaleDateString()} - {formatCurrency(calc.totalValue)}</p>
                              </div>
                              <div className="flex gap-1">
                                  <button onClick={() => generatePDF(calc.data)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded" title="Baixar PDF"><DocumentTextIcon className="h-4 w-4" /></button>
                                  <button onClick={() => loadCalculation(calc)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Editar / Visualizar"><PencilSquareIcon className="h-4 w-4" /></button>
                                  <button onClick={() => onDeleteCalculation && onDeleteCalculation(calc.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Excluir"><TrashIcon className="h-4 w-4" /></button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 gap-1 shrink-0">
         {['Qualificação e Relato', 'Remuneração e Adicionais', 'Jornada de Trabalho', 'Rescisão e Pendências', 'Situações Especiais', 'Resultados'].map((label, idx) => (
             <button
                key={idx}
                onClick={() => setActiveTab(idx + 1)}
                className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === idx + 1 
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
             >
                 {idx + 1}. {label}
             </button>
         ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-5xl mx-auto space-y-6 pb-20">
              

              {/* TAB 1: QUALIFICAÇÃO E RELATO */}
              {activeTab === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className={`md:col-span-2 ${STYLES.CARD_SECTION}`}>
                          <h3 className={STYLES.CARD_TITLE}>
                              <DocumentTextIcon className="h-5 w-5 text-indigo-500" /> Informações Básicas
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                  <label className={STYLES.LABEL_TEXT}>Nome do Cliente / Reclamante</label>
                                  <div className="flex gap-2">
                                      <input type="text" className={STYLES.INPUT_FIELD} value={data.employeeName} onChange={e => handleInputChange('employeeName', e.target.value)} placeholder="Ex: João da Silva" />
                                      <select className={`${STYLES.INPUT_FIELD} w-1/3`} onChange={handleClientSelect} defaultValue="">
                                          <option value="" disabled>Selecionar...</option>
                                          {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                          {contracts.map(c => <option key={c.id} value={`${c.firstName} ${c.lastName}`}>{c.firstName} {c.lastName}</option>)}
                                      </select>
                                      <select className={`${STYLES.INPUT_FIELD} w-1/4`} value={data.employeeGender || 'M'} onChange={e => handleInputChange('employeeGender', e.target.value)}>
                                          <option value="M">Masculino</option>
                                          <option value="F">Feminino</option>
                                      </select>
                                  </div>
                              </div>
                              <div>
                                  <label className={STYLES.LABEL_TEXT}>Data Admissão</label>
                                  <input type="date" className={STYLES.INPUT_FIELD} value={data.startDate} onChange={e => handleInputChange('startDate', e.target.value)} />
                              </div>
                              <div>
                                  <label className={STYLES.LABEL_TEXT}>Data Demissão / Ajuizamento</label>
                                  <input type="date" className={STYLES.INPUT_FIELD} value={data.endDate} onChange={e => handleInputChange('endDate', e.target.value)} />
                              </div>
                              <div>
                                  <label className={STYLES.LABEL_TEXT}>Último Salário Base (R$)</label>
                                  <input type="number" className={STYLES.INPUT_FIELD} value={data.baseSalary} onChange={e => handleInputChange('baseSalary', e.target.value)} placeholder="0.00" />
                              </div>
                              <div>
                                  <label className={STYLES.LABEL_TEXT}>Motivo da Rescisão</label>
                                  <select className={STYLES.INPUT_FIELD} value={data.terminationReason} onChange={e => handleInputChange('terminationReason', e.target.value)}>
                                      <option value="sem_justa_causa">Dispensa Sem Justa Causa</option>
                                      <option value="rescisao_indireta">Rescisão Indireta</option>
                                      <option value="pedido_demissao">Pedido de Demissão</option>
                                      <option value="justa_causa">Justa Causa</option>
                                      <option value="sem_anotacao">Sem Anotação na CTPS</option>
                                  </select>
                              </div>
                              <div>
                                  <label className={STYLES.LABEL_TEXT}>Aviso Prévio</label>
                                  <select className={STYLES.INPUT_FIELD} value={data.noticePeriod} onChange={e => handleInputChange('noticePeriod', e.target.value)}>
                                      <option value="indenizado">Indenizado (Pago)</option>
                                      <option value="trabalhado">Trabalhado</option>
                                      <option value="dispensado">Dispensado</option>
                                  </select>
                              </div>
                          </div>
                      </div>

                      {/* Relato do Cliente */}
                      <div className={`md:col-span-2 ${STYLES.CARD_SECTION}`}>
                          <h3 className={STYLES.CARD_TITLE}>
                              <DocumentTextIcon className="w-5 h-5 text-indigo-500" />
                              Relato do Cliente / Fatos Relevantes
                          </h3>
                          <div className="mt-4">
                              <textarea 
                                  className={`${STYLES.INPUT_FIELD} min-h-[120px] resize-y`} 
                                  value={data.clientReport || ''} 
                                  onChange={e => handleInputChange('clientReport', e.target.value)} 
                                  placeholder="Descreva aqui os fatos relevantes do caso, histórico do trabalhador, detalhes sobre as condições de trabalho, etc. Esta informação constará no relatório PDF."
                              />
                          </div>
                      </div>

{/* Seção de Jornada de Trabalho (Informativo) */}
                      <div className={`md:col-span-2 ${STYLES.CARD_SECTION}`}>
                          <div className="flex justify-between items-center mb-4">
                              <h3 className={STYLES.CARD_TITLE}>
                                  <ClockIcon className="w-5 h-5 text-indigo-500" />
                                  Jornada de Trabalho Prevista (Contratual)
                              </h3>
                              <button 
                                  onClick={addContractualSchedule}
                                  className={STYLES.BTN_SECONDARY_SM}
                              >
                                  <PlusIcon className="h-3 w-3" /> Adicionar Horário
                              </button>
                          </div>
                          
                          <div className="flex flex-col gap-6">
                              {/* Tipo de Escala e Descrição */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className={data.contractualSchedule?.type === 'outros' ? "md:col-span-1" : "md:col-span-1"}>
                                      <label className={STYLES.LABEL_TEXT}>Tipo de Escala</label>
                                      <select
                                          value={data.contractualSchedule?.type || 'segunda_sexta'}
                                          onChange={(e) => setData(prev => ({
                                              ...prev,
                                              contractualSchedule: {
                                                  ...prev.contractualSchedule,
                                                  type: e.target.value as any
                                              }
                                          }))}
                                          className={STYLES.INPUT_FIELD}
                                      >
                                          <option value="segunda_sexta">Segunda a Sexta (5x2)</option>
                                          <option value="segunda_sabado">Segunda a Sábado (6x1)</option>
                                          <option value="12x36">Plantão 12x36</option>
                                          <option value="24x48">Plantão 24x48</option>
                                          <option value="outros">Outros / Personalizado</option>
                                      </select>
                                  </div>

                                  {data.contractualSchedule?.type === 'outros' && (
                                      <div className="md:col-span-2">
                                          <label className={STYLES.LABEL_TEXT}>Descrição da Jornada</label>
                                          <input
                                              type="text"
                                              value={data.contractualSchedule?.customDescription || ''}
                                              onChange={(e) => {
                                                  const val = e.target.value;
                                                  setData(prev => ({
                                                      ...prev,
                                                      contractualSchedule: { 
                                                          ...prev.contractualSchedule, 
                                                          customDescription: val
                                                      }
                                                  }))
                                              }}
                                              placeholder="Ex: Escala 5x1, 12x36..."
                                              className={STYLES.INPUT_FIELD}
                                          />
                                      </div>
                                  )}
                              </div>

                              {/* Lista de Horários */}
                              <div className="space-y-4">
                                  {(data.contractualSchedule?.schedules || []).map((schedule, idx) => (
                                      <div key={schedule.id} className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800 relative group">
                                          {idx > 0 && (
                                              <button 
                                                  onClick={() => removeContractualSchedule(schedule.id)}
                                                  className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-500 rounded-full shadow-sm hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                                              >
                                                  <TrashIcon className="h-3.5 w-3.5" />
                                              </button>
                                          )}
                                          
                                          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                              <div className="md:col-span-2">
                                                  <label className={STYLES.LABEL_TINY}>Dias da Semana</label>
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                      {[
                                                          { id: 1, label: 'S' },
                                                          { id: 2, label: 'T' },
                                                          { id: 3, label: 'Q' },
                                                          { id: 4, label: 'Q' },
                                                          { id: 5, label: 'S' },
                                                          { id: 6, label: 'S' },
                                                          { id: 7, label: 'D' }
                                                      ].map(day => {
                                                          const isSelected = (schedule.selectedDays || []).includes(day.id);
                                                          return (
                                                              <button
                                                                  key={day.id}
                                                                  type="button"
                                                                  onClick={() => {
                                                                      const current = schedule.selectedDays || [];
                                                                      const next = isSelected 
                                                                          ? current.filter(d => d !== day.id)
                                                                          : [...current, day.id].sort();
                                                                      updateContractualScheduleItem(schedule.id, 'selectedDays', next);
                                                                      
                                                                      // Update the text description too
                                                                      const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
                                                                      const selectedNames = next.map(d => dayNames[d-1]);
                                                                      if (next.length === 5 && next.every((d, i) => d === i + 1)) {
                                                                          updateContractualScheduleItem(schedule.id, 'days', 'Seg a Sex');
                                                                      } else if (next.length === 6 && next.every((d, i) => d === i + 1)) {
                                                                          updateContractualScheduleItem(schedule.id, 'days', 'Seg a Sab');
                                                                      } else if (next.length > 0) {
                                                                          updateContractualScheduleItem(schedule.id, 'days', selectedNames.join(', '));
                                                                      } else {
                                                                          updateContractualScheduleItem(schedule.id, 'days', '');
                                                                      }
                                                                  }}
                                                                  className={`w-7 h-7 rounded-md text-[10px] font-bold transition-colors ${
                                                                      isSelected 
                                                                          ? 'bg-indigo-600 text-white' 
                                                                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'
                                                                  }`}
                                                              >
                                                                  {day.label}
                                                              </button>
                                                          );
                                                      })}
                                                  </div>
                                                  <input
                                                      type="text"
                                                      value={schedule.days}
                                                      onChange={(e) => updateContractualScheduleItem(schedule.id, 'days', e.target.value)}
                                                      placeholder="Descrição (ex: Seg a Sex)"
                                                      className={`${STYLES.INPUT_TINY} mt-1 h-7 text-[10px]`}
                                                  />
                                              </div>
                                              <div>
                                                  <label className={STYLES.LABEL_TINY}>Entrada</label>
                                                  <input
                                                      type="time"
                                                      value={schedule.startTime}
                                                      onChange={(e) => updateContractualScheduleItem(schedule.id, 'startTime', e.target.value)}
                                                      className={STYLES.INPUT_TINY}
                                                  />
                                              </div>
                                              <div className="md:col-span-2">
                                                  <label className={STYLES.LABEL_TINY}>Intervalo (Início/Fim)</label>
                                                  <div className="flex gap-1">
                                                      <input
                                                          type="time"
                                                          value={schedule.breakStartTime}
                                                          onChange={(e) => updateContractualScheduleItem(schedule.id, 'breakStartTime', e.target.value)}
                                                          className={STYLES.INPUT_TINY}
                                                      />
                                                      <input
                                                          type="time"
                                                          value={schedule.breakEndTime}
                                                          onChange={(e) => updateContractualScheduleItem(schedule.id, 'breakEndTime', e.target.value)}
                                                          className={STYLES.INPUT_TINY}
                                                      />
                                                  </div>
                                              </div>
                                              <div>
                                                  <label className={STYLES.LABEL_TINY}>Saída</label>
                                                  <input
                                                      type="time"
                                                      value={schedule.endTime}
                                                      onChange={(e) => updateContractualScheduleItem(schedule.id, 'endTime', e.target.value)}
                                                      className={STYLES.INPUT_TINY}
                                                  />
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                              
                              {/* Estimativa Mensal */}
                              <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between gap-4">
                                  <div className="flex flex-col flex-1">
                                      <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 mb-1">Estimativa Mensal (Contratual)</span>
                                      <span className="text-xs text-slate-500">Baseada na escala e horários informados</span>
                                  </div>
                                  
                                  {data.contractualSchedule?.type === 'outros' && (
                                      <div className="flex flex-col w-32">
                                          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Dias / Mês</label>
                                          <input
                                              type="number"
                                              value={data.contractualSchedule?.customMonthlyDays || 22}
                                              onChange={(e) => setData(prev => ({
                                                  ...prev,
                                                  contractualSchedule: { ...prev.contractualSchedule, customMonthlyDays: Number(e.target.value) }
                                              }))}
                                              className={`${STYLES.INPUT_FIELD} text-right font-bold`}
                                          />
                                      </div>
                                  )}
                                  
                                  {(() => {
                                      const type = data.contractualSchedule?.type || 'segunda_sexta';
                                      const schedules = data.contractualSchedule?.schedules || [];
                                      const customDays = data.contractualSchedule?.customMonthlyDays || 22;
                                      
                                      let totalMonthlyHours = 0;
                                      let totalMonthlyDays = 0;
                                      
                                      schedules.forEach(s => {
                                          const [h1, m1] = (s.startTime || '08:00').split(':').map(Number);
                                          const [h2, m2] = (s.endTime || '17:00').split(':').map(Number);
                                          let dailyHours = (h2 + m2/60) - (h1 + m1/60);
                                          if (dailyHours < 0) dailyHours += 24;
                                          
                                          if (s.breakStartTime && s.breakEndTime) {
                                              const [bh1, bm1] = s.breakStartTime.split(':').map(Number);
                                              const [bh2, bm2] = s.breakEndTime.split(':').map(Number);
                                              let breakDuration = (bh2 + bm2/60) - (bh1 + bm1/60);
                                              if (breakDuration < 0) breakDuration += 24;
                                              dailyHours -= breakDuration;
                                          }
                                          
                                          let daysPerWeek = 0;
                                          if (s.selectedDays && s.selectedDays.length > 0) {
                                              daysPerWeek = s.selectedDays.length;
                                          } else {
                                              const daysLower = s.days.toLowerCase();
                                              if (daysLower.includes('seg') && daysLower.includes('sex')) daysPerWeek = 5;
                                              else if (daysLower.includes('seg') && daysLower.includes('sab')) daysPerWeek = 6;
                                              else {
                                                  const dayKeywords = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
                                                  dayKeywords.forEach(dk => {
                                                      if (daysLower.includes(dk)) daysPerWeek++;
                                                  });
                                              }
                                          }
                                          
                                          if (daysPerWeek === 0) daysPerWeek = 5; // Fallback
                                          
                                          const itemMonthlyDays = daysPerWeek * 4.333;
                                          totalMonthlyHours += dailyHours * itemMonthlyDays;
                                          totalMonthlyDays += itemMonthlyDays;
                                      });
                                      
                                      if (type === '12x36') {
                                          totalMonthlyDays = 15;
                                          totalMonthlyHours = (totalMonthlyHours / totalMonthlyDays) * 15;
                                      } else if (type === '24x48') {
                                          totalMonthlyDays = 10;
                                          totalMonthlyHours = (totalMonthlyHours / totalMonthlyDays) * 10;
                                      } else if (type === 'outros') {
                                          totalMonthlyDays = customDays;
                                          // Re-estimate hours based on custom days
                                          const avgDaily = schedules.length > 0 ? (totalMonthlyHours / totalMonthlyDays) : 0;
                                          totalMonthlyHours = avgDaily * customDays;
                                      }

                                      return (
                                          <div className="text-right min-w-[120px]">
                                              <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                                                  ~{totalMonthlyDays.toFixed(1)} dias / {totalMonthlyHours.toFixed(1)}h
                                              </div>
                                              <span className="text-[10px] text-slate-500 font-medium block">
                                                  (Intervalos descontados)
                                              </span>
                                          </div>
                                      );
                                  })()}
                              </div>
                          </div>
                      </div>

                      
{/* Histórico Salarial */}
                      <div className={`md:col-span-2 ${STYLES.CARD_SECTION}`}>
                          <div className="flex justify-between items-center mb-4">
                              <h3 className={STYLES.CARD_TITLE}>
                                  <BanknotesIcon className="h-5 w-5 text-indigo-500" /> Histórico Salarial
                              </h3>
                              <button onClick={addSalaryHistory} className={STYLES.BTN_SECONDARY_SM}>
                                  <PlusIcon className="h-4 w-4" /> Adicionar Período
                              </button>
                          </div>
                          
                          {data.salaryHistory.length === 0 ? (
                              <div className="text-center py-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                  <p className="text-sm text-slate-500">Nenhum histórico adicionado. O cálculo usará o <strong>Último Salário Base</strong> para todo o período.</p>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  {data.salaryHistory.map((hist, idx) => (
                                      <div key={hist.id} className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                          <div className="md:col-span-2">
                                              <label className={STYLES.LABEL_TINY}>Início</label>
                                              <input type="date" className={STYLES.INPUT_TINY} value={hist.startDate} onChange={e => updateSalaryHistory(hist.id, 'startDate', e.target.value)} />
                                          </div>
                                          <div className="md:col-span-2">
                                              <label className={STYLES.LABEL_TINY}>Fim</label>
                                              <input type="date" className={STYLES.INPUT_TINY} value={hist.endDate} onChange={e => updateSalaryHistory(hist.id, 'endDate', e.target.value)} />
                                          </div>
                                          <div className="md:col-span-2">
                                              <label className={STYLES.LABEL_TINY}>Salário (R$)</label>
                                              <input type="number" className={STYLES.INPUT_TINY} value={hist.salary} onChange={e => updateSalaryHistory(hist.id, 'salary', Number(e.target.value))} />
                                          </div>
                                          <div className="md:col-span-1 flex justify-end">
                                              <button onClick={() => removeSalaryHistory(hist.id)} className="p-2 text-slate-400 hover:text-red-500 transition"><TrashIcon className="h-4 w-4" /></button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                      
                      <div className="md:col-span-2 flex justify-end">
                          <button onClick={() => setActiveTab(2)} className={STYLES.BTN_PRIMARY}>
                              Próxima Etapa <ArrowPathIcon className="h-4 w-4" />
                          </button>
                      </div>
                  </div>
              )}

              {/* TAB 2: REMUNERAÇÃO E ADICIONAIS */}
              {activeTab === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* Seção Diferença Salarial */}
                      <div className={STYLES.CARD_SECTION}>
                          <div className="flex justify-between items-center mb-4">
                              <h3 className={`${STYLES.CARD_TITLE} text-green-600 dark:text-green-400`}>
                                  <BanknotesIcon className="h-5 w-5" /> Diferença Salarial (Piso)
                              </h3>
                              <button onClick={addWageGap} className={STYLES.BTN_SECONDARY_SM}><PlusIcon className="h-3 w-3" /> Adicionar Período</button>
                          </div>
                          {data.wageGap.length === 0 && <p className={STYLES.EMPTY_MSG}>Nenhum período de diferença salarial cadastrado.</p>}
                          {data.wageGap.map((gap, idx) => (
                              <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 relative group">
                                  <button onClick={() => removeWageGap(idx)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Início</label>
                                          <input type="date" className={STYLES.INPUT_TINY} value={gap.startDate || ''} onChange={(e) => {
                                              const newGaps = [...data.wageGap]; newGaps[idx].startDate = e.target.value; setData({...data, wageGap: newGaps});
                                          }} />
                                      </div>
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Fim</label>
                                          <input type="date" className={STYLES.INPUT_TINY} value={gap.endDate || ''} onChange={(e) => {
                                              const newGaps = [...data.wageGap]; newGaps[idx].endDate = e.target.value; setData({...data, wageGap: newGaps});
                                          }} />
                                      </div>
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Salário Piso (Deveria ser)</label>
                                          <input type="number" className={`${STYLES.INPUT_TINY} font-bold text-green-600`} value={gap.floorSalary || ''} onChange={(e) => {
                                              const newGaps = [...data.wageGap]; newGaps[idx].floorSalary = Number(e.target.value); setData({...data, wageGap: newGaps});
                                          }} />
                                      </div>
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Salário Pago (Real)</label>
                                          <input type="number" className={STYLES.INPUT_TINY} value={gap.paidSalary || ''} onChange={(e) => {
                                              const newGaps = [...data.wageGap]; newGaps[idx].paidSalary = Number(e.target.value); setData({...data, wageGap: newGaps});
                                          }} />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>

                      {/* Seção Salário por Fora */}
                      <div className={STYLES.CARD_SECTION}>
                          <div className="flex justify-between items-center mb-4">
                              <h3 className={`${STYLES.CARD_TITLE} text-orange-600 dark:text-orange-400`}>
                                  <BanknotesIcon className="h-5 w-5" /> Salário por Fora (Extraoficial)
                              </h3>
                              <button onClick={addSalaryOffTheBooks} className={STYLES.BTN_SECONDARY_SM}><PlusIcon className="h-3 w-3" /> Adicionar Período</button>
                          </div>
                          {data.salaryOffTheBooks.length === 0 && <p className={STYLES.EMPTY_MSG}>Nenhum valor "por fora" cadastrado.</p>}
                          {data.salaryOffTheBooks.map((off, idx) => (
                              <div key={off.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 relative group">
                                  <button onClick={() => removeSalaryOffTheBooks(off.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Início</label>
                                          <input type="date" className={STYLES.INPUT_TINY} value={off.startDate || ''} onChange={(e) => updateSalaryOffTheBooks(off.id, 'startDate', e.target.value)} />
                                      </div>
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Fim</label>
                                          <input type="date" className={STYLES.INPUT_TINY} value={off.endDate || ''} onChange={(e) => updateSalaryOffTheBooks(off.id, 'endDate', e.target.value)} />
                                      </div>
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Valor Mensal (R$)</label>
                                          <input type="number" className={`${STYLES.INPUT_TINY} font-bold text-orange-600`} value={off.amount || ''} onChange={(e) => updateSalaryOffTheBooks(off.id, 'amount', Number(e.target.value))} />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>


                      {/* Seção Adicionais Fixos */}
                      <div className={STYLES.CARD_SECTION}>
                          <h3 className={`${STYLES.CARD_TITLE} text-indigo-600 dark:text-indigo-400`}>
                              <PlusIcon className="h-5 w-5" /> Adicionais Recorrentes
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                  <label className={`${STYLES.LABEL_TEXT} mb-2`}>Insalubridade</label>
                                  <select 
                                      className={STYLES.INPUT_FIELD} 
                                      value={data.insalubridadeLevel} 
                                      onChange={e => handleInputChange('insalubridadeLevel', e.target.value)}
                                  >
                                      <option value="nenhum">Não se aplica</option>
                                      <option value="minimo">Grau Mínimo (10%)</option>
                                      <option value="medio">Grau Médio (20%)</option>
                                      <option value="maximo">Grau Máximo (40%)</option>
                                  </select>
                                  <p className="text-[10px] text-slate-400 mt-1">Base: Salário Mínimo</p>
                              </div>

                              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-center">
                                  <label className="flex items-center gap-3 cursor-pointer">
                                      <input 
                                          type="checkbox" 
                                          checked={data.periculosidade} 
                                          onChange={e => handleInputChange('periculosidade', e.target.checked)} 
                                          className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" 
                                      />
                                      <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                          Periculosidade (30%)
                                      </span>
                                  </label>
                                  <p className="text-[10px] text-slate-400 mt-1 pl-8">Base: Salário Base</p>
                              </div>

                          </div>
                      </div>


                      {/* Seção Direitos Normativos (CCT) */}
                      <div className={STYLES.CARD_SECTION}>
                          <div className="flex justify-between items-center mb-4">
                              <h3 className={`${STYLES.CARD_TITLE} text-purple-600 dark:text-purple-400`}>
                                  <DocumentTextIcon className="h-5 w-5" /> Direitos Normativos (CCT)
                              </h3>
                              <button onClick={addCctRight} className={STYLES.BTN_SECONDARY_SM}><PlusIcon className="h-3 w-3" /> Adicionar Direito</button>
                          </div>
                          
                          {data.cctRights.length === 0 && <p className={STYLES.EMPTY_MSG}>Nenhum direito normativo cadastrado.</p>}
                          
                          {data.cctRights.map((right, idx) => (
                              <div key={right.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 relative">
                                  <button onClick={() => removeCctRight(right.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                      <div className={right.frequency === 'daily' ? "md:col-span-3" : "md:col-span-4"}>
                                          <label className={STYLES.LABEL_TINY}>Nome do Direito</label>
                                          <input 
                                              type="text" 
                                              className={STYLES.INPUT_TINY} 
                                              placeholder="Ex: Quebra de Caixa"
                                              value={right.name}
                                              onChange={e => updateCctRight(right.id, 'name', e.target.value)}
                                          />
                                      </div>
                                      
                                      <div className="md:col-span-2">
                                          <label className={STYLES.LABEL_TINY}>Frequência</label>
                                          <select 
                                              className={STYLES.INPUT_TINY}
                                              value={right.frequency}
                                              onChange={e => updateCctRight(right.id, 'frequency', e.target.value)}
                                          >
                                              <option value="daily">Diário</option>
                                              <option value="monthly">Mensal</option>
                                              <option value="annual">Anual</option>
                                          </select>
                                      </div>

                                      {right.frequency === 'daily' && (
                                          <div className="md:col-span-1">
                                              <label className={STYLES.LABEL_TINY}>Dias/Mês</label>
                                              <input 
                                                  type="number" 
                                                  className={STYLES.INPUT_TINY} 
                                                  placeholder="Ex: 22"
                                                  value={right.daysPerMonth || ''}
                                                  onChange={e => updateCctRight(right.id, 'daysPerMonth', Number(e.target.value))}
                                              />
                                          </div>
                                      )}

                                      {right.frequency === 'annual' ? (
                                          <div className="md:col-span-4">
                                              <label className={STYLES.LABEL_TINY}>Ano de Referência</label>
                                              <input 
                                                  type="number" 
                                                  className={STYLES.INPUT_TINY} 
                                                  placeholder="AAAA"
                                                  value={right.startYear || ''}
                                                  onChange={e => updateCctRight(right.id, 'startYear', Number(e.target.value))}
                                              />
                                          </div>
                                      ) : (
                                          <>
                                              <div className="md:col-span-2">
                                                  <label className={STYLES.LABEL_TINY}>Início</label>
                                                  <input 
                                                      type="date" 
                                                      className={STYLES.INPUT_TINY} 
                                                      value={right.startDate || ''}
                                                      onChange={e => updateCctRight(right.id, 'startDate', e.target.value)}
                                                  />
                                              </div>
                                              <div className="md:col-span-2">
                                                  <label className={STYLES.LABEL_TINY}>Fim</label>
                                                  <input 
                                                      type="date" 
                                                      className={STYLES.INPUT_TINY} 
                                                      value={right.endDate || ''}
                                                      onChange={e => updateCctRight(right.id, 'endDate', e.target.value)}
                                                  />
                                              </div>
                                          </>
                                      )}

                                      <div className="md:col-span-2">
                                          <label className={STYLES.LABEL_TINY}>Valor (R$)</label>
                                          <input 
                                              type="text" 
                                              className={STYLES.INPUT_TINY} 
                                              placeholder="0,00"
                                              value={right.value || ''}
                                              onChange={e => updateCctRight(right.id, 'value', e.target.value)}
                                          />
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                      <input 
                                          type="checkbox" 
                                          id={`cct-integra-${right.id}`}
                                          checked={right.integratesSalary || false}
                                          onChange={e => updateCctRight(right.id, 'integratesSalary', e.target.checked)}
                                          className="w-4 h-4 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500"
                                      />
                                      <label htmlFor={`cct-integra-${right.id}`} className="text-[10px] text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                                          Integra salário (Base FGTS)
                                      </label>
                                      <p className="text-[9px] text-slate-400 ml-auto">
                                          {right.frequency === 'daily' ? 'Valor por dia' : right.frequency === 'monthly' ? 'Valor por mês' : 'Valor por ano'}
                                      </p>
                                  </div>
                              </div>
                          ))}
                      </div>


                      <div className="flex justify-between mt-8">
                          <button onClick={() => setActiveTab(1)} className={STYLES.BTN_SECONDARY}>Voltar</button>
                          <button onClick={() => setActiveTab(3)} className={STYLES.BTN_PRIMARY}>Próxima Etapa <ArrowPathIcon className="h-4 w-4" /></button>
                      </div>
                  </div>
              )}

              {/* TAB 3: JORNADA DE TRABALHO */}
              {activeTab === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* Seção Horas Extras */}
                      <div className={STYLES.CARD_SECTION}>
                          <div className="flex justify-between items-center mb-4">
                              <h3 className={`${STYLES.CARD_TITLE} text-orange-600 dark:text-orange-400`}>
                                  <ClockIcon className="h-5 w-5" /> Horas Extras em Lote
                              </h3>
                              <button onClick={addOvertimeBatch} className={STYLES.BTN_SECONDARY_SM}><PlusIcon className="h-3 w-3" /> Adicionar Lote</button>
                          </div>
                          
                          {data.overtime.length === 0 && <p className={STYLES.EMPTY_MSG}>Nenhum lote de horas extras cadastrado.</p>}
                          
                          {data.overtime.map((ot, idx) => (
                              <div key={ot.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 relative">
                                  <button onClick={() => removeOvertimeBatch(ot.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                      <div className="col-span-1">
                                          <label className={STYLES.LABEL_TINY}>Adicional (%)</label>
                                          <select 
                                            className={STYLES.INPUT_TINY} 
                                            value={ot.percentage} 
                                            onChange={(e) => {
                                                const newOt = [...data.overtime];
                                                newOt[idx].percentage = Number(e.target.value);
                                                setData({...data, overtime: newOt});
                                            }}
                                          >
                                              <option value={50}>50%</option>
                                              <option value={60}>60%</option>
                                              <option value={100}>100%</option>
                                              <option value={-1}>Outro...</option>
                                          </select>
                                          {ot.percentage === -1 && (
                                              <input 
                                                type="number" 
                                                className={`${STYLES.INPUT_TINY} mt-1`} 
                                                placeholder="%" 
                                                value={ot.customPercentage || ''}
                                                onChange={(e) => {
                                                    const newOt = [...data.overtime];
                                                    newOt[idx].customPercentage = Number(e.target.value);
                                                    setData({...data, overtime: newOt});
                                                }}
                                              />
                                          )}
                                      </div>
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Horas/Mês (Média)</label>
                                          <input type="number" className={STYLES.INPUT_TINY} value={ot.hoursPerMonth || ''} onChange={(e) => {
                                              const newOt = [...data.overtime]; newOt[idx].hoursPerMonth = Number(e.target.value); setData({...data, overtime: newOt});
                                          }} />
                                      </div>
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>De</label>
                                          <input type="date" className={STYLES.INPUT_TINY} value={ot.startDate || ''} onChange={(e) => {
                                              const newOt = [...data.overtime]; newOt[idx].startDate = e.target.value; setData({...data, overtime: newOt});
                                          }} />
                                      </div>
                                      <div>
                                          <label className={STYLES.LABEL_TINY}>Até</label>
                                          <input type="date" className={STYLES.INPUT_TINY} value={ot.endDate || ''} onChange={(e) => {
                                              const newOt = [...data.overtime]; newOt[idx].endDate = e.target.value; setData({...data, overtime: newOt});
                                          }} />
                                      </div>
                                      <div className="flex items-center h-10">
                                           <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 select-none">
                                               <input type="checkbox" checked={ot.applyDsr} onChange={(e) => {
                                                   const newOt = [...data.overtime]; newOt[idx].applyDsr = e.target.checked; setData({...data, overtime: newOt});
                                               }} className="w-4 h-4 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" />
                                               Reflexo DSR
                                           </label>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>


                      <div className={STYLES.CARD_SECTION}>
                          <h3 className={`${STYLES.CARD_TITLE} text-indigo-600 dark:text-indigo-400`}>
                              <ClockIcon className="h-5 w-5" /> Adicional Noturno e Intrajornada
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 col-span-1 md:col-span-3">
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="flex items-center gap-3 cursor-pointer">
                                          <input 
                                              type="checkbox" 
                                              checked={data.adicionalNoturno.active} 
                                              onChange={e => setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, active: e.target.checked } }))} 
                                              className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" 
                                          />
                                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                              Adicional Noturno (20%)
                                          </span>
                                      </label>
                                      {data.adicionalNoturno.active && (
                                          <button onClick={addNightShiftPeriod} className={`${STYLES.BTN_SECONDARY_SM} text-[10px] py-1 px-2`}>
                                              <PlusIcon className="h-3 w-3" /> Add Período
                                          </button>
                                      )}
                                  </div>
                                  
                                  {data.adicionalNoturno.active && (
                                      <div className="space-y-2 mt-2">
                                          {/* Súmula 60 TST - Prorrogação */}
                                          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 mb-3">
                                              <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                  <input 
                                                      type="checkbox" 
                                                      checked={data.adicionalNoturno.applySumula60 || false} 
                                                      onChange={e => setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, applySumula60: e.target.checked } }))} 
                                                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" 
                                                  />
                                                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                                      Aplicar Súmula 60 TST (Prorrogação da Jornada Noturna)
                                                  </span>
                                              </label>
                                              
                                              {data.adicionalNoturno.applySumula60 && (
                                                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pl-6 mt-2">
                                                      <div className="flex items-center gap-2">
                                                          <label className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Término Real da Jornada:</label>
                                                          <input 
                                                              type="time" 
                                                              value={data.adicionalNoturno.extendedEndTime || ''}
                                                              onChange={e => setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, extendedEndTime: e.target.value } }))}
                                                              className="w-24 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-bold focus:ring-1 focus:ring-indigo-500"
                                                          />
                                                      </div>
                                                      <span className="text-[10px] text-slate-400 italic leading-tight">
                                                          (Ex: se termina às 07:00, o sistema calculará o adicional das 05:00 às 07:00 com hora reduzida)
                                                      </span>
                                                  </div>
                                              )}
                                          </div>

                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                                              Considera-se noturno o trabalho entre <strong>22h e 5h</strong> (urbano). A hora noturna é reduzida (52min 30s).
                                          </p>
                                          {data.adicionalNoturno.periods.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum período adicionado.</p>}
                                          {data.adicionalNoturno.periods.map((period, idx) => (
                                              <div key={period.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 relative">
                                                  <button onClick={() => removeNightShiftPeriod(period.id)} className="absolute top-1 right-1 text-slate-400 hover:text-red-500"><TrashIcon className="h-3 w-3" /></button>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Horas/Dia</label>
                                                      <input 
                                                          type="number" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.hoursPerDay || ''}
                                                          placeholder="Opcional"
                                                          onChange={e => {
                                                              const newPeriods = [...data.adicionalNoturno.periods];
                                                              const val = Number(e.target.value);
                                                              newPeriods[idx].hoursPerDay = val;
                                                              // Auto-calc monthly if days is set
                                                              if (newPeriods[idx].daysPerMonth) {
                                                                  newPeriods[idx].hoursPerMonth = val * newPeriods[idx].daysPerMonth!;
                                                              }
                                                              setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Dias/Mês</label>
                                                      <input 
                                                          type="number" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.daysPerMonth || ''}
                                                          placeholder="Opcional"
                                                          onChange={e => {
                                                              const newPeriods = [...data.adicionalNoturno.periods];
                                                              const val = Number(e.target.value);
                                                              newPeriods[idx].daysPerMonth = val;
                                                              // Auto-calc monthly if hours/day is set
                                                              if (newPeriods[idx].hoursPerDay) {
                                                                  newPeriods[idx].hoursPerMonth = newPeriods[idx].hoursPerDay! * val;
                                                              }
                                                              setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Total Horas/Mês</label>
                                                      <input 
                                                          type="number" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.hoursPerMonth || ''}
                                                          placeholder="Total"
                                                          onChange={e => {
                                                              const newPeriods = [...data.adicionalNoturno.periods];
                                                              newPeriods[idx].hoursPerMonth = Number(e.target.value);
                                                              setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Início</label>
                                                      <input 
                                                          type="date" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.startDate || ''}
                                                          onChange={e => {
                                                              const newPeriods = [...data.adicionalNoturno.periods];
                                                              newPeriods[idx].startDate = e.target.value;
                                                              setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Fim</label>
                                                      <input 
                                                          type="date" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.endDate || ''}
                                                          onChange={e => {
                                                              const newPeriods = [...data.adicionalNoturno.periods];
                                                              newPeriods[idx].endDate = e.target.value;
                                                              setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>


                              {/* Intrajornada */}
                              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 col-span-1 md:col-span-3">
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="flex items-center gap-3 cursor-pointer">
                                          <input 
                                              type="checkbox" 
                                              checked={data.intrajornada.active} 
                                              onChange={e => setData(prev => ({ ...prev, intrajornada: { ...prev.intrajornada, active: e.target.checked } }))} 
                                              className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" 
                                          />
                                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                              Adicional Intrajornada (Intervalo Suprimido)
                                          </span>
                                      </label>
                                      {data.intrajornada.active && (
                                          <button onClick={addIntrajornadaPeriod} className={`${STYLES.BTN_SECONDARY_SM} text-[10px] py-1 px-2`}>
                                              <PlusIcon className="h-3 w-3" /> Add Período
                                          </button>
                                      )}
                                  </div>
                                  
                                  {data.intrajornada.active && (
                                      <div className="space-y-2 mt-2">
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                                              Intervalo para repouso e alimentação não concedido ou concedido parcialmente. Indenização de 50% sobre a hora suprimida.
                                          </p>
                                          {data.intrajornada.periods.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum período adicionado.</p>}
                                          {data.intrajornada.periods.map((period, idx) => (
                                              <div key={period.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 relative">
                                                  <button onClick={() => removeIntrajornadaPeriod(period.id)} className="absolute top-1 right-1 text-slate-400 hover:text-red-500"><TrashIcon className="h-3 w-3" /></button>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Qtd. Horas/Dia</label>
                                                      <input 
                                                          type="number" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.hoursPerDay || ''}
                                                          onChange={e => {
                                                              const newPeriods = [...data.intrajornada.periods];
                                                              newPeriods[idx].hoursPerDay = Number(e.target.value);
                                                              setData(prev => ({ ...prev, intrajornada: { ...prev.intrajornada, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Dias/Mês</label>
                                                      <input 
                                                          type="number" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.daysPerMonth || ''}
                                                          placeholder="Padrão: 22"
                                                          onChange={e => {
                                                              const newPeriods = [...data.intrajornada.periods];
                                                              newPeriods[idx].daysPerMonth = Number(e.target.value);
                                                              setData(prev => ({ ...prev, intrajornada: { ...prev.intrajornada, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Início</label>
                                                      <input 
                                                          type="date" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.startDate || ''}
                                                          onChange={e => {
                                                              const newPeriods = [...data.intrajornada.periods];
                                                              newPeriods[idx].startDate = e.target.value;
                                                              setData(prev => ({ ...prev, intrajornada: { ...prev.intrajornada, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className={STYLES.LABEL_TINY}>Fim</label>
                                                      <input 
                                                          type="date" 
                                                          className={STYLES.INPUT_TINY}
                                                          value={period.endDate || ''}
                                                          onChange={e => {
                                                              const newPeriods = [...data.intrajornada.periods];
                                                              newPeriods[idx].endDate = e.target.value;
                                                              setData(prev => ({ ...prev, intrajornada: { ...prev.intrajornada, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>

                          </div>
                      </div>
                      {/* Feriados, Domingos e Banco de Horas */}
                      <div className={STYLES.CARD_SECTION}>
                          <h3 className={`${STYLES.CARD_TITLE} text-blue-600 dark:text-blue-400`}>
                              <CalendarIcon className="h-5 w-5" /> Feriados, Domingos e Banco de Horas
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl space-y-4">
                                  <div>
                                      <label className={STYLES.LABEL_TEXT}>Feriados Trabalhados (Não Compensados)</label>
                                      <input type="number" className={STYLES.INPUT_FIELD} value={data.uncompensatedHolidays || ''} onChange={e => handleInputChange('uncompensatedHolidays', Number(e.target.value))} placeholder="Qtd. de dias" />
                                      <p className="text-[10px] text-slate-500 mt-1">Serão pagos em dobro (100%).</p>
                                  </div>
                                  <div>
                                      <label className={STYLES.LABEL_TEXT}>Domingos Trabalhados (Não Compensados)</label>
                                      <input type="number" className={STYLES.INPUT_FIELD} value={data.uncompensatedSundays || ''} onChange={e => handleInputChange('uncompensatedSundays', Number(e.target.value))} placeholder="Qtd. de dias" />
                                  </div>
                                  {data.employeeGender === 'F' && (
                                      <div>
                                          <label className={STYLES.LABEL_TEXT}>Domingos Consecutivos (Art. 386 CLT)</label>
                                          <input type="number" className={STYLES.INPUT_FIELD} value={data.consecutiveSundaysWorked || ''} onChange={e => handleInputChange('consecutiveSundaysWorked', Number(e.target.value))} placeholder="Qtd. de domingos" />
                                          <p className="text-[10px] text-slate-500 mt-1">Mulheres: DSR deve coincidir com o domingo a cada 15 dias. O descumprimento gera pagamento em dobro.</p>
                                      </div>
                                  )}
                              </div>
                              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-4">
                                  <div>
                                      <label className={STYLES.LABEL_TEXT}>Saldo Banco de Horas (Positivo)</label>
                                      <input type="number" className={STYLES.INPUT_FIELD} value={data.timeBankBalance || ''} onChange={e => handleInputChange('timeBankBalance', Number(e.target.value))} placeholder="Qtd. de horas" />
                                      <p className="text-[10px] text-slate-500 mt-1">Horas não compensadas até a rescisão.</p>
                                  </div>
                                  <div>
                                      <label className={STYLES.LABEL_TEXT}>Adicional do Banco de Horas (%)</label>
                                      <input type="number" className={STYLES.INPUT_FIELD} value={data.timeBankOvertimePercentage || ''} onChange={e => handleInputChange('timeBankOvertimePercentage', Number(e.target.value))} placeholder="Ex: 50" />
                                      <p className="text-[10px] text-slate-500 mt-1">Geralmente 50%, salvo convenção coletiva.</p>
                                  </div>
                              </div>
                          </div>
                      </div>


                      <div className="flex justify-between mt-8">
                          <button onClick={() => setActiveTab(2)} className={STYLES.BTN_SECONDARY}>Voltar</button>
                          <button onClick={() => setActiveTab(4)} className={STYLES.BTN_PRIMARY}>Próxima Etapa <ArrowPathIcon className="h-4 w-4" /></button>
                      </div>
                  </div>
              )}

              {/* TAB 4: RESCISÃO E PENDÊNCIAS */}
              {activeTab === 4 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* Seção Saldo de Salário e Deduções */}
                      <div className={STYLES.CARD_SECTION}>
                          <h3 className={`${STYLES.CARD_TITLE} text-emerald-600 dark:text-emerald-400`}>
                              <BanknotesIcon className="h-5 w-5" /> Saldo de Salário & Deduções
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Saldo de Salário */}
                              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                                  <label className="flex items-center gap-3 cursor-pointer mb-3">
                                      <input 
                                          type="checkbox" 
                                          checked={data.salaryBalance.active} 
                                          onChange={e => setData(prev => ({ ...prev, salaryBalance: { ...prev.salaryBalance, active: e.target.checked } }))} 
                                          className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500" 
                                      />
                                      <span className="font-bold text-slate-700 dark:text-slate-200">Calcular Saldo de Salário</span>
                                  </label>
                                  
                                  {data.salaryBalance.active && (
                                      <div className="grid grid-cols-2 gap-3 pl-8">
                                          <div>
                                              <label className={STYLES.LABEL_TINY}>Dias Trabalhados (Mês Rescisão)</label>
                                              <input 
                                                  type="number" 
                                                  className={STYLES.INPUT_TINY} 
                                                  value={data.salaryBalance.days} 
                                                  onChange={e => setData(prev => ({ ...prev, salaryBalance: { ...prev.salaryBalance, days: Number(e.target.value) } }))} 
                                                  placeholder="0 = Automático"
                                              />
                                              <p className="text-[9px] text-slate-400 mt-1">Deixe 0 para usar data de demissão.</p>
                                          </div>
                                          <div>
                                              <label className={STYLES.LABEL_TINY}>Valor Manual (Opcional)</label>
                                              <input 
                                                  type="number" 
                                                  className={STYLES.INPUT_TINY} 
                                                  value={data.salaryBalance.customAmount || ''} 
                                                  onChange={e => setData(prev => ({ ...prev, salaryBalance: { ...prev.salaryBalance, customAmount: Number(e.target.value) } }))} 
                                                  placeholder="R$ 0,00"
                                              />
                                          </div>
                                      </div>
                                  )}
                              </div>

                              {/* Deduções */}
                              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                                  <h4 className="font-bold text-red-700 dark:text-red-400 mb-3 text-sm">Deduções / Compensações</h4>
                                  <div>
                                      <label className={STYLES.LABEL_TINY}>Valor Pago na Rescisão (TRCT)</label>
                                      <input 
                                          type="number" 
                                          className={STYLES.INPUT_TINY} 
                                          value={data.severancePaid} 
                                          onChange={e => handleInputChange('severancePaid', Number(e.target.value))} 
                                          placeholder="R$ 0,00"
                                      />
                                      <p className="text-[9px] text-slate-400 mt-1">Este valor será subtraído do total estimado.</p>
                                  </div>
                              </div>
                          </div>
                      </div>


                      <div className={STYLES.CARD_SECTION}>
                          <h3 className={`${STYLES.CARD_TITLE} text-red-600 dark:text-red-400`}>
                              <ExclamationTriangleIcon className="h-5 w-5" /> Férias e 13º Salário
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                   <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                       <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 text-sm">Férias</h4>
                                       <label className="flex items-center gap-3 mb-2 cursor-pointer">
                                            <input type="checkbox" checked={data.claimVacationProportional} onChange={e => handleInputChange('claimVacationProportional', e.target.checked)} className="w-4 h-4 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" />
                                            <span className="text-xs font-semibold dark:text-slate-300">Calcular Proporcionais + 1/3</span>
                                       </label>
                                       
                                       <div className="mt-3">
                                           <div className="flex justify-between items-center mb-2">
                                               <label className={STYLES.LABEL_TINY}>Férias Vencidas (Períodos Aquisitivos)</label>
                                               <button onClick={addVacationPeriod} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold hover:bg-indigo-200 transition">+ Adicionar</button>
                                           </div>
                                           
                                           {data.vacationPeriods.length === 0 ? (
                                               <p className="text-xs text-slate-400 italic text-center py-2 border border-dashed border-slate-300 rounded-lg">Nenhum período vencido adicionado.</p>
                                           ) : (
                                               <div className="space-y-2">
                                                   {data.vacationPeriods.map((vac, idx) => (
                                                       <div key={vac.id} className="flex flex-col gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                                                           <div className="flex items-center gap-2">
                                                               <div className="grid grid-cols-2 gap-2 flex-1">
                                                                   <div>
                                                                       <label className={STYLES.LABEL_TINY}>Início</label>
                                                                       <input 
                                                                           type="date" 
                                                                           className={STYLES.INPUT_TINY}
                                                                           value={vac.startDate || ''}
                                                                           onChange={e => updateVacationPeriod(vac.id, 'startDate', e.target.value)}
                                                                       />
                                                                   </div>
                                                                   <div>
                                                                       <label className={STYLES.LABEL_TINY}>Fim</label>
                                                                       <input 
                                                                           type="date" 
                                                                           className={STYLES.INPUT_TINY}
                                                                           value={vac.endDate || ''}
                                                                           onChange={e => updateVacationPeriod(vac.id, 'endDate', e.target.value)}
                                                                       />
                                                                   </div>
                                                               </div>
                                                               <button onClick={() => removeVacationPeriod(vac.id)} className="text-slate-400 hover:text-red-500 p-1 self-end mb-1"><TrashIcon className="h-4 w-4" /></button>
                                                           </div>
                                                           <label className="flex items-center gap-2 cursor-pointer">
                                                               <input 
                                                                   type="checkbox" 
                                                                   checked={vac.isDouble} 
                                                                   onChange={e => updateVacationPeriod(vac.id, 'isDouble', e.target.checked)} 
                                                                   className="w-3 h-3 text-red-600 rounded focus:ring-red-500" 
                                                               />
                                                               <span className="text-[10px] font-bold text-red-600 dark:text-red-400">Em Dobro (Art. 137)</span>
                                                           </label>
                                                       </div>
                                                   ))}
                                               </div>
                                           )}
                                       </div>
                                   </div>


                                   <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                       <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 text-sm">13º Salário</h4>
                                       <label className="flex items-center gap-3 mb-2 cursor-pointer">
                                            <input type="checkbox" checked={data.claim13thProportional} onChange={e => handleInputChange('claim13thProportional', e.target.checked)} className="w-4 h-4 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" />
                                            <span className="text-xs font-semibold dark:text-slate-300">Calcular Proporcional</span>
                                       </label>
                                       <div className="mt-3">
                                           <div className="flex justify-between items-center mb-2">
                                               <label className={STYLES.LABEL_TINY}>13º Vencidos (Mês/Ano)</label>
                                               <button onClick={add13thPeriod} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold hover:bg-indigo-200 transition">+ Adicionar</button>
                                           </div>
                                           
                                           {data.unpaid13thPeriods.length === 0 ? (
                                               <p className="text-xs text-slate-400 italic text-center py-2 border border-dashed border-slate-300 rounded-lg">Nenhum ano adicionado.</p>
                                           ) : (
                                               <div className="space-y-2">
                                                   {data.unpaid13thPeriods.map((period, idx) => (
                                                       <div key={period.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                                                           <div className="flex-1 grid grid-cols-2 gap-2">
                                                               <input 
                                                                   type="number" 
                                                                   placeholder="Mês" 
                                                                   className={`${STYLES.INPUT_TINY}`}
                                                                   value={period.month}
                                                                   onChange={e => update13thPeriod(period.id, 'month', Number(e.target.value))}
                                                                   min={1} max={12}
                                                               />
                                                               <input 
                                                                   type="number" 
                                                                   placeholder="Ano" 
                                                                   className={`${STYLES.INPUT_TINY}`}
                                                                   value={period.year}
                                                                   onChange={e => update13thPeriod(period.id, 'year', Number(e.target.value))}
                                                               />
                                                           </div>
                                                           <button onClick={() => remove13thPeriod(period.id)} className="text-slate-400 hover:text-red-500 p-1"><TrashIcon className="h-4 w-4" /></button>
                                                       </div>
                                                   ))}
                                               </div>
                                           )}
                                       </div>
                                   </div>

                          </div>
                      </div>
                      <div className={STYLES.CARD_SECTION}>
                          <h3 className={`${STYLES.CARD_TITLE} text-blue-600 dark:text-blue-400`}>
                              <BanknotesIcon className="h-5 w-5" /> FGTS e Multas Rescisórias
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                              <div className="space-y-4">
                                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                      <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm">FGTS (Conta Vinculada)</h4>
                                      <div>
                                          <label className={STYLES.LABEL_TEXT}>Saldo FGTS (Conta Vinculada)</label>
                                          <input 
                                            type="number" 
                                            className={STYLES.INPUT_FIELD} 
                                            value={data.hasFgtsBalance} 
                                            onChange={e => handleInputChange('hasFgtsBalance', e.target.value)} 
                                            placeholder="Saldo em conta..." 
                                            disabled={data.fgtsNoDeposits}
                                          />
                                          <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                              <input 
                                                type="checkbox" 
                                                checked={data.fgtsAllDeposited} 
                                                onChange={e => handleInputChange('fgtsAllDeposited', e.target.checked)} 
                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                disabled={data.fgtsNoDeposits}
                                              />
                                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">FGTS Totalmente Depositado (Período Integral)</span>
                                          </label>
                                          <p className="text-[10px] text-slate-500 mt-1 ml-6 leading-tight mb-4">
                                              Marque se o valor acima corresponde ao total devido de todo o contrato. Se desmarcado, o sistema considerará como valor parcial.
                                          </p>

                                          <label className={STYLES.LABEL_TEXT}>Multa 40% FGTS (Já paga)</label>
                                          <input 
                                            type="number" 
                                            className={STYLES.INPUT_FIELD} 
                                            value={data.hasFgtsPenaltyBalance} 
                                            onChange={e => handleInputChange('hasFgtsPenaltyBalance', e.target.value)} 
                                            placeholder="Multa 40% paga..." 
                                            disabled={data.fgtsNoDeposits}
                                          />
                                          <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                              <input 
                                                type="checkbox" 
                                                checked={data.fgtsPenaltyAllDeposited} 
                                                onChange={e => handleInputChange('fgtsPenaltyAllDeposited', e.target.checked)} 
                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                disabled={data.fgtsNoDeposits}
                                              />
                                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Multa 40% FGTS Totalmente Depositada (Período Integral)</span>
                                          </label>
                                          <p className="text-[10px] text-slate-500 mt-1 ml-6 leading-tight">
                                              Marque se o valor da multa acima corresponde ao total devido. Se desmarcado, o sistema considerará como valor parcial.
                                          </p>
                                      </div>
                                  </div>
                                  
                                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                      <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm">FGTS Não Depositado</h4>
                                      
                                      <label className="flex items-center gap-3 mb-4 cursor-pointer p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                           <input 
                                               type="checkbox" 
                                               checked={data.fgtsNoDeposits} 
                                               onChange={e => handleInputChange('fgtsNoDeposits', e.target.checked)} 
                                               className="w-5 h-5 text-red-600 rounded focus:ring-red-500" 
                                           />
                                           <span className="text-sm font-bold text-red-600 dark:text-red-400">Nenhum depósito realizado (Período Integral)</span>
                                      </label>

                                      {!data.fgtsNoDeposits && (
                                          <div className="space-y-4">
                                              <div>
                                                  <div className="flex justify-between items-center mb-2">
                                                      <label className={STYLES.LABEL_TINY}>Períodos sem depósito (Específicos)</label>
                                                      <button onClick={addFgtsPeriod} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold hover:bg-indigo-200 transition">+ Adicionar</button>
                                                  </div>
                                                  {data.fgtsSpecificMissingPeriods.length > 0 ? (
                                                      <div className="space-y-2 mb-4">
                                                          {data.fgtsSpecificMissingPeriods.map((period, idx) => (
                                                              <div key={period.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                                                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                                                      <input type="date" className={STYLES.INPUT_TINY} value={period.startDate} onChange={e => updateFgtsPeriod(period.id, 'startDate', e.target.value)} />
                                                                      <input type="date" className={STYLES.INPUT_TINY} value={period.endDate} onChange={e => updateFgtsPeriod(period.id, 'endDate', e.target.value)} />
                                                                  </div>
                                                                  <button onClick={() => removeFgtsPeriod(period.id)} className="text-slate-400 hover:text-red-500 p-1"><TrashIcon className="h-4 w-4" /></button>
                                                              </div>
                                                          ))}
                                                      </div>
                                                  ) : (
                                                      <p className="text-xs text-slate-400 italic mb-4">Nenhum período específico adicionado.</p>
                                                  )}
                                              </div>

                                              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                                  <label className={STYLES.LABEL_TINY}>Ou Quantidade de Meses (Simples)</label>
                                                  <input 
                                                      type="number" 
                                                      className={STYLES.INPUT_FIELD} 
                                                      value={data.unpaidFgtsMonths} 
                                                      onChange={e => handleInputChange('unpaidFgtsMonths', Number(e.target.value))}
                                                      placeholder="Ex: 5"
                                                  />
                                                  <p className="text-[10px] text-slate-400 mt-1">Use apenas se não quiser detalhar os períodos acima.</p>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              </div>
                              
                              <div className="space-y-4">
                                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                      <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm">Multas Rescisórias</h4>
                                      <div className="space-y-3">
                                          <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                                              <input type="checkbox" checked={data.applyFine477} onChange={e => handleInputChange('applyFine477', e.target.checked)} className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" />
                                              <span className="text-sm font-semibold dark:text-slate-200">Multa Art. 477 (Atraso Pagamento)</span>
                                          </label>
                                          <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                                              <input type="checkbox" checked={data.applyFine467} onChange={e => handleInputChange('applyFine467', e.target.checked)} className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" />
                                              <span className="text-sm font-semibold dark:text-slate-200">Multa Art. 467 (Verbas Incontroversas)</span>
                                          </label>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="flex justify-between mt-8">
                          <button onClick={() => setActiveTab(3)} className={STYLES.BTN_SECONDARY}>Voltar</button>
                          <button onClick={() => setActiveTab(5)} className={STYLES.BTN_PRIMARY}>Próxima Etapa <ArrowPathIcon className="h-4 w-4" /></button>
                      </div>
                  </div>
              )}

              {/* TAB 5: SITUAÇÕES ESPECIAIS E CONFIGURAÇÕES */}
              {activeTab === 5 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
                        <div className={`${STYLES.CARD_SECTION} bg-pink-50 dark:bg-pink-900/10 border-pink-100 dark:border-pink-900/30`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-pink-100 dark:bg-pink-900/40 rounded-full text-pink-600 dark:text-pink-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                    </svg>
                                </div>
                                <h3 className={`${STYLES.CARD_TITLE} text-pink-700 dark:text-pink-300 mb-0`}>Estabilidade Provisória</h3>
                            </div>
                            
                            <label className="flex items-center gap-3 cursor-pointer mb-6">
                                <input 
                                    type="checkbox" 
                                    checked={data.stability.active} 
                                    onChange={e => setData(prev => ({ ...prev, stability: { ...prev.stability, active: e.target.checked } }))} 
                                    className="w-5 h-5 text-pink-600 bg-pink-50 dark:bg-slate-700 border-pink-300 dark:border-pink-700 rounded focus:ring-pink-500" 
                                />
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                    Havia Estabilidade Provisória no momento da rescisão?
                                </span>
                            </label>

                            {data.stability.active && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-8 border-l-2 border-pink-200 dark:border-pink-800">
                                    <div>
                                        <label className={`${STYLES.LABEL_TEXT} text-pink-700 dark:text-pink-300`}>Tipo de Estabilidade</label>
                                        <select 
                                            className={`${STYLES.INPUT_FIELD} border-pink-200 focus:ring-pink-500`}
                                            value={data.stability.type}
                                            onChange={e => setData(prev => ({ ...prev, stability: { ...prev.stability, type: e.target.value as any } }))}
                                        >
                                            <option value="gestante">Gestante (5 meses após parto)</option>
                                            <option value="acidentaria">Acidentária (12 meses após alta)</option>
                                            <option value="cipa">CIPA (Até 2 anos após mandato)</option>
                                            <option value="outros">Outros / Dirigente Sindical</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`${STYLES.LABEL_TEXT} text-pink-700 dark:text-pink-300`}>Data Final da Estabilidade</label>
                                        <input 
                                            type="date" 
                                            className={`${STYLES.INPUT_FIELD} border-pink-200 focus:ring-pink-500`} 
                                            value={data.stability.endDate} 
                                            onChange={e => setData(prev => ({ ...prev, stability: { ...prev.stability, endDate: e.target.value } }))} 
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Informe a data em que terminaria a estabilidade.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                      <div className={STYLES.CARD_SECTION}>
                          <h3 className={`${STYLES.CARD_TITLE} text-purple-600 dark:text-purple-400`}>
                              <BriefcaseIcon className="h-5 w-5" /> Indenizações e Honorários
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                              <div className="space-y-4">
                                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                    <div>
                                        <label className={STYLES.LABEL_TEXT}>Indenização por Danos Morais (Estimativa R$)</label>
                                        <input type="number" className={STYLES.INPUT_FIELD} value={data.moralDamages} onChange={e => handleInputChange('moralDamages', Number(e.target.value))} placeholder="0.00" />
                                    </div>
                                  </div>
                              </div>
                              <div className="space-y-4">
                                   <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                       <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 text-sm">Honorários Advocatícios</h4>
                                       <label className={STYLES.LABEL_TINY}>Percentual de Sucumbência</label>
                                       <select 
                                           className={STYLES.INPUT_TINY} 
                                           value={data.attorneyFees} 
                                           onChange={e => handleInputChange('attorneyFees', Number(e.target.value))}
                                       >
                                           <option value={0}>Não aplicar</option>
                                           <option value={5}>5%</option>
                                           <option value={10}>10%</option>
                                           <option value={15}>15%</option>
                                           <option value={20}>20%</option>
                                           <option value={25}>25%</option>
                                           <option value={30}>30%</option>
                                       </select>
                                   </div>
                              </div>
                          </div>
                      </div>

                      <div className="flex justify-between mt-8">
                          <button onClick={() => setActiveTab(4)} className={STYLES.BTN_SECONDARY}>Voltar</button>
                          <button 
                            onClick={() => {
                                const results = calculateLaborResults(data);
                                setCalcResult(results);
                                setTotalValue(results.reduce((acc, curr) => acc + curr.value, 0));
                                setActiveTab(6);
                            }} 
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-green-500/30 flex items-center gap-2 transform hover:scale-105 transition-all"
                          >
                             <CalculatorIcon className="h-5 w-5" /> Calcular Tudo
                          </button>
                      </div>
                  </div>
              )}

              {/* TAB 6: RESULTADOS */}
              {activeTab === 6 && (
                  <div className="animate-in zoom-in-95 duration-500 space-y-6">
                      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
                          <div>
                              <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Estimado Bruto</p>
                              <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                                  {formatCurrency(totalValue)}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs text-slate-400 font-medium">Rito Processual:</span>
                                  {(() => {
                                      const rite = getProceduralRite(totalValue);
                                      return (
                                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${rite.color}`} title={rite.description}>
                                              {rite.name}
                                          </span>
                                      );
                                  })()}
                              </div>
                          </div>
                          <div className="flex gap-3">
                              <button onClick={() => setActiveTab(5)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm transition">
                                  Revisar Dados
                              </button>
                              {editingId ? (
                                  <>
                                      <button onClick={() => handleSave(false)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-500/50 flex items-center gap-2 transition">
                                          <ArrowPathIcon className="h-5 w-5" /> Atualizar
                                      </button>
                                      <button onClick={() => handleSave(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/50 flex items-center gap-2 transition">
                                          <PlusIcon className="h-5 w-5" /> Salvar Novo
                                      </button>
                                  </>
                              ) : (
                                  <button onClick={() => handleSave(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/50 flex items-center gap-2 transition">
                                      <ArchiveBoxIcon className="h-5 w-5" /> Salvar
                                  </button>
                              )}
                              <button onClick={() => generatePDF()} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/50 flex items-center gap-2 transition">
                                  <DocumentTextIcon className="h-5 w-5" /> PDF
                              </button>
                          </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 dark:bg-slate-900/50">
                                  <tr>
                                      <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">Descrição</th>
                                      <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-right">Valor</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {calcResult.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                          <td className="px-6 py-4">
                                              <span className="block font-medium text-slate-800 dark:text-slate-200">{item.desc}</span>
                                              <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">{item.category}</span>
                                          </td>
                                          <td className="px-6 py-4 text-right font-mono text-slate-700 dark:text-slate-300 font-bold">
                                              {formatCurrency(item.value)}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                      
                      <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 flex gap-3">
                          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-500 shrink-0" />
                          <p className="text-xs text-yellow-700 dark:text-yellow-400">
                              <strong>Atenção:</strong> Estes valores são estimativas baseadas nos dados inseridos e não substituem o cálculo oficial de liquidação de sentença. Verifique convenções coletivas para alíquotas específicas.
                          </p>
                      </div>
                  </div>
              )}

          </div>
      </div>
      
    </div>
  );
}
