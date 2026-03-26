import { CNISBond, SocialSecurityData } from './SocialSecurityCalc';
import { getCurrentMinimumWage } from './constants/MinimumWage';

export interface BenefitResult {
    benefitName: string;
    isEligible: boolean;
    missingDetails?: string;
    rmi?: number;
    rmiDetails?: {
        salaries: {
            month: string;
            originalValue: number;
            correctionFactor: number;
            correctedValue: number;
            isLimit: boolean;
        }[];
        average: number;
        calculationFormula: string;
        appliedFactor: number;
        finalRMI: number;
        isFloorApplied: boolean;
    };
    ruleType: 'Pre-Reform' | 'Transition' | 'Post-Reform' | 'Transition_50' | 'Transition_100' | 'Disability' | 'TemporaryDisability' | 'Death' | 'Pre-Reform-8696' | 'Pre-Reform-Age' | 'Pre-Reform-Special' | 'Pre-Reform-Disability' | 'Pre-Reform-Teacher' | 'Pre-Reform-Death';
    category: 'aposentadorias' | 'auxilios' | 'dependentes';
}

export interface SimulationResult {
    totalTime: { years: number, months: number, days: number, totalDays: number };
    totalCarencia: number; // months
    age: { years: number, months: number, days: number };
    points: number;
    gender: 'M' | 'F';
    isTeacher: boolean; // Simplified check
    isPcd: boolean; // Simplified check
    benefits: BenefitResult[];
}

// Helper to calculate time up to a specific date
// Helper to safely parse YYYY-MM-DD to local noon to avoid timezone drift
export const parseDateLocal = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (dateStr.length === 10 && dateStr.includes('-')) {
        return new Date(dateStr + 'T12:00:00');
    }
    return new Date(dateStr);
};

export const calculateTimeForPeriod = (
    bonds: CNISBond[], 
    endDateStr: string, 
    gender: 'M' | 'F'
) => {
    // Filter bonds just like SocialSecurityCalc.tsx does
    const activeBonds = bonds.filter(b => b.useInCalculation && b.startDate && b.endDate);
    
    // Filter benefit bonds that are intercalated
    const bondsToProcess = activeBonds.filter(b => !b.isBenefit || isBondIntercalated(b, bonds));
    
    if (bondsToProcess.length === 0) return { years: 0, months: 0, days: 0, totalDays: 0 };

    const targetEndMs = parseDateLocal(endDateStr).setHours(12, 0, 0, 0);

    // 1. Determine Global Range
    let minDateMs = Infinity;
    let maxDateMs = -Infinity;

    const processedBonds = bondsToProcess.map(b => {
        const start = parseDateLocal(b.startDate!);
        start.setHours(12, 0, 0, 0);
        
        let bondEnd = parseDateLocal(b.endDate!);
        bondEnd.setHours(12, 0, 0, 0);

        // Cap bond end at target date
        if (bondEnd.getTime() > targetEndMs) {
            bondEnd = new Date(targetEndMs);
        }

        // If bond starts after target date, it's invalid for this period
        if (start.getTime() > targetEndMs) {
            return null;
        }

        if (start.getTime() < minDateMs) minDateMs = start.getTime();
        if (bondEnd.getTime() > maxDateMs) maxDateMs = bondEnd.getTime();

        // Determine Factor
        let factor = 1.0;
        if (b.activityType === 'special_25') factor = gender === 'M' ? 1.4 : 1.2;
        else if (b.activityType === 'special_20') factor = gender === 'M' ? 1.75 : 1.5;
        else if (b.activityType === 'special_15') factor = gender === 'M' ? 2.33 : 2.0;

        return { startMs: start.getTime(), endMs: bondEnd.getTime(), factor, activityType: b.activityType };
    }).filter(b => b !== null && !isNaN(b.startMs) && !isNaN(b.endMs) && b.startMs <= b.endMs) as { startMs: number, endMs: number, factor: number, activityType: string }[];

    if (processedBonds.length === 0) return { years: 0, months: 0, days: 0, totalDays: 0 };

    // EC 103/2019 Reform Date (13/11/2019)
    const REFORM_DATE_MS = new Date('2019-11-13').setHours(12, 0, 0, 0);

    let totalAdjustedDays = 0;
    
    // 2. Iterate Day by Day
    let current = new Date(minDateMs);
    const maxDate = new Date(maxDateMs);
    
    // Limit to 100 years
    const MAX_LOOPS = 100 * 366; 
    let loops = 0;

    while (current <= maxDate && loops < MAX_LOOPS) {
        const currentMs = current.getTime();
        
        let maxFactorForDay = 0;
        let isActive = false;

        for (const bond of processedBonds) {
            if (currentMs >= bond.startMs && currentMs <= bond.endMs) {
                isActive = true;
                // Apply factor only if Pre-Reform (before 13/11/2019)
                // AND only if the bond type is special
                let applicableFactor = 1.0;
                if (currentMs <= REFORM_DATE_MS) {
                     applicableFactor = bond.factor;
                }
                
                if (applicableFactor > maxFactorForDay) {
                    maxFactorForDay = applicableFactor;
                }
            }
        }

        if (isActive) {
            totalAdjustedDays += maxFactorForDay;
        }

        // Next day
        current.setDate(current.getDate() + 1);
        current.setHours(12, 0, 0, 0);
        loops++;
    }

    const years = Math.floor(totalAdjustedDays / 365);
    const months = Math.floor((totalAdjustedDays % 365) / 30);
    const days = Math.floor((totalAdjustedDays % 365) % 30);
    
    let adjYears = years;
    let adjMonths = months;
    if (adjMonths >= 12) {
        adjYears += 1;
        adjMonths -= 12;
    }
    
    return { years: adjYears, months: adjMonths, days, totalDays: totalAdjustedDays };
};

