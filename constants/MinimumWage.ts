export const MINIMUM_WAGE_HISTORY = [
    { date: '1994-07-01', value: 64.79 },
    { date: '1994-09-01', value: 70.00 },
    { date: '1995-05-01', value: 100.00 },
    { date: '1996-05-01', value: 112.00 },
    { date: '1997-05-01', value: 120.00 },
    { date: '1998-05-01', value: 130.00 },
    { date: '1999-05-01', value: 136.00 },
    { date: '2000-04-03', value: 151.00 },
    { date: '2001-04-01', value: 180.00 },
    { date: '2002-04-01', value: 200.00 },
    { date: '2003-04-01', value: 240.00 },
    { date: '2004-05-01', value: 260.00 },
    { date: '2005-05-01', value: 300.00 },
    { date: '2006-04-01', value: 350.00 },
    { date: '2007-04-01', value: 380.00 },
    { date: '2008-03-01', value: 415.00 },
    { date: '2009-02-01', value: 465.00 },
    { date: '2010-01-01', value: 510.00 },
    { date: '2011-01-01', value: 540.00 }, // Jan
    { date: '2011-03-01', value: 545.00 }, // Mar
    { date: '2012-01-01', value: 622.00 },
    { date: '2013-01-01', value: 678.00 },
    { date: '2014-01-01', value: 724.00 },
    { date: '2015-01-01', value: 788.00 },
    { date: '2016-01-01', value: 880.00 },
    { date: '2017-01-01', value: 937.00 },
    { date: '2018-01-01', value: 954.00 },
    { date: '2019-01-01', value: 998.00 },
    { date: '2020-01-01', value: 1039.00 }, // Jan
    { date: '2020-02-01', value: 1045.00 }, // Feb
    { date: '2021-01-01', value: 1100.00 },
    { date: '2022-01-01', value: 1212.00 },
    { date: '2023-01-01', value: 1302.00 }, // Jan
    { date: '2023-05-01', value: 1320.00 }, // May
    { date: '2024-01-01', value: 1412.00 },
    { date: '2025-01-01', value: 1515.00 },
    { date: '2026-01-01', value: 1621.00 }
];

export const getCurrentMinimumWage = (dateStr?: string): number => {
    if (!dateStr) return MINIMUM_WAGE_HISTORY[MINIMUM_WAGE_HISTORY.length - 1].value;
    
    const targetDate = new Date(dateStr);
    // Find the latest wage that is <= targetDate
    // Sort descending first to find the first one that matches
    const sorted = [...MINIMUM_WAGE_HISTORY].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const wage = sorted.find(w => new Date(w.date) <= targetDate);
    return wage ? wage.value : MINIMUM_WAGE_HISTORY[0].value;
};
