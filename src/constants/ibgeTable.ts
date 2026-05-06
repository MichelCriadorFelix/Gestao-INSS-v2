/**
 * IBGE Life Expectancy Table (Tábua de Mortalidade)
 * Values based on the latest available data (2023 Table, released in Dec 2024).
 * These values are used for the Fator Previdenciário calculation.
 */
export const IBGE_LIFE_EXPECTANCY: Record<number, number> = {
    0: 76.4, 1: 75.6, 2: 74.7, 3: 73.7, 4: 72.8, 5: 71.8, 6: 70.8, 7: 69.8, 8: 68.9, 9: 67.9,
    10: 66.9, 11: 65.9, 12: 64.9, 13: 63.9, 14: 63.0, 15: 62.0, 16: 61.0, 17: 60.1, 18: 59.1, 19: 58.2,
    20: 57.2, 21: 56.3, 22: 55.4, 23: 54.4, 24: 53.5, 25: 52.6, 26: 51.6, 27: 50.7, 28: 49.8, 29: 48.9,
    30: 48.0, 31: 47.0, 32: 46.1, 33: 45.2, 34: 44.3, 35: 43.4, 36: 42.5, 37: 41.6, 38: 40.7, 39: 39.8,
    40: 38.9, 41: 38.0, 42: 37.1, 43: 36.2, 44: 35.3, 45: 34.4, 46: 33.5, 47: 32.7, 48: 31.8, 49: 31.0,
    50: 30.1, 51: 29.3, 52: 28.5, 53: 27.7, 54: 26.9, 55: 26.1, 56: 25.3, 57: 24.5, 58: 23.8, 59: 23.0,
    60: 22.3, 61: 21.6, 62: 20.9, 63: 20.2, 64: 19.5, 65: 18.8, 66: 18.1, 67: 17.5, 68: 16.8, 69: 16.2,
    70: 15.6, 71: 15.0, 72: 14.4, 73: 13.8, 74: 13.2, 75: 12.7, 76: 12.1, 77: 11.6, 78: 11.1, 79: 10.6,
    80: 10.1, 81: 9.6, 82: 9.1, 83: 8.7, 84: 8.2, 85: 7.8, 86: 7.4, 87: 7.0, 88: 6.7, 89: 6.3,
    90: 6.0, 91: 5.7, 92: 5.4, 93: 5.1, 94: 4.8, 95: 4.6, 96: 4.3, 97: 4.1, 98: 3.9, 99: 3.7, 100: 3.5
};

/**
 * Gets life expectancy for a given age (fractional).
 * Performs linear interpolation between integer ages.
 */
export const getLifeExpectancy = (age: number): number => {
    const floorAge = Math.floor(age);
    const ceilAge = Math.ceil(age);
    
    if (floorAge >= 100) return IBGE_LIFE_EXPECTANCY[100];
    if (floorAge < 0) return IBGE_LIFE_EXPECTANCY[0];
    
    const valFloor = IBGE_LIFE_EXPECTANCY[floorAge];
    const valCeil = IBGE_LIFE_EXPECTANCY[ceilAge] || valFloor;
    
    if (floorAge === ceilAge) return valFloor;
    
    // Linear interpolation
    return valFloor + (valCeil - valFloor) * (age - floorAge);
};
