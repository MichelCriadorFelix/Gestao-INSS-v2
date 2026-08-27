/**
 * Tabela Oficial de Salário Mínimo do Brasil (1994 a 2026 - Vigente)
 * Fonte: Banco Central do Brasil (BACEN SGS Série 1619), IPEA, Legislação Federal
 */

export interface MinimumWageEntry {
    date: string;       // YYYY-MM-DD
    value: number;      // Valor em Reais
    law?: string;       // Legislação / Base Normativa
    notes?: string;
}

export const MINIMUM_WAGE_HISTORY: MinimumWageEntry[] = [
    { date: '1994-07-01', value: 64.79, law: 'Lei nº 8.880/1994', notes: 'Início do Plano Real' },
    { date: '1994-09-01', value: 70.00, law: 'Lei nº 9.063/1995' },
    { date: '1995-05-01', value: 100.00, law: 'Lei nº 9.032/1995' },
    { date: '1996-05-01', value: 112.00, law: 'MP nº 1.414/1996' },
    { date: '1997-05-01', value: 120.00, law: 'MP nº 1.572/1997' },
    { date: '1998-05-01', value: 130.00, law: 'Lei nº 9.971/2000' },
    { date: '1999-05-01', value: 136.00, law: 'Lei nº 9.971/2000' },
    { date: '2000-04-03', value: 151.00, law: 'Lei nº 9.971/2000' },
    { date: '2001-04-01', value: 180.00, law: 'Lei nº 10.208/2001' },
    { date: '2002-04-01', value: 200.00, law: 'Lei nº 10.525/2002' },
    { date: '2003-04-01', value: 240.00, law: 'Lei nº 10.699/2003' },
    { date: '2004-05-01', value: 260.00, law: 'Lei nº 10.888/2004' },
    { date: '2005-05-01', value: 300.00, law: 'Lei nº 11.164/2005' },
    { date: '2006-04-01', value: 350.00, law: 'Lei nº 11.321/2006' },
    { date: '2007-04-01', value: 380.00, law: 'Lei nº 11.498/2007' },
    { date: '2008-03-01', value: 415.00, law: 'Lei nº 11.709/2008' },
    { date: '2009-02-01', value: 465.00, law: 'Lei nº 11.944/2009' },
    { date: '2010-01-01', value: 510.00, law: 'Lei nº 12.255/2010' },
    { date: '2011-01-01', value: 540.00, law: 'MP nº 516/2010' },
    { date: '2011-03-01', value: 545.00, law: 'Lei nº 12.382/2011' },
    { date: '2012-01-01', value: 622.00, law: 'Decreto nº 7.655/2011' },
    { date: '2013-01-01', value: 678.00, law: 'Decreto nº 7.872/2012' },
    { date: '2014-01-01', value: 724.00, law: 'Decreto nº 8.166/2013' },
    { date: '2015-01-01', value: 788.00, law: 'Decreto nº 8.381/2014' },
    { date: '2016-01-01', value: 880.00, law: 'Decreto nº 8.618/2015' },
    { date: '2017-01-01', value: 937.00, law: 'Decreto nº 8.948/2016' },
    { date: '2018-01-01', value: 954.00, law: 'Decreto nº 9.255/2017' },
    { date: '2019-01-01', value: 998.00, law: 'Decreto nº 9.661/2019' },
    { date: '2020-01-01', value: 1039.00, law: 'MP nº 916/2019' },
    { date: '2020-02-01', value: 1045.00, law: 'Lei nº 14.013/2020' },
    { date: '2021-01-01', value: 1100.00, law: 'Lei nº 14.158/2021' },
    { date: '2022-01-01', value: 1212.00, law: 'Lei nº 14.358/2022' },
    { date: '2023-01-01', value: 1302.00, law: 'MP nº 1.143/2022' },
    { date: '2023-05-01', value: 1320.00, law: 'Lei nº 14.663/2023' },
    { date: '2024-01-01', value: 1412.00, law: 'Decreto nº 11.864/2023' },
    { date: '2025-01-01', value: 1518.00, law: 'Lei Orçamentária / BACEN' },
    { date: '2026-01-01', value: 1621.00, law: 'Lei Orçamentária / BACEN SGS 1619', notes: 'Salário Mínimo Vigente em 2026' }
];

export const CURRENT_MINIMUM_WAGE_2026 = 1621.00;

export const getCurrentMinimumWage = (dateStr?: string): number => {
    if (!dateStr) return MINIMUM_WAGE_HISTORY[MINIMUM_WAGE_HISTORY.length - 1].value;
    
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
        return MINIMUM_WAGE_HISTORY[MINIMUM_WAGE_HISTORY.length - 1].value;
    }

    // Ordena do mais recente para o mais antigo para encontrar o valor vigente na data
    const sorted = [...MINIMUM_WAGE_HISTORY].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const wage = sorted.find(w => new Date(w.date) <= targetDate);
    return wage ? wage.value : MINIMUM_WAGE_HISTORY[0].value;
};

/**
 * Consulta a API do Banco Central do Brasil para sincronização dinâmica
 */
export const fetchBcbMinimumWageHistory = async (): Promise<any> => {
    try {
        const response = await fetch('/api/bcdata/minimum-wage');
        if (!response.ok) throw new Error('Falha ao conectar com API do Banco Central');
        return await response.json();
    } catch (error) {
        console.warn('Usando tabela local de contingência do BACEN:', error);
        return {
            source: 'Tabela Local (BACEN SGS 1619)',
            currentYear: 2026,
            currentWage: CURRENT_MINIMUM_WAGE_2026,
            data: MINIMUM_WAGE_HISTORY
        };
    }
};

