
/**
 * Service to fetch life expectancy data from IBGE SIDRA API.
 * Used for Fator Previdenciário calculations.
 */

export interface IBGELifeExpectancy {
    age: number;
    expectancy: number;
}

/**
 * Fetches the latest life expectancy table from IBGE SIDRA.
 * Table 9405: Projeções da população, por sexo e idade.
 * Variable 1211: Esperança de vida (anos).
 * Classification 2: 6794 (Ambos os sexos).
 * Classification 58: all (All ages).
 */
export const fetchIBGELifeExpectancy = async (): Promise<IBGELifeExpectancy[]> => {
    try {
        // SIDRA API URL for Table 9405, Variable 1211, Period last, Sex 6794, All Ages
        const url = 'https://servicodados.ibge.gov.br/api/v3/agregados/9405/periodos/last/variaveis/1211?classificacao=2[6794]|58[all]';
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`IBGE API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // SIDRA returns a complex structure. We need to parse it.
        // data[0].resultados[0].series[0].serie is an object where keys are age codes and values are expectancy.
        // The age codes in classification 58 are usually "0", "1", ..., "80" (for 80+).
        
        const results: IBGELifeExpectancy[] = [];
        
        if (data && data[0] && data[0].resultados) {
            const series = data[0].resultados[0].series;
            series.forEach((s: any) => {
                // s.classificacoes[1].categoria contains the age label like "0 anos", "1 ano", etc.
                // s.serie contains the value for the period.
                const ageLabel = s.classificacoes.find((c: any) => c.nome === 'Idade')?.categoria;
                const ageMatch = ageLabel?.match(/\d+/);
                const age = ageMatch ? parseInt(ageMatch[0]) : null;
                
                const periodKey = Object.keys(s.serie)[0];
                const expectancy = parseFloat(s.serie[periodKey]);
                
                if (age !== null && !isNaN(expectancy)) {
                    results.push({ age, expectancy });
                }
            });
        }
        
        // Sort by age
        return results.sort((a, b) => a.age - b.age);
    } catch (error) {
        console.error("Error fetching IBGE life expectancy:", error);
        throw error;
    }
};

/**
 * Interpolates life expectancy for fractional ages.
 */
export const getLifeExpectancyFromTable = (table: IBGELifeExpectancy[], fractionalAge: number): number => {
    if (table.length === 0) return 0;
    
    const ageFloor = Math.floor(fractionalAge);
    const ageCeil = Math.ceil(fractionalAge);
    
    const entryFloor = table.find(e => e.age === ageFloor);
    const entryCeil = table.find(e => e.age === ageCeil);
    
    if (!entryFloor) {
        // If age is beyond table, return last available
        return table[table.length - 1].expectancy;
    }
    
    if (!entryCeil || ageFloor === ageCeil) {
        return entryFloor.expectancy;
    }
    
    // Linear interpolation
    const t = fractionalAge - ageFloor;
    return entryFloor.expectancy + t * (entryCeil.expectancy - entryFloor.expectancy);
};