export const calculateAge = (birthDateStr: string, targetDateStr: string) => {
    if (!birthDateStr) return { years: 0, months: 0, days: 0 };
    
    const birth = parseDateLocal(birthDateStr);
    const target = parseDateLocal(targetDateStr);
    
    if (isNaN(birth.getTime())) return { years: 0, months: 0, days: 0 };

    let years = target.getFullYear() - birth.getFullYear();
    let months = target.getMonth() - birth.getMonth();
    let days = target.getDate() - birth.getDate();

    if (days < 0) {
        months--;
        days += 30; // Approx
    } else if (days >= 30) {
        months++;
        days -= 30;
    }
    if (months < 0) {
        years--;
        months += 12;
    } else if (months >= 12) {
        years++;
        months -= 12;
    }
    
    return { years, months, days };
};

// --- RMI Calculation Logic ---
import { IBGE_LIFE_EXPECTANCY, getLifeExpectancy } from './src/constants/ibgeTable';
import { IBGELifeExpectancy, getLifeExpectancyFromTable } from './src/services/ibgeService';

export const calculateRMI = (
    bonds: CNISBond[], 
    ruleType: 'Pre-Reform' | 'Post-Reform' | 'Transition_50' | 'Transition_100' | 'Disability' | 'TemporaryDisability' | 'Death' | 'Pre-Reform-8696' | 'Pre-Reform-Age' | 'Pre-Reform-Special' | 'Pre-Reform-Disability' | 'Pre-Reform-Teacher' | 'Pre-Reform-Death',
    gender: 'M' | 'F',
    totalYears: number,
    inpcIndices?: Map<string, number>,
    der?: string,
    ageYears?: number,
    customMinWage?: number,
    salaryLimitDate?: string,
    isTeacher?: boolean,
    ibgeTable?: IBGELifeExpectancy[]
) => {
    // 1. Flatten and Group Salaries (Sum Concomitant)
    const groupedSalaries = new Map<string, { date: Date, value: number, originalValue: number, correctionFactor: number, monthStr: string }>();
    
    let derMonthStr = "";
    const derDate = der ? parseDateLocal(der) : new Date();
    const limitDate = salaryLimitDate ? new Date(salaryLimitDate) : new Date(2100, 0, 1);

    if (der) {
        const [y, m, d] = der.split('-').map(Number);
        derMonthStr = `${m}/${y}`;
    }

    bonds.forEach(b => {
        if (!b.useInCalculation) return;
        b.sc.forEach(s => {
            // Parse MM/YYYY
            const [mes, ano] = s.month.split('/').map(Number);
            const date = new Date(ano, mes - 1, 1);
            
            // Filter >= July 1994 AND <= DER AND <= salaryLimitDate
            if (date >= new Date(1994, 6, 1) && date <= derDate && date <= limitDate) {
                let correctedValue = s.value;
                let correctionFactor = 1.0;

                if (inpcIndices && derMonthStr) {
                    const contributionMonthStr = `${mes}/${ano}`;
                    
                    // 1. Find End Factor (Month prior to DER)
                    const [derY, derM] = der!.split('-').map(Number);
                    let targetEndDate = new Date(derY, derM - 1, 1);
                    targetEndDate.setMonth(targetEndDate.getMonth() - 1);
                    
                    // Get latest available index in map
                    let latestDate = new Date(1900, 0, 1);
                    let latestFactor = 1.0;
                    
                    inpcIndices.forEach((val, key) => {
                        const [km, ky] = key.split('/').map(Number);
                        const kd = new Date(ky, km - 1, 1);
                        if (kd > latestDate) {
                            latestDate = kd;
                            latestFactor = val;
                        }
                    });

                    let endFactor = latestFactor;
                    let actualEndMonthDate = latestDate;

                    // Try to find the specific month prior to DER
                    const searchStr = `${targetEndDate.getMonth() + 1}/${targetEndDate.getFullYear()}`;
                    if (inpcIndices.has(searchStr)) {
                        endFactor = inpcIndices.get(searchStr)!;
                        actualEndMonthDate = targetEndDate;
                    }

                    const startFactor = inpcIndices.get(contributionMonthStr);
                    const contributionDate = new Date(ano, mes - 1, 1);

                    if (startFactor) {
                        // If contribution is after or equal to the month used for endFactor, factor is 1.0
                        if (contributionDate >= actualEndMonthDate) {
                            correctionFactor = 1.0;
                        } else {
                            correctionFactor = endFactor / startFactor;
                            // Safety: correction factor should not be less than 1.0 for inflation
                            if (correctionFactor < 1.0) correctionFactor = 1.0;
                        }
                        correctedValue = s.value * correctionFactor;
                    }
                }

                const existing = groupedSalaries.get(s.month);
                if (existing) {
                    existing.value += correctedValue;
                    existing.originalValue += s.value;
                } else {
                    groupedSalaries.set(s.month, { 
                        date, 
                        value: correctedValue, 
                        originalValue: s.value, 
                        correctionFactor, 
                        monthStr: s.month 
                    });
                }
            }
        });
    });

    let allSalaries = Array.from(groupedSalaries.values());

    if (allSalaries.length === 0) return { rmi: 0, rmiDetails: undefined };

    // Sort by value descending for picking highest (80% rule)
    const sortedByValue = [...allSalaries].sort((a, b) => b.value - a.value);

    let average = 0;
    let calculationFormula = "";
    let appliedFactor = 1.0;
    let finalRMI = 0;
    let salariesUsed = [];

    if (ruleType.startsWith('Pre-Reform')) {
        // Average of 80% highest
        const cutoff = Math.floor(sortedByValue.length * 0.8);
        const top80 = sortedByValue.slice(0, cutoff);
        salariesUsed = top80;
        
        const sum = top80.reduce((acc, curr) => acc + curr.value, 0);
        average = sum / (top80.length || 1);
        
        calculationFormula = `Média dos 80% maiores salários (${top80.length} de ${sortedByValue.length})`;

        // Fator Previdenciário Calculation (Simplified)
        let fator = 1.0;
        
        if (ruleType === 'Pre-Reform' || ruleType === 'Pre-Reform-Teacher' || ruleType === 'Transition_50') {
            // Apply Factor
            const Id = ageYears || 60;
            let Es = 0;
            let formulaDetails = "";
            if (ibgeTable && ibgeTable.length > 0) {
                Es = getLifeExpectancyFromTable(ibgeTable, Id);
                formulaDetails = `Es (IBGE API)=${Es.toFixed(2)}`;
            } else {
                Es = getLifeExpectancy(Id);
                formulaDetails = `Es (IBGE Estático)=${Es.toFixed(2)}`;
            }
            const a = 0.31;
            
            // Bonus for Tc in formula
            let TcBonus = 0;
            if (gender === 'F') TcBonus += 5;
            if (isTeacher) {
                if (gender === 'M') TcBonus += 5;
                else TcBonus += 10;
            }
            
            const Tc = totalYears + TcBonus;
            
            fator = ((Tc * a) / Es) * (1 + (Id + (Tc * a)) / 100);
            appliedFactor = fator;
            calculationFormula += ` x Fator Previdenciário (${fator.toFixed(4)}) [${formulaDetails}, Tc+Bonus=${Tc.toFixed(2)}]`;
        }
        
        if (ruleType === 'Pre-Reform-8696' || ruleType === 'Pre-Reform-Special' || ruleType === 'Pre-Reform-Disability' || ruleType === 'Pre-Reform-Death') {
            fator = 1.0;
            appliedFactor = 1.0;
            calculationFormula += ` (Integral - 100%)`;
        }

        if (ruleType === 'Pre-Reform-Age') {
            let coef = 0.70 + (totalYears * 0.01);
            if (coef > 1.0) coef = 1.0;
            fator = coef;
            appliedFactor = coef;
            calculationFormula += ` x Coeficiente Idade (${(coef * 100).toFixed(0)}%)`;
        }

        finalRMI = average * fator;
    } else {
        // Average of 100% (Post-Reform)
        salariesUsed = sortedByValue;
        const sum = sortedByValue.reduce((acc, curr) => acc + curr.value, 0);
        average = sum / sortedByValue.length;
        calculationFormula = `Média de 100% dos salários (${sortedByValue.length})`;

        // Apply Coefficients
        let coef = 1.0;
        if (ruleType === 'Transition_100') {
            coef = 1.0;
            calculationFormula += ` (Pedágio 100% - Integral)`;
        } else if (ruleType === 'Transition_50') {
            const Id = ageYears || 60;
            let Es = 0;
            let formulaDetails = "";
            if (ibgeTable && ibgeTable.length > 0) {
                Es = getLifeExpectancyFromTable(ibgeTable, Id);
                formulaDetails = `Es (IBGE API)=${Es.toFixed(2)}`;
            } else {
                Es = getLifeExpectancy(Id);
                formulaDetails = `Es (IBGE Estático)=${Es.toFixed(2)}`;
            }
            const a = 0.31;
            
            // Bonus for Tc in formula
            let TcBonus = 0;
            if (gender === 'F') TcBonus += 5;
            if (isTeacher) {
                if (gender === 'M') TcBonus += 5;
                else TcBonus += 10;
            }
            
            const Tc = totalYears + TcBonus;
            
            const fator = ((Tc * a) / Es) * (1 + (Id + (Tc * a)) / 100);
            coef = fator;
            appliedFactor = fator;
            calculationFormula += ` x Fator Previdenciário (${fator.toFixed(4)}) [${formulaDetails}, Tc+Bonus=${Tc.toFixed(2)}]`;
        } else if (ruleType === 'Disability') {
            let base = 0.60;
            const threshold = gender === 'M' ? 20 : 15;
            if (totalYears > threshold) {
                base += (totalYears - threshold) * 0.02;
            }
            coef = base;
            calculationFormula += ` x Coeficiente Incapacidade Permanente (${(coef * 100).toFixed(0)}%)`;
        } else if (ruleType === 'TemporaryDisability') {
            coef = 0.91;
            calculationFormula += ` x Coeficiente Incapacidade Temporária (91%)`;
        } else if (ruleType === 'Death') {
            coef = 0.60; // Base 50% + 10%
            calculationFormula += ` x Cota Pensão (60%)`;
        } else {
            // General Rule
            let base = 0.60;
            const threshold = gender === 'M' ? 20 : 15;
            if (totalYears > threshold) {
                base += (totalYears - threshold) * 0.02;
            }
            coef = base;
            calculationFormula += ` x Coeficiente (${(coef * 100).toFixed(0)}%)`;
        }
        appliedFactor = coef;
        finalRMI = average * coef;
    }

    // Apply Minimum Wage Floor (Piso Nacional)
    const currentMW = customMinWage || getCurrentMinimumWage(der);
    let isFloorApplied = false;
    
    if (finalRMI < currentMW) {
        finalRMI = currentMW;
        isFloorApplied = true;
        calculationFormula += ` [Piso Salário Mínimo Aplicado: ${currentMW.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}]`;
    }

    // Sort salariesUsed chronologically (most recent to oldest) for display
    const displaySalaries = [...salariesUsed].sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
        rmi: finalRMI,
        rmiDetails: {
            salaries: displaySalaries.map(s => ({
                month: s.monthStr,
                originalValue: s.originalValue,
                correctionFactor: s.correctionFactor,
                correctedValue: s.value,
                isLimit: false
            })),
            average,
            calculationFormula,
            appliedFactor,
            finalRMI,
            isFloorApplied
        }
    };
};

