/**
 * MULTI-MONTH DATA STORE v2.0
 * 
 * Stores dashboard data per month with localStorage persistence.
 * Supports: create month, update month, get month, list months, 
 * get YTD up to a month, get monthly averages.
 */

const STORE_KEY = 'binnedit_datastore_v2';
const META_KEY = 'binnedit_meta_v2';

// ===== PERSISTENCE =====
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}
function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || { version: '2.0.0', created: new Date().toISOString() }; } catch { return { version: '2.0.0' }; }
}
function saveMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

// ===== MONTH KEY FORMAT: "2026-01" =====
function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

function monthLabel(key) {
  const { year, month } = parseMonthKey(key);
  const labels = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${labels[month]} ${year}`;
}

function monthsBetween(startKey, endKey) {
  const s = parseMonthKey(startKey);
  const e = parseMonthKey(endKey);
  const keys = [];
  let y = s.year, m = s.month;
  while (y < e.year || (y === e.year && m <= e.month)) {
    keys.push(monthKey(y, m));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
}

// ===== MONTH DATA TEMPLATE =====
function emptyMonthData(key) {
  return {
    monthKey: key,
    label: monthLabel(key),
    status: 'draft', // draft | complete
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Financial data
    revenue: { total: 0, generalWaste: 0, asbestos: 0, soil: 0, greenWaste: 0, other: 0 },
    cos: { total: 0 },
    opex: { total: 0, wages: 0, fuel: 0, rent: 0, advertising: 0, tolls: 0, repairs: 0, other: 0 },
    grossProfit: 0,
    netProfit: 0,
    gmPct: 0,
    npPct: 0,
    // Cash
    cashIncome: 0, cashExpenses: 0, cashNetMovement: 0, cashBalance: 0,
    // Balance sheet (point in time)
    balanceSheet: null,
    // Bin types
    binTypes: [],
    // Pricing data per bin type
    pricing: [],
    // AR
    arTotal: 0, arOverdue: 0, arAging: {},
    topDebtors: [],
    // Wizard inputs
    quality: {},
    compliance: {},
    market: {},
    // Raw parsed files
    rawFiles: {},
    // Work plan
    workPlan: [],
  };
}

// ===== STORE API =====
export function getMonthData(key) {
  const store = loadStore();
  return store[key] || null;
}

export function saveMonthData(key, data) {
  const store = loadStore();
  store[key] = { ...data, updatedAt: new Date().toISOString() };
  saveStore(store);
  // Update meta
  const meta = loadMeta();
  meta.lastUpdated = new Date().toISOString();
  meta.lastMonth = key;
  saveMeta(meta);
}

export function createMonth(key) {
  const store = loadStore();
  if (!store[key]) {
    store[key] = emptyMonthData(key);
    saveStore(store);
  }
  return store[key];
}

export function deleteMonth(key) {
  const store = loadStore();
  delete store[key];
  saveStore(store);
}

export function listMonths() {
  const store = loadStore();
  return Object.keys(store)
    .sort()
    .map(k => ({ key: k, label: monthLabel(k), status: store[k].status, updatedAt: store[k].updatedAt }));
}

export function getLatestMonth() {
  const months = listMonths();
  return months.length > 0 ? months[months.length - 1].key : null;
}

// ===== YTD & COMPARISON FUNCTIONS =====

/** Get YTD totals up to and including the given month */
export function getYTD(upToKey) {
  const store = loadStore();
  const allKeys = Object.keys(store).sort();
  const relevantKeys = allKeys.filter(k => k <= upToKey);

  const ytd = {
    months: relevantKeys.length,
    revenue: 0, cos: 0, opex: 0, grossProfit: 0, netProfit: 0,
    revenueByCategory: { generalWaste: 0, asbestos: 0, soil: 0, greenWaste: 0, other: 0 },
    opexBreakdown: { wages: 0, fuel: 0, rent: 0, advertising: 0, tolls: 0, repairs: 0, other: 0 },
    cashBalance: 0,
    monthlyData: [],
  };

  relevantKeys.forEach(k => {
    const d = store[k];
    ytd.revenue += d.revenue?.total || 0;
    ytd.cos += d.cos?.total || 0;
    ytd.opex += d.opex?.total || 0;
    ytd.grossProfit += d.grossProfit || 0;
    ytd.netProfit += d.netProfit || 0;
    // Category breakdown
    Object.keys(ytd.revenueByCategory).forEach(cat => {
      ytd.revenueByCategory[cat] += d.revenue?.[cat] || 0;
    });
    Object.keys(ytd.opexBreakdown).forEach(cat => {
      ytd.opexBreakdown[cat] += d.opex?.[cat] || 0;
    });
    ytd.cashBalance = d.cashBalance || ytd.cashBalance;
    ytd.monthlyData.push({ key: k, label: monthLabel(k), ...d });
  });

  ytd.gmPct = ytd.revenue > 0 ? ((ytd.revenue - ytd.cos) / ytd.revenue * 100) : 0;
  ytd.npPct = ytd.revenue > 0 ? (ytd.netProfit / ytd.revenue * 100) : 0;

  return ytd;
}

/** Get monthly average for all months BEFORE the given month (for benchmarking) */
export function getMonthlyAvgBefore(beforeKey) {
  const store = loadStore();
  const priorKeys = Object.keys(store).sort().filter(k => k < beforeKey);
  if (priorKeys.length === 0) return null;

  const n = priorKeys.length;
  const avg = { months: n, revenue: 0, cos: 0, opex: 0, grossProfit: 0, netProfit: 0, gmPct: 0, npPct: 0 };

  priorKeys.forEach(k => {
    const d = store[k];
    avg.revenue += d.revenue?.total || 0;
    avg.cos += d.cos?.total || 0;
    avg.opex += d.opex?.total || 0;
    avg.grossProfit += d.grossProfit || 0;
    avg.netProfit += d.netProfit || 0;
  });

  avg.revenue /= n;
  avg.cos /= n;
  avg.opex /= n;
  avg.grossProfit /= n;
  avg.netProfit /= n;
  avg.gmPct = avg.revenue > 0 ? ((avg.revenue - avg.cos) / avg.revenue * 100) : 0;
  avg.npPct = avg.revenue > 0 ? (avg.netProfit / avg.revenue * 100) : 0;

  return avg;
}

// ===== IMPORT FROM LEGACY =====
/** Import existing hardcoded data from financials.js into the data store */
export function importLegacyData(D) {
  const fyStart = { year: 2025, month: 7 }; // Jul 2025
  const monthNames = D.months; // ['Jul','Aug','Sep',...]

  monthNames.forEach((name, i) => {
    const m = fyStart.month + i;
    const y = m > 12 ? fyStart.year + 1 : fyStart.year;
    const actualMonth = m > 12 ? m - 12 : m;
    const key = monthKey(y, actualMonth);

    const data = emptyMonthData(key);
    data.status = 'complete';
    data.revenue = {
      total: D.totalRevenue[i] || 0,
      generalWaste: D.revByCategory?.generalWaste?.[i] || 0,
      asbestos: D.revByCategory?.asbestos?.[i] || 0,
      soil: D.revByCategory?.soil?.[i] || 0,
      greenWaste: D.revByCategory?.greenWaste?.[i] || 0,
      other: D.revByCategory?.other?.[i] || 0,
    };
    data.cos = { total: D.totalCOS[i] || 0 };
    data.opex = {
      total: D.totalOpex[i] || 0,
      wages: D.wages?.[i] || 0,
      fuel: D.fuelCosts?.[i] || 0,
      rent: D.rent?.[i] || 0,
      advertising: D.advertising?.[i] || 0,
      tolls: D.tolls?.[i] || 0,
      repairs: D.repairs?.[i] || 0,
      other: Math.max(0, (D.totalOpex[i]||0) - (D.wages?.[i]||0) - (D.fuelCosts?.[i]||0) - (D.rent?.[i]||0) - (D.advertising?.[i]||0) - (D.tolls?.[i]||0) - (D.repairs?.[i]||0)),
    };
    data.grossProfit = D.grossProfit?.[i] || 0;
    data.netProfit = D.netProfit?.[i] || 0;
    data.gmPct = D.gmPct?.[i] || 0;
    data.npPct = data.revenue.total > 0 ? (data.netProfit / data.revenue.total * 100) : 0;
    data.cashIncome = D.cashIncome?.[i] || 0;
    data.cashExpenses = D.cashExpenses?.[i] || 0;
    data.cashNetMovement = D.cashNetMovement?.[i] || 0;
    data.cashBalance = D.cashBalance?.[i] || 0;

    saveMonthData(key, data);
  });
}

// ===== META =====
export function getMeta() { return loadMeta(); }
export function saveMeta2(meta) { saveMeta(meta); }
export { monthKey, parseMonthKey, monthLabel, monthsBetween, emptyMonthData };
