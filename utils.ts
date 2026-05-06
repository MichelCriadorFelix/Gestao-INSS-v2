export const safeSetLocalStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (err: any) {
        console.warn(`Erro ao salvar no localStorage (${key}):`, err.message);
    }
};

export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
};

export const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const isUrgentDate = (dateStr: string): boolean => {
  const date = parseDate(dateStr);
  if (!date) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Alerta se estiver vencido ou nos próximos 15 dias
  return diffDays <= 15;
};

export const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const getMinWage = (): number => {
    try {
        const stored = localStorage.getItem('app_min_wage');
        if (stored) return parseFloat(stored);
    } catch (e) {}
    return 1621.00; // Default 2026
};

export const setMinWage = (value: number) => {
    safeSetLocalStorage('app_min_wage', value.toString());
};

export const getProceduralRite = (totalValue: number): { name: string, description: string, color: string } => {
    const minWage = getMinWage();
    if (totalValue <= minWage * 2) {
        return { name: 'Sumário', description: 'Até 2 salários mínimos', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    } else if (totalValue <= minWage * 40) {
        return { name: 'Sumaríssimo', description: 'De 2 a 40 salários mínimos', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    } else {
        return { name: 'Ordinário', description: 'Acima de 40 salários mínimos', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
};