// Helper to check Quality of Insured (Qualidade de Segurado)
export const checkInsuredQuality = (bonds: CNISBond[], der: string): { hasQuality: boolean, gracePeriodEnd: Date } => {
    // 1. Find the latest bond end date
    let lastBondEnd = new Date(0);
    let hasActiveBond = false;

    bonds.forEach(b => {
        if (!b.useInCalculation) return;
        if (!b.endDate) {
            hasActiveBond = true; // Active bond means insured
        } else {
            const end = parseDateLocal(b.endDate);
            if (end > lastBondEnd) lastBondEnd = end;
        }
    });

    if (hasActiveBond) return { hasQuality: true, gracePeriodEnd: new Date() };

    // 2. Calculate Grace Period (Período de Graça)
    // Rule: 12 months + 12 months (if > 120 contributions) + 12 months (unemployment)
    // Simplified: 12 months base.
    // TODO: Advanced logic for 120 contributions and unemployment check.
    
    // Check total contributions for 120+ rule
    let totalContributionMonths = 0;
    const uniqueMonths = new Set<string>();
    bonds.forEach(b => {
        if (!b.useInCalculation) return;
        if (b.sc.length > 0) {
             b.sc.forEach(s => uniqueMonths.add(s.month));
        } else if (b.startDate && b.endDate) {
             let start = parseDateLocal(b.startDate);
             let end = parseDateLocal(b.endDate);
             let safety = 0;
             while(start <= end && safety < 1200) {
                 uniqueMonths.add(`${start.getMonth()+1}/${start.getFullYear()}`);
                 start.setMonth(start.getMonth() + 1);
                 safety++;
             }
        }
    });
    totalContributionMonths = uniqueMonths.size;

    let graceMonths = 12;
    if (totalContributionMonths >= 120) {
        graceMonths += 12; // Extension for > 120 contributions without loss of quality
    }
    
    // Unemployment extension (requires proof, defaulting to false for safety unless we add a UI toggle)
    // graceMonths += 12; 

    // Add grace months to last bond end
    const gracePeriodEnd = new Date(lastBondEnd);
    gracePeriodEnd.setMonth(gracePeriodEnd.getMonth() + graceMonths);
    // Add 45 days (approx 1.5 months) for payment deadline? No, usually just the month.
    // The law says "up to 15th of the month following the end of grace period".
    gracePeriodEnd.setDate(15);
    gracePeriodEnd.setMonth(gracePeriodEnd.getMonth() + 2); // +2 to be safe on "following month" logic? 
    // Let's stick to standard: End Date + Grace Months + 1.5 months (payment window)
    
    const derDate = parseDateLocal(der);
    return { hasQuality: derDate <= gracePeriodEnd, gracePeriodEnd };
};

