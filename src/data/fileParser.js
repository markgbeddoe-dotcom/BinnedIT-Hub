// Excel File Parser — reads Xero reports and Bin Manager exports
import * as XLSX from 'xlsx';

// Generic reader: file → array of rows
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        resolve({ data, sheetName: wb.SheetNames[0], fileName: file.name });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ===== CASH SUMMARY PARSER =====
export async function parseCashSummary(file) {
  const { data, fileName } = await readFile(file);
  const result = {
    fileName,
    month: '',
    income: {},
    expenses: {},
    otherMovements: {},
    gstMovements: {},
    totalIncome: 0,
    totalExpenses: 0,
    openingBalance: 0,
    netCashMovement: 0,
    cashBalance: 0,
    raw: data,
  };

  // Find the period from header rows
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (row && row[0] && typeof row[0] === 'string' && row[0].toLowerCase().includes('for the month')) {
      result.month = row[0].replace(/for the month ended /i, '').trim();
    }
  }

  let section = '';
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    const label = (row[0] || '').toString().trim();
    const value = typeof row[1] === 'number' ? row[1] : 0;

    // Detect section changes
    if (label === 'Income') { section = 'income'; continue; }
    if (label === 'Less Expenses') { section = 'expenses'; continue; }
    if (label === 'Plus Other Cash Movements') { section = 'other'; continue; }
    if (label === 'Plus GST Movements') { section = 'gst'; continue; }
    if (label === 'Summary') { section = 'summary'; continue; }

    // Skip totals and empty labels
    if (label.startsWith('Total ') || label.startsWith('Surplus') || label.startsWith('Net ') || label === '') continue;

    if (section === 'income' && label && value !== undefined) {
      result.income[label] = value;
      result.totalIncome += value;
    }
    if (section === 'expenses' && label && value !== undefined) {
      result.expenses[label] = Math.abs(value);
      result.totalExpenses += Math.abs(value);
    }
    if (section === 'other' && label) {
      result.otherMovements[label] = value;
    }
    if (section === 'gst' && label) {
      result.gstMovements[label] = value;
    }
    if (section === 'summary') {
      if (label === 'Opening Balance') result.openingBalance = value;
      if (label.includes('Net Cash Movement')) result.netCashMovement = value;
      if (label === 'Cash Balance') result.cashBalance = value;
    }
  }

  // Categorise income into bin types
  result.incomeByCategory = categoriseIncome(result.income);

  return result;
}

