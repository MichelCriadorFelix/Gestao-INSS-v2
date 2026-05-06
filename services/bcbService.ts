
export interface INPCData {
    data: string;
    valor: string;
}

export interface CorrectionIndex {
    monthStr: string; // "MM/YYYY"
    cumulativeFactor: number;
}

const BCB_API_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.188/dados?formato=json';

export const fetchINPCData = async (): Promise<INPCData[]> => {
    try {
        const response = await fetch(BCB_API_URL);
        if (!response.ok) {
            throw new Error(`BCB API Error: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch INPC data:", error);
        throw error;
    }
};

export const processINPCIndices = (data: INPCData[]): Map<string, number> => {
    const indicesMap = new Map<string, number>();
    
    // Sort by date ascending just in case
    const sortedData = [...data].sort((a, b) => {
        const [da, ma, ya] = a.data.split('/').map(Number);
        const [db, mb, yb] = b.data.split('/').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });

    let currentCumulative = 1.0;
    
    // We'll base our cumulative index starting from the first available date.
    // For any date, the "Price Level" at the END of that month is stored.
    
    sortedData.forEach(item => {
        const [day, month, year] = item.data.split('/');
        const monthStr = `${parseInt(month)}/${year}`; // "1/1994", "10/2023"
        
        const rate = parseFloat(item.valor);
        // INPC is a percentage. 0.56 means 0.56%.
        // Factor = 1 + (0.56 / 100) = 1.0056
        
        currentCumulative = currentCumulative * (1 + (rate / 100));
        
        indicesMap.set(monthStr, currentCumulative);
    });

    return indicesMap;
};

export const getCorrectionFactor = (
    indicesMap: Map<string, number>, 
    contributionMonth: string, 
    derMonth: string
): number => {
    // Contribution Month: "MM/YYYY"
    // DER Month: "MM/YYYY"
    
    // We want to bring the value FROM contributionMonth TO derMonth.
    // Factor = Index(Month Prior to DER) / Index(Contribution Month)
    // Wait, usually correction is applied FROM the month of contribution.
    // If I contributed in Jan 2000, the money was worth X.
    // To bring to Jan 2024, I multiply by (Index Jan 2024 / Index Jan 2000).
    
    // Precise INSS Rule:
    // The correction index for a given month is the accumulated variation from that month until the calculation date.
    // So: Value * (Cumulative_Latest / Cumulative_ContributionMonth)
    
    // However, the INPC of the contribution month itself usually counts?
    // If I paid in Jan 1st. Inflation of Jan counts.
    // The map stores the cumulative value at the END of the month.
    // So if I use map.get("01/2000"), it includes Jan 2000 inflation.
    // This seems correct for correcting a value received in Jan 2000 to today.
    
    const startFactor = indicesMap.get(contributionMonth);
    
    // For the End Factor, we usually use the index of the month PRIOR to the DER.
    // If the DER is in the future (relative to API data), we should use the LATEST available index.
    
    let endFactor = indicesMap.get(derMonth);
    
    if (!endFactor) {
        // Try previous month first (standard rule)
        const [m, y] = derMonth.split('/').map(Number);
        let prevDate = new Date(y, m - 1, 1);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevMonthStr = `${prevDate.getMonth() + 1}/${prevDate.getFullYear()}`;
        endFactor = indicesMap.get(prevMonthStr);

        // If still not found, it might be a future date beyond our data.
        // Use the latest available index in the map.
        if (!endFactor && indicesMap.size > 0) {
            // Map preserves insertion order? No, but we processed it sorted.
            // Let's find the max value or just the last entry if we trust insertion order from processINPCIndices
            // processINPCIndices sorts by date, so the last set value is the latest.
            const keys = Array.from(indicesMap.keys());
            const lastKey = keys[keys.length - 1];
            endFactor = indicesMap.get(lastKey);
        }
    }

    if (!startFactor || !endFactor) {
        return 1.0; // Fallback
    }

    return endFactor / startFactor;
};