// Helper to check if a benefit bond is intercalated between contributions
export const isBondIntercalated = (benefit: CNISBond, allBonds: CNISBond[]) => {
    if (!benefit.isBenefit) return true;
    if (!benefit.startDate || !benefit.endDate) return false;
    
    const bStart = parseDateLocal(benefit.startDate).getTime();
    const bEnd = parseDateLocal(benefit.endDate).getTime();
    
    const contributionBonds = allBonds.filter(b => !b.isBenefit && b.useInCalculation && b.startDate && b.endDate);
    
    // Must have a contribution BEFORE (within grace period, approx 13 months)
    const hasContribBefore = contributionBonds.some(c => {
        const cEnd = parseDateLocal(c.endDate!).getTime();
        const gap = bStart - cEnd;
        // 13 months buffer (1.1 years) to match SocialSecurityCalc.tsx
        return cEnd <= bStart && gap <= (365 * 24 * 60 * 60 * 1000 * 1.1);
    });

    // Must have a contribution AFTER (within grace period)
    const hasContribAfter = contributionBonds.some(c => {
        const cStart = parseDateLocal(c.startDate!).getTime();
        const gap = cStart - bEnd;
        return cStart >= bEnd && gap <= (365 * 24 * 60 * 60 * 1000 * 1.1);
    });

    return hasContribBefore && hasContribAfter;
};

// Helper to calculate carencia (unique contribution months)
export const calculateCarencia = (bonds: CNISBond[], targetDate: string, allBonds: CNISBond[]) => {
    const carenciaMonths = new Set<string>();
    const target = parseDateLocal(targetDate);
    
    bonds.forEach(bond => {
        if (!bond.useInCalculation || !bond.startDate || !bond.endDate) return;
        
        const start = parseDateLocal(bond.startDate);
        const end = parseDateLocal(bond.endDate);
        
        // If bond is after target date, skip
        if (start > target) return;
        
        // Cap end date at target date
        const effectiveEnd = end > target ? target : end;
        
        // If it's a benefit, it must be intercalated
        if (bond.isBenefit && !isBondIntercalated(bond, allBonds)) return;
        
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        const last = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1);
        
        while (current <= last) {
            carenciaMonths.add(`${current.getFullYear()}-${current.getMonth()}`);
            current.setMonth(current.getMonth() + 1);
        }
    });
    
    return carenciaMonths.size;
};