// ===== BALANCE SHEET PARSER =====
export async function parseBalanceSheet(file) {
  const { data, fileName } = await readFile(file);
  const result = {
    fileName,
    asAt: '',
    // Structured sections
    bank: {},
    currentAssets: {},
    fixedAssets: {},
    nonCurrentAssets: {},
    currentLiabilities: {},
    nonCurrentLiabilities: {},
    equity: {},
    // Flat maps
    assets: {},
    liabilities: {},
    // Calculated totals
    totalBank: 0,
    totalCurrentAssets: 0,
    totalFixedAssets: 0,
    totalNonCurrentAssets: 0,
    totalAssets: 0,
    totalCurrentLiabilities: 0,
    totalNonCurrentLiabilities: 0,
    totalLiabilities: 0,
    netEquity: 0,
    netAssets: 0,
    // Key accounts for reporting
    keyAccounts: {
      gst: 0, paygWithholding: 0, super: 0, ato: 0,
      directorLoans: 0, bankBalance: 0,
      currentYearEarnings: 0, retainedEarnings: 0,
    },
    raw: data,
  };

  // Find date
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (row && row[0] && typeof row[0] === 'string' && row[0].toLowerCase().includes('as at')) {
      result.asAt = row[0].replace(/as at /i, '').trim();
    }
  }

  let majorSection = ''; // 'assets' | 'liabilities' | 'equity'
  let subSection = '';    // 'bank' | 'current_assets' | 'fixed_assets' | etc

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    const col0 = (row[0] || '').toString().trim();
    const col1 = (row[1] || '').toString().trim();
    const label = col1 || col0;
    let value = typeof row[2] === 'number' ? row[2] : (typeof row[1] === 'number' ? row[1] : null);

    // Major section headers (column 0)
    if (col0 === 'Assets') { majorSection = 'assets'; subSection = ''; continue; }
    if (col0 === 'Liabilities') { majorSection = 'liabilities'; subSection = ''; continue; }
    if (col0 === 'Equity') { majorSection = 'equity'; subSection = ''; continue; }

    // Skip total rows and summary rows — we calculate our own totals
    if (label.startsWith('Total ') || label === 'Net Assets') continue;

    // Subsection headers (no value)
    if (value === null && label) {
      const lower = label.toLowerCase();
      if (lower === 'bank') subSection = 'bank';
      else if (lower === 'current assets') subSection = 'current_assets';
      else if (lower === 'fixed assets') subSection = 'fixed_assets';
      else if (lower === 'non-current assets') subSection = 'non_current_assets';
      else if (lower === 'current liabilities') subSection = 'current_liabilities';
      else if (lower === 'non-current liabilities') subSection = 'non_current_liabilities';
      continue;
    }

    // Line items with values
    if (value !== null && label) {
      if (majorSection === 'assets') {
        result.assets[label] = value;
        if (subSection === 'bank') { result.bank[label] = value; result.totalBank += value; }
        else if (subSection === 'current_assets') { result.currentAssets[label] = value; result.totalCurrentAssets += value; }
        else if (subSection === 'fixed_assets') { result.fixedAssets[label] = value; result.totalFixedAssets += value; }
        else if (subSection === 'non_current_assets') { result.nonCurrentAssets[label] = value; result.totalNonCurrentAssets += value; }
        else { result.currentAssets[label] = value; result.totalCurrentAssets += value; } // fallback
      }
      else if (majorSection === 'liabilities') {
        result.liabilities[label] = value;
        if (subSection === 'current_liabilities') { result.currentLiabilities[label] = value; result.totalCurrentLiabilities += value; }
        else if (subSection === 'non_current_liabilities') { result.nonCurrentLiabilities[label] = value; result.totalNonCurrentLiabilities += value; }
        else { result.currentLiabilities[label] = value; result.totalCurrentLiabilities += value; }
      }
      else if (majorSection === 'equity') {
        result.equity[label] = value;
      }

      // Tag key accounts
      const lower = label.toLowerCase();
      if (lower.includes('gst') && !lower.includes('adjustment')) result.keyAccounts.gst += value;
      if (lower.includes('payg')) result.keyAccounts.paygWithholding += value;
      if (lower.includes('super')) result.keyAccounts.super += value;
      if (lower.includes('ato')) result.keyAccounts.ato += value;
      if (lower.includes('loan') && lower.includes('mark') || lower.includes('loan') && lower.includes('andrew')) result.keyAccounts.directorLoans += value;
      if (lower.includes('current year earning')) result.keyAccounts.currentYearEarnings = value;
      if (lower.includes('retained earning')) result.keyAccounts.retainedEarnings = value;
    }
  }

  // Calculate totals from summed line items
  result.totalAssets = result.totalBank + result.totalCurrentAssets + result.totalFixedAssets + result.totalNonCurrentAssets;
  result.totalLiabilities = result.totalCurrentLiabilities + result.totalNonCurrentLiabilities;
  result.netEquity = Object.values(result.equity).reduce((s, v) => s + v, 0);
  result.netAssets = result.totalAssets - result.totalLiabilities;
  result.keyAccounts.bankBalance = result.totalBank;

  return result;
}

// ===== GENERIC PARSER (for P&L, AR, Bin Manager) =====
export async function parseGenericExcel(file) {
  const { data, fileName, sheetName } = await readFile(file);
  return {
    fileName,
    sheetName,
    headers: data[0] || [],
    rows: data.slice(1),
    rowCount: data.length - 1,
    raw: data,
  };
}

// ===== HELPER: Categorise income lines into groups =====
function categoriseIncome(incomeMap) {
  const cats = {
    generalWaste: 0, asbestos: 0, soil: 0, greenWaste: 0, other: 0
  };
  Object.entries(incomeMap).forEach(([key, val]) => {
    const k = key.toUpperCase();
    if (k.includes('ASB') || k.includes('ASBESTOS')) cats.asbestos += val;
    else if (k.includes('SOI') || k.includes('SOIL') || k.includes('CONTAMINATED')) cats.soil += val;
    else if (k.includes('GRW') || k.includes('GREEN')) cats.greenWaste += val;
    else if (k.includes('WMF') || k.includes('GENERAL WASTE') || k.includes('TONNAGE')) cats.generalWaste += val;
    else cats.other += val;
  });
  return cats;
}

// ===== VALIDATION =====
export function validateFile(parsed, expectedType) {
  const warnings = [];
  const errors = [];

  if (expectedType === 'cashSummary') {
    if (!parsed.month) warnings.push('Could not detect month from file header');
    if (parsed.totalIncome === 0) errors.push('Total income is $0 — file may be empty or wrong format');
    if (parsed.cashBalance === 0) warnings.push('Cash balance is $0 — check if this is correct');
    if (Object.keys(parsed.income).length < 5) warnings.push('Very few income lines — may not be the full report');
  }

  if (expectedType === 'balanceSheet') {
    if (!parsed.asAt) warnings.push('Could not detect balance date');
    if (parsed.totalAssets === 0) warnings.push('Total assets is $0');
  }

  return { valid: errors.length === 0, errors, warnings };
}