export const analyzeBenefits = (data: SocialSecurityData, inpcIndices?: Map<string, number>, ibgeTable?: IBGELifeExpectancy[]): SimulationResult => {
    if (!data || !data.bonds) {
        return {
            totalTime: { years: 0, months: 0, days: 0, totalDays: 0 },
            totalCarencia: 0,
            age: { years: 0, months: 0, days: 0 },
            points: 0,
            gender: data?.gender || 'M',
            isTeacher: data?.isTeacher || false,
            isPcd: data?.isPcd || false,
            benefits: []
        };
    }
    const der = data.der || new Date().toISOString().split('T')[0];
    const timeTotal = calculateTimeForPeriod(data.bonds, der, data.gender);
    const age = calculateAge(data.birthDate, der);
    const fractionalAge = age.years + (age.months / 12) + (age.days / 365);
    
    // Calculate Carência (Simplified: count unique months in bonds)
    const totalCarencia = calculateCarencia(data.bonds, der, data.bonds);

    const points = (age.years + timeTotal.years) + 
                   ((age.months + timeTotal.months) / 12) + 
                   ((age.days + timeTotal.days) / 365);
    
    // Check Insured Quality
    const { hasQuality, gracePeriodEnd } = checkInsuredQuality(data.bonds, der);

    const benefits: BenefitResult[] = [];

    // --- 0. BENEFÍCIOS PRÉ-REFORMA (DIREITO ADQUIRIDO ATÉ 13/11/2019) ---
    
    // Calculate stats at Reform Date
    const reformDate = '2019-11-13';
    const timeAtReformTotal = calculateTimeForPeriod(data.bonds, reformDate, data.gender);
    const ageAtReform = calculateAge(data.birthDate, reformDate);
    const pointsAtReform = (ageAtReform.years + timeAtReformTotal.years) + 
                           ((ageAtReform.months + timeAtReformTotal.months) / 12) + 
                           ((ageAtReform.days + timeAtReformTotal.days) / 365);
    
    // Calculate Carência at Reform
    const carenciaAtReform = calculateCarencia(data.bonds, reformDate, data.bonds);

    // 0.1 Aposentadoria por Tempo de Contribuição (Regra Geral - Pré-Reforma)
    const timeReqPre = data.gender === 'M' ? 35 : 30;
    if (timeAtReformTotal.years >= timeReqPre && carenciaAtReform >= 180) {
        benefits.push({
            benefitName: "0.1) Aposentadoria por Tempo de Contribuição (Direito Adquirido - Regra Geral)",
            isEligible: true,
            ruleType: 'Pre-Reform',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Pre-Reform', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "0.1) Aposentadoria por Tempo de Contribuição (Direito Adquirido - Regra Geral)",
            isEligible: false,
            ruleType: 'Pre-Reform',
            category: 'aposentadorias',
            missingDetails: `Em 13/11/2019: Tempo ${timeAtReformTotal.years}/${timeReqPre}. Carência ${carenciaAtReform}/180.`
        });
    }

    // 0.2 Aposentadoria por Tempo de Contribuição (Regra 86/96 - Pré-Reforma)
    const pointsReqPre = data.gender === 'M' ? 96 : 86;
    if (timeAtReformTotal.years >= timeReqPre && pointsAtReform >= pointsReqPre && carenciaAtReform >= 180) {
        benefits.push({
            benefitName: "0.2) Aposentadoria por Tempo de Contribuição (Direito Adquirido - Pontos 86/96)",
            isEligible: true,
            ruleType: 'Pre-Reform-8696',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Pre-Reform-8696', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "0.2) Aposentadoria por Tempo de Contribuição (Direito Adquirido - Pontos 86/96)",
            isEligible: false,
            ruleType: 'Pre-Reform-8696',
            category: 'aposentadorias',
            missingDetails: `Em 13/11/2019: Pontos ${pointsAtReform.toFixed(2)}/${pointsReqPre}. Tempo ${timeAtReformTotal.years}/${timeReqPre}.`
        });
    }

    // 0.3 Aposentadoria por Idade Urbana (Pré-Reforma)
    const ageReqPre = data.gender === 'M' ? 65 : 60;
    if (ageAtReform.years >= ageReqPre && carenciaAtReform >= 180) {
        benefits.push({
            benefitName: "0.3) Aposentadoria por Idade Urbana (Direito Adquirido)",
            isEligible: true,
            ruleType: 'Pre-Reform-Age',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Pre-Reform-Age', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "0.3) Aposentadoria por Idade Urbana (Direito Adquirido)",
            isEligible: false,
            ruleType: 'Pre-Reform-Age',
            category: 'aposentadorias',
            missingDetails: `Em 13/11/2019: Idade ${ageAtReform.years}/${ageReqPre}. Carência ${carenciaAtReform}/180.`
        });
    }

    // 0.4 Aposentadoria Especial (Pré-Reforma)
    // Need to calculate special time at reform
    let specialTime15Pre = 0;
    let specialTime20Pre = 0;
    let specialTime25Pre = 0;
    
    const reformDateObj = parseDateLocal(reformDate);
    data.bonds.forEach(b => {
        if (!b.useInCalculation || !b.startDate) return;
        const start = parseDateLocal(b.startDate);
        let end = b.endDate ? parseDateLocal(b.endDate) : new Date();
        if (end > reformDateObj) end = parseDateLocal(reformDate);
        if (start > reformDateObj) return;

        const diff = end.getTime() - start.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        const years = days / 365;
        
        if (b.activityType === 'special_15') specialTime15Pre += years;
        if (b.activityType === 'special_20') specialTime20Pre += years;
        if (b.activityType === 'special_25') specialTime25Pre += years;
    });

    if (specialTime25Pre >= 25) {
         benefits.push({
            benefitName: "0.4a) Aposentadoria Especial (Direito Adquirido - 25 Anos)",
            isEligible: true,
            ruleType: 'Pre-Reform-Special',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Pre-Reform-Special', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable)
        });
    } else if (specialTime20Pre >= 20) {
         benefits.push({
            benefitName: "0.4b) Aposentadoria Especial (Direito Adquirido - 20 Anos)",
            isEligible: true,
            ruleType: 'Pre-Reform-Special',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Pre-Reform-Special', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable)
        });
    } else if (specialTime15Pre >= 15) {
         benefits.push({
            benefitName: "0.4c) Aposentadoria Especial (Direito Adquirido - 15 Anos)",
            isEligible: true,
            ruleType: 'Pre-Reform-Special',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Pre-Reform-Special', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable)
        });
    } else {
         benefits.push({
            benefitName: "0.4) Aposentadoria Especial (Direito Adquirido)",
            isEligible: false,
            ruleType: 'Pre-Reform-Special',
            category: 'aposentadorias',
            missingDetails: `Em 13/11/2019: Tempo Especial (25): ${specialTime25Pre.toFixed(1)}/25.`
        });
    }

    // 0.5 Aposentadoria do Professor (Pré-Reforma)
    const teacherTimeReqPre = data.gender === 'M' ? 30 : 25;
    if (data.isTeacher) {
        if (timeAtReformTotal.years >= teacherTimeReqPre) {
             benefits.push({
                benefitName: "0.5) Aposentadoria do Professor (Direito Adquirido)",
                isEligible: true,
                ruleType: 'Pre-Reform-Teacher',
                category: 'aposentadorias',
                ...calculateRMI(data.bonds, 'Pre-Reform-Teacher', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable)
            });
        } else {
             benefits.push({
                benefitName: "0.5) Aposentadoria do Professor (Direito Adquirido)",
                isEligible: false,
                ruleType: 'Pre-Reform-Teacher',
                category: 'aposentadorias',
                missingDetails: `Em 13/11/2019: Tempo Professor ${timeAtReformTotal.years}/${teacherTimeReqPre}.`
            });
        }
    }

    // Check Insured Quality at Reform Date (for Pre-Reform benefits)
    const { hasQuality: hasQualityAtReform } = checkInsuredQuality(data.bonds, reformDate);

    // 0.6 Aposentadoria por Invalidez (Pré-Reforma)
    if (carenciaAtReform >= 12 && hasQualityAtReform) { 
         benefits.push({
            benefitName: "0.6) Aposentadoria por Invalidez (Direito Adquirido)",
            isEligible: true, // Potential
            ruleType: 'Pre-Reform-Disability',
            category: 'auxilios',
            ...calculateRMI(data.bonds, 'Pre-Reform-Disability', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable),
            missingDetails: "Requer comprovação de incapacidade permanente antes de 13/11/2019."
        });
    } else {
         benefits.push({
            benefitName: "0.6) Aposentadoria por Invalidez (Direito Adquirido)",
            isEligible: false,
            ruleType: 'Pre-Reform-Disability',
            category: 'auxilios',
            missingDetails: !hasQualityAtReform 
                ? "Segurado sem qualidade em 13/11/2019." 
                : `Carência em 13/11/2019: ${carenciaAtReform}/12.`
        });
    }

    // 0.7 Pensão por Morte (Pré-Reforma)
    if (hasQualityAtReform) {
        benefits.push({
            benefitName: "0.7) Pensão por Morte (Óbito antes de 13/11/2019)",
            isEligible: true, // Potential
            ruleType: 'Pre-Reform-Death',
            category: 'dependentes',
            ...calculateRMI(data.bonds, 'Pre-Reform-Death', data.gender, timeAtReformTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, reformDate, data.isTeacher, ibgeTable),
            missingDetails: "Requer óbito do instituidor antes de 13/11/2019."
        });
    } else {
        benefits.push({
            benefitName: "0.7) Pensão por Morte (Óbito antes de 13/11/2019)",
            isEligible: false,
            ruleType: 'Pre-Reform-Death',
            category: 'dependentes',
            missingDetails: "Instituidor sem qualidade de segurado em 13/11/2019."
        });
    }

    // --- 1. APOSENTADORIAS (POST-REFORM) ---

    // 1.1 Aposentadoria por idade (Filiados até 13/11/2019)
    const ageReqOld = data.gender === 'M' ? 65 : 62;
    if (age.years >= ageReqOld && timeTotal.years >= 15 && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.1) Aposentadoria por idade (Filiados até 13/11/2019)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "1.1) Aposentadoria por idade (Filiados até 13/11/2019)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Idade: ${age.years}/${ageReqOld}. Tempo: ${timeTotal.years}/15. Carência: ${totalCarencia}/180.`
        });
    }

    // 1.2 Aposentadoria por idade (Filiados após 13/11/2019)
    const timeReqNew = data.gender === 'M' ? 20 : 15;
    if (age.years >= 65 && timeTotal.years >= timeReqNew && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.2) Aposentadoria por idade (Filiados após 13/11/2019)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "1.2) Aposentadoria por idade (Filiados após 13/11/2019)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Idade: ${age.years}/${data.gender === 'M' ? 65 : 62}. Tempo: ${timeTotal.years}/${timeReqNew}.`
        });
    }

    // 1.3 Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 50%)
    const timeAtReform = calculateTimeForPeriod(data.bonds, '2019-11-13', data.gender);
    const timeNeededAtReform = data.gender === 'M' ? 35 : 30;
    const missingAtReform = Math.max(0, timeNeededAtReform - timeAtReform.years);
    
    if (missingAtReform > 0 && missingAtReform <= 2) {
        const toll50 = missingAtReform * 0.5;
        const totalNeeded50 = timeNeededAtReform + toll50;
        if (timeTotal.years >= totalNeeded50 && totalCarencia >= 180) {
            benefits.push({
                benefitName: "1.3) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 50%)",
                isEligible: true,
                ruleType: 'Transition_50',
                category: 'aposentadorias',
                ...calculateRMI(data.bonds, 'Transition_50', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
            });
        } else {
            benefits.push({
                benefitName: "1.3) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 50%)",
                isEligible: false,
                ruleType: 'Transition_50',
                category: 'aposentadorias',
                missingDetails: `Tempo Total Necessário: ${totalNeeded50.toFixed(1)}. Atual: ${timeTotal.years}.`
            });
        }
    } else {
        benefits.push({
            benefitName: "1.3) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 50%)",
            isEligible: false,
            ruleType: 'Transition_50',
            category: 'aposentadorias',
            missingDetails: missingAtReform <= 0 
                ? "Direito adquirido antes da reforma (não se aplica regra de transição)." 
                : "Faltava mais de 2 anos em 13/11/2019 (Regra inaplicável)."
        });
    }

    // 1.4 Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 100%)
    const toll100 = missingAtReform; 
    const totalNeeded100 = timeNeededAtReform + toll100;
    const ageReq100 = data.gender === 'M' ? 60 : 57;
    
    if (age.years >= ageReq100 && timeTotal.years >= totalNeeded100 && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.4) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 100%)",
            isEligible: true,
            ruleType: 'Transition_100',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Transition_100', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "1.4) Aposentadoria por tempo de contribuição (Regra de Transição - Pedágio 100%)",
            isEligible: false,
            ruleType: 'Transition_100',
            category: 'aposentadorias',
            missingDetails: `Idade: ${age.years}/${ageReq100}. Tempo: ${timeTotal.years}/${totalNeeded100.toFixed(1)}.`
        });
    }

    // 1.5 Aposentadoria por tempo de contribuição (Regra de Transição - Idade Progressiva)
    const currentYear = new Date().getFullYear();
    const yearsSince2019 = currentYear - 2019;
    let progAgeReqM = 61 + (yearsSince2019 * 0.5);
    let progAgeReqF = 56 + (yearsSince2019 * 0.5);
    if (progAgeReqM > 65) progAgeReqM = 65;
    if (progAgeReqF > 62) progAgeReqF = 62;
    
    const progAgeReq = data.gender === 'M' ? progAgeReqM : progAgeReqF;
    const progTimeReq = data.gender === 'M' ? 35 : 30;

    if (age.years >= progAgeReq && timeTotal.years >= progTimeReq && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.5) Aposentadoria por tempo de contribuição (Regra de Transição - Idade Progressiva)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "1.5) Aposentadoria por tempo de contribuição (Regra de Transição - Idade Progressiva)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Idade Exigida (${currentYear}): ${progAgeReq}. Atual: ${age.years}. Tempo: ${timeTotal.years}/${progTimeReq}.`
        });
    }

    // 1.6 Aposentadoria por tempo de contribuição (Regra de Transição - Pontos)
    let pointsReqM = 96 + yearsSince2019;
    let pointsReqF = 86 + yearsSince2019;
    if (pointsReqM > 105) pointsReqM = 105;
    if (pointsReqF > 100) pointsReqF = 100;
    
    const pointsReq = data.gender === 'M' ? pointsReqM : pointsReqF;
    
    if (points >= pointsReq && timeTotal.years >= progTimeReq && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.6) Aposentadoria por tempo de contribuição (Regra de Transição - Pontos)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "1.6) Aposentadoria por tempo de contribuição (Regra de Transição - Pontos)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Pontos: ${points.toFixed(2)}/${pointsReq}. Tempo: ${timeTotal.years}/${progTimeReq}.`
        });
    }

    // --- 1.7 & 1.8 Aposentadoria Especial ---
    let specialTime15 = 0;
    let specialTime20 = 0;
    let specialTime25 = 0;
    
    data.bonds.forEach(b => {
        if (!b.useInCalculation || !b.startDate) return;
        const start = parseDateLocal(b.startDate);
        const end = b.endDate ? parseDateLocal(b.endDate) : new Date();
        const diff = end.getTime() - start.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        const years = days / 365;
        
        if (b.activityType === 'special_15') specialTime15 += years;
        if (b.activityType === 'special_20') specialTime20 += years;
        if (b.activityType === 'special_25') specialTime25 += years;
    });

    // 1.7 Aposentadoria Especial (Regra de Transição - Pontos)
    const specialPointsReq25 = 86;

    if (specialTime25 >= 25 && points >= specialPointsReq25 && totalCarencia >= 180) {
         benefits.push({
            benefitName: "1.7) Aposentadoria Especial (Regra de Transição - Pontos)",
            isEligible: true,
            ruleType: 'Transition',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
         benefits.push({
            benefitName: "1.7) Aposentadoria Especial (Regra de Transição - Pontos)",
            isEligible: false,
            ruleType: 'Transition',
            category: 'aposentadorias',
            missingDetails: `Tempo Especial (25): ${specialTime25.toFixed(2)}/25. Pontos: ${points.toFixed(2)}/${specialPointsReq25}.`
        });
    }

    // 1.8 Aposentadoria Especial (Filiados após 13/11/2019)
    const specialAgeReq25 = 60;
    if (specialTime25 >= 25 && age.years >= specialAgeReq25 && totalCarencia >= 180) {
        benefits.push({
            benefitName: "1.8) Aposentadoria Especial (Filiados após 13/11/2019)",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "1.8) Aposentadoria Especial (Filiados após 13/11/2019)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: `Tempo Especial (25): ${specialTime25.toFixed(1)}/25. Idade: ${age.years}/${specialAgeReq25}.`
        });
    }

    // 1.9 Aposentadoria do Professor (Regra de Transição - Pedágio 100%)
    if (data.isTeacher) {
         benefits.push({
            benefitName: "1.9) Aposentadoria do Professor (Regra de Transição - Pedágio 100%)",
            isEligible: false,
            ruleType: 'Transition_100',
            category: 'aposentadorias',
            missingDetails: "Requer comprovação de tempo exclusivo em magistério."
        });
    } else {
        benefits.push({
            benefitName: "1.9) Aposentadoria do Professor (Regra de Transição - Pedágio 100%)",
            isEligible: false,
            ruleType: 'Transition_100',
            category: 'aposentadorias',
            missingDetails: "Não identificado como professor."
        });
    }

    // 1.10 Aposentadoria do Professor (Regra de Transição - Pontos)
    if (data.isTeacher) {
         benefits.push({
            benefitName: "1.10) Aposentadoria do Professor (Regra de Transição - Pontos)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: "Requer comprovação de tempo exclusivo em magistério."
        });
    } else {
         benefits.push({
            benefitName: "1.10) Aposentadoria do Professor (Regra de Transição - Pontos)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: "Não identificado como professor."
        });
    }

    // 1.11 Aposentadoria da Pessoa com Deficiência (Por Idade)
    const pcdAgeReq = data.gender === 'M' ? 60 : 55;
    if (data.isPcd) {
        if (age.years >= pcdAgeReq && timeTotal.years >= 15 && totalCarencia >= 180) {
             benefits.push({
                benefitName: "1.11) Aposentadoria da Pessoa com Deficiência (Por Idade)",
                isEligible: true,
                ruleType: 'Post-Reform',
                category: 'aposentadorias',
                ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
            });
        } else {
             benefits.push({
                benefitName: "1.11) Aposentadoria da Pessoa com Deficiência (Por Idade)",
                isEligible: false,
                ruleType: 'Post-Reform',
                category: 'aposentadorias',
                missingDetails: `Idade: ${age.years}/${pcdAgeReq}. Tempo PCD: ${timeTotal.years}/15.`
            });
        }
    } else {
         benefits.push({
            benefitName: "1.11) Aposentadoria da Pessoa com Deficiência (Por Idade)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: "Não identificado como PCD."
        });
    }

    // 1.12 Aposentadoria da Pessoa com Deficiência (Por Tempo de Contribuição)
    const pcdTimeReqLeve = data.gender === 'M' ? 33 : 28;
    if (data.isPcd) {
         if (timeTotal.years >= pcdTimeReqLeve && totalCarencia >= 180) {
            benefits.push({
                benefitName: "1.12) Aposentadoria da Pessoa com Deficiência (Por Tempo de Contribuição)",
                isEligible: true,
                ruleType: 'Post-Reform',
                category: 'aposentadorias',
                ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
            });
         } else {
            benefits.push({
                benefitName: "1.12) Aposentadoria da Pessoa com Deficiência (Por Tempo de Contribuição)",
                isEligible: false,
                ruleType: 'Post-Reform',
                category: 'aposentadorias',
                missingDetails: `Tempo PCD (Leve): ${timeTotal.years}/${pcdTimeReqLeve}.`
            });
         }
    } else {
         benefits.push({
            benefitName: "1.12) Aposentadoria da Pessoa com Deficiência (Por Tempo de Contribuição)",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'aposentadorias',
            missingDetails: "Não identificado como PCD."
        });
    }

    // 1.13 Aposentadoria por Incapacidade Permanente
    if (totalCarencia >= 12 && hasQuality) {
         benefits.push({
            benefitName: "1.13) Aposentadoria por Incapacidade Permanente",
            isEligible: true,
            ruleType: 'Disability',
            category: 'auxilios',
            ...calculateRMI(data.bonds, 'Disability', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable),
            missingDetails: "Requer perícia médica confirmando incapacidade permanente."
        });
    } else {
        benefits.push({
            benefitName: "1.13) Aposentadoria por Incapacidade Permanente",
            isEligible: false,
            ruleType: 'Disability',
            category: 'auxilios',
            missingDetails: !hasQuality 
                ? "Segurado sem qualidade (período de graça expirado)." 
                : `Carência: ${totalCarencia}/12 meses.`
        });
    }

    // --- 2. AUXÍLIOS E SALÁRIOS ---

    // 2.1 Incapacidade Temporária
    if (totalCarencia >= 12 && hasQuality) {
        benefits.push({
            benefitName: "Auxílio por Incapacidade Temporária",
            isEligible: true,
            ruleType: 'TemporaryDisability',
            category: 'auxilios',
            ...calculateRMI(data.bonds, 'TemporaryDisability', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "Auxílio por Incapacidade Temporária",
            isEligible: false,
            ruleType: 'TemporaryDisability',
            category: 'auxilios',
            missingDetails: !hasQuality 
                ? "Segurado sem qualidade (período de graça expirado)." 
                : `Carência: ${totalCarencia}/12 meses.`
        });
    }

    // 2.2 Auxílio-Acidente
    if (hasQuality) {
        benefits.push({
            benefitName: "Auxílio-Acidente",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            ...(() => {
                const r = calculateRMI(data.bonds, 'Disability', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable);
                return {
                    rmi: r.rmi * 0.5,
                    rmiDetails: r.rmiDetails ? { ...r.rmiDetails, finalRMI: r.rmi * 0.5, calculationFormula: r.rmiDetails.calculationFormula + ' x 0.5 (Acidente)' } : undefined
                };
            })()
        });
    } else {
        benefits.push({
            benefitName: "Auxílio-Acidente",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            missingDetails: "Segurado sem qualidade (período de graça expirado)."
        });
    }

    // 2.3 Salário-Maternidade
    if (totalCarencia >= 10 && hasQuality) {
        benefits.push({
            benefitName: "Salário-Maternidade",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            ...calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "Salário-Maternidade",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'auxilios',
            missingDetails: !hasQuality 
                ? "Segurado sem qualidade (período de graça expirado)." 
                : `Carência: ${totalCarencia}/10 meses.`
        });
    }

    // --- 3. BENEFÍCIOS AOS DEPENDENTES ---

    // 3.1 Pensão por Morte
    if (hasQuality) {
        benefits.push({
            benefitName: "Pensão por Morte",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'dependentes',
            ...calculateRMI(data.bonds, 'Death', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable)
        });
    } else {
        benefits.push({
            benefitName: "Pensão por Morte",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'dependentes',
            missingDetails: "Instituidor sem qualidade de segurado na data do óbito (estimada)."
        });
    }

    // 3.2 Auxílio-Reclusão
    const rmiResult = calculateRMI(data.bonds, 'Post-Reform', data.gender, timeTotal.years, inpcIndices, der, fractionalAge, data.customMinWage, undefined, data.isTeacher, ibgeTable);
    const rmiEst = typeof rmiResult === 'number' ? 0 : rmiResult.rmi;
    const lowIncomeLimit = 1819.26;
    
    if (totalCarencia >= 24 && hasQuality && rmiEst <= lowIncomeLimit) {
        benefits.push({
            benefitName: "Auxílio-Reclusão",
            isEligible: true,
            ruleType: 'Post-Reform',
            category: 'dependentes',
            rmi: getCurrentMinimumWage(der) // Salário Mínimo
        });
    } else {
        benefits.push({
            benefitName: "Auxílio-Reclusão",
            isEligible: false,
            ruleType: 'Post-Reform',
            category: 'dependentes',
            missingDetails: !hasQuality 
                ? "Segurado sem qualidade (período de graça expirado)." 
                : `Carência: ${totalCarencia}/24. Renda: ${rmiEst > lowIncomeLimit ? 'Acima do limite' : 'Ok'}.`
        });
    }

    return {
        totalTime: timeTotal,
        totalCarencia,
        age,
        points,
        gender: data.gender,
        isTeacher: false,
        isPcd: false,
        benefits
    };
};
