/**
 * JOB COST ALLOCATION ENGINE v3
 * 
 * Strategy:
 * 1. pricingData already has COS and Opex per bin type (from Xero reports)
 * 2. Scale those so they reconcile EXACTLY to P&L YTD totals
 * 3. Break COS down into subcategories (tipping, fuel, wages etc) using distance weights
 * 4. Break Opex down into subcategories (rent, advertising etc) using revenue share
 * 
 * Result: every dollar in the P&L is accounted for, totals match exactly.
 */

import * as D from './financials';

// ========== TIP SITE DISTANCES (km one-way from Seaford depot) ==========
export const tipSiteDistances = {
  'Seaford Transfer Station':     2,
  'Cleanaway Clayton':            25,
  'SUEZ Hallam':                  18,
  'Hi-Quality Dandenong':         15,
  'Cleanaway Ravenhall':          55,
  'Cleanaway Brookland Greens':   35,
  'Boral Recycling Deer Park':    52,
  'Alex Fraser Laverton':         45,
  'Melbourne Regional Landfill':  60,
  'Tyabb Transfer Station':       22,
  'Veolia Noble Park':            20,
};

const DEFAULT_TIP_DISTANCE = 2;
const avgPickupDistance = { 'General Waste': 20, 'Asbestos': 25, 'Soil': 22, 'Green Waste': 18, 'Contaminated': 25 };

// ========== HELPERS ==========
const sum = arr => arr.reduce((a, b) => a + b, 0);

function getBinSizeFactor(binType) {
  const t = binType.toLowerCase();
  if (t.includes('1.1m') || t.includes('2m')) return 0.5;
  if (t.includes('4m')) return 0.8;
  if (t.includes('6m')) return 1.0;
  if (t.includes('8m')) return 1.2;
  if (t.includes('10m')) return 1.4;
  if (t.includes('12m')) return 1.6;
  if (t.includes('16m')) return 1.9;
  if (t.includes('23m') || t.includes('big')) return 2.5;
  return 1.0;
}

function getCategory(binType) {
  const t = binType.toLowerCase();
  if (t.includes('asb') || t.includes('asbestos')) return 'Asbestos';
  if (t.includes('soil') || t.includes('contaminated')) return 'Soil';
  if (t.includes('green') || t.includes('grw')) return 'Green Waste';
  return 'General Waste';
}

function getDistanceWeight(binType) {
  const cat = getCategory(binType);
  const pickupDist = avgPickupDistance[cat] || 20;
  const tipDist = DEFAULT_TIP_DISTANCE;
  const sizeFactor = getBinSizeFactor(binType);
  return (pickupDist + tipDist + tipDist) * sizeFactor;
}

// ========== YTD P&L ACTUALS ==========
function getYTDActuals() {
  return {
    revenue: sum(D.totalRevenue),
    cos: sum(D.totalCOS),
    opex: sum(D.totalOpex),
    // Subcategory totals from P&L
    fuel: sum(D.fuelCosts),
    wages: sum(D.wages),
    tolls: sum(D.tolls),
    repairs: sum(D.repairs),
    rent: sum(D.rent),
    advertising: sum(D.advertising),
  };
}

// ========== MAIN ALLOCATION ==========
export function allocateCosts(jobsData = null) {
  const pl = getYTDActuals();
  const bins = D.pricingData;

  // Step 1: Get raw totals from pricingData
  const rawCOSTotal = bins.reduce((s, p) => s + p.cos, 0);
  const rawOpexTotal = bins.reduce((s, p) => s + p.opex, 0);
  const rawRevTotal = bins.reduce((s, p) => s + p.rev, 0);

  // Step 2: Scale factors to reconcile to P&L
  const cosScale = rawCOSTotal > 0 ? pl.cos / rawCOSTotal : 1;
  const opexScale = rawOpexTotal > 0 ? pl.opex / rawOpexTotal : 1;
  const revScale = rawRevTotal > 0 ? pl.revenue / rawRevTotal : 1;

  // Step 3: COS subcategory ratios (from P&L actuals)
  // In a skip bin business, COS is primarily tipping/disposal fees
  // But fuel, direct wages, tolls are also direct job costs
  // We split COS into: Tipping (the bulk), then use distance weights for fuel/wages/tolls share
  //
  // From P&L: total COS = 392,646. This IS the disposal/tipping + direct costs
  // The opex line items (wages, fuel, tolls, repairs, rent, ad, other) are separate
  //
  // So COS breakdown = tipping-heavy, and Opex breakdown = wages-heavy
  
  // COS subcategory split ratios (what makes up Cost of Sales)
  // Tipping/disposal is the dominant COS item (~70%), rest is direct labour/transport
  const cosRatios = { tipping: 0.70, fuel: 0.10, wagesDirect: 0.12, tolls: 0.05, repairs: 0.03 };

  // Opex subcategory split ratios (from actual P&L line items)
  const opexTotal = pl.opex;
  const opexRatios = {
    wages: opexTotal > 0 ? pl.wages / opexTotal : 0.55,
    rent: opexTotal > 0 ? pl.rent / opexTotal : 0.05,
    advertising: opexTotal > 0 ? pl.advertising / opexTotal : 0.03,
    fuel: opexTotal > 0 ? pl.fuel / opexTotal : 0.09,
    tolls: opexTotal > 0 ? pl.tolls / opexTotal : 0.04,
    repairs: opexTotal > 0 ? pl.repairs / opexTotal : 0.04,
  };
  opexRatios.other = Math.max(0, 1 - opexRatios.wages - opexRatios.rent - opexRatios.advertising - opexRatios.fuel - opexRatios.tolls - opexRatios.repairs);

  // Step 4: Distance weights for each bin type (affects COS subcategory distribution)
  const weighted = bins.map(p => {
    const dw = getDistanceWeight(p.type);
    return { ...p, distWeight: dw, distTotal: dw * p.jobs };
  });
  const totalDistWeight = weighted.reduce((s, w) => s + w.distTotal, 0);

  // Step 5: Allocate
  const allocated = weighted.map(w => {
    // Scaled totals that reconcile to P&L
    const scaledCOS = w.cos * cosScale;
    const scaledOpex = w.opex * opexScale;
    const scaledRev = w.rev * revScale;

    // Distance share for this bin type
    const distShare = totalDistWeight > 0 ? w.distTotal / totalDistWeight : 1 / bins.length;

    // COS breakdown: tipping is flat ratio, transport costs use distance weighting
    // We blend: tipping by flat COS share, transport by distance
    const tipBase = scaledCOS * cosRatios.tipping;
    const fuelCOS = scaledCOS * cosRatios.fuel * (distShare * bins.length / (w.jobs > 0 ? 1 : 1)); // stays proportional to this bin's COS but adjusted by distance
    const wagesCOS = scaledCOS * cosRatios.wagesDirect;
    const tollsCOS = scaledCOS * cosRatios.tolls;
    const repairsCOS = scaledCOS * cosRatios.repairs;
    // Ensure COS subcats sum to scaledCOS
    const cosSubTotal = tipBase + fuelCOS + wagesCOS + tollsCOS + repairsCOS;
    const cosAdjust = scaledCOS > 0 ? scaledCOS / cosSubTotal : 1;

    const cosBrk = {
      tipping: tipBase * cosAdjust,
      fuel: fuelCOS * cosAdjust,
      wagesDirect: wagesCOS * cosAdjust,
      tolls: tollsCOS * cosAdjust,
      repairs: repairsCOS * cosAdjust,
    };

    // Opex breakdown: use P&L ratios applied to this bin type's scaled opex
    const opexBrk = {
      wages: scaledOpex * opexRatios.wages,
      rent: scaledOpex * opexRatios.rent,
      advertising: scaledOpex * opexRatios.advertising,
      fuel: scaledOpex * opexRatios.fuel,
      tolls: scaledOpex * opexRatios.tolls,
      repairs: scaledOpex * opexRatios.repairs,
      other: scaledOpex * opexRatios.other,
    };

    const totalDirect = scaledCOS;
    const totalOverhead = scaledOpex;
    const totalCost = totalDirect + totalOverhead;
    const profit = scaledRev - totalCost;
    const profitPct = scaledRev > 0 ? (profit / scaledRev * 100) : 0;

    // Per job
    const perJob = w.jobs > 0 ? {
      revenue: scaledRev / w.jobs,
      // COS line items
      tipping: cosBrk.tipping / w.jobs,
      fuel: (cosBrk.fuel + opexBrk.fuel) / w.jobs,        // combine COS fuel + opex fuel
      wagesDirect: cosBrk.wagesDirect / w.jobs,
      tolls: (cosBrk.tolls + opexBrk.tolls) / w.jobs,     // combine
      repairs: (cosBrk.repairs + opexBrk.repairs) / w.jobs, // combine
      // Pure overhead items
      wagesOH: opexBrk.wages / w.jobs,
      rent: opexBrk.rent / w.jobs,
      advertising: opexBrk.advertising / w.jobs,
      otherOpex: opexBrk.other / w.jobs,
      // Totals
      totalDirect: totalDirect / w.jobs,
      totalOverhead: totalOverhead / w.jobs,
      totalCost: totalCost / w.jobs,
      profit: profit / w.jobs,
    } : null;

    return {
      ...w,
      scaledRev,
      alloc: {
        cosBrk, opexBrk,
        totalDirect, totalOverhead, totalCost, profit, profitPct,
      },
      perJob,
    };
  });

  // Reconciliation
  const reconCheck = {
    allocRevenue: allocated.reduce((s, a) => s + a.scaledRev, 0),
    allocDirectCosts: allocated.reduce((s, a) => s + a.alloc.totalDirect, 0),
    allocOverheads: allocated.reduce((s, a) => s + a.alloc.totalOverhead, 0),
    allocTotalCosts: allocated.reduce((s, a) => s + a.alloc.totalCost, 0),
    allocProfit: allocated.reduce((s, a) => s + a.alloc.profit, 0),
    allocJobs: allocated.reduce((s, a) => s + a.jobs, 0),
    plRevenue: pl.revenue,
    plCOS: pl.cos,
    plOpex: pl.opex,
    plTotalCosts: pl.cos + pl.opex,
    plNetProfit: pl.revenue - pl.cos - pl.opex,
    varianceCOS: 0,
    varianceOpex: 0,
    varianceTotal: 0,
  };
  reconCheck.varianceCOS = Math.abs(reconCheck.allocDirectCosts - reconCheck.plCOS);
  reconCheck.varianceOpex = Math.abs(reconCheck.allocOverheads - reconCheck.plOpex);
  reconCheck.varianceTotal = Math.abs(reconCheck.allocTotalCosts - reconCheck.plTotalCosts);

  return { allocated, pl, reconCheck };
}

/**
 * Bar chart segments for per-job cost breakdown
 */
export function getJobCostBarSegments(perJob, colors) {
  if (!perJob || perJob.revenue <= 0) return [];
  const rev = perJob.revenue;
  return [
    { label: 'Tipping',       amount: perJob.tipping,      pct: perJob.tipping / rev * 100,      color: colors.tipping },
    { label: 'Fuel',           amount: perJob.fuel,          pct: perJob.fuel / rev * 100,          color: colors.fuel },
    { label: 'Wages (direct)', amount: perJob.wagesDirect,   pct: perJob.wagesDirect / rev * 100,   color: colors.wagesDirect },
    { label: 'Tolls',          amount: perJob.tolls,         pct: perJob.tolls / rev * 100,         color: colors.tolls },
    { label: 'Repairs',        amount: perJob.repairs,       pct: perJob.repairs / rev * 100,       color: colors.repairs },
    { label: 'Wages (admin)',  amount: perJob.wagesOH,       pct: perJob.wagesOH / rev * 100,       color: colors.wagesOH },
    { label: 'Rent',           amount: perJob.rent,          pct: perJob.rent / rev * 100,          color: colors.rent },
    { label: 'Advertising',    amount: perJob.advertising,   pct: perJob.advertising / rev * 100,   color: colors.advertising },
    { label: 'Other OH',       amount: perJob.otherOpex,     pct: perJob.otherOpex / rev * 100,     color: colors.otherOpex },
    { label: perJob.profit < 0 ? 'LOSS' : 'Profit', amount: Math.abs(perJob.profit), pct: Math.abs(perJob.profit) / rev * 100, color: perJob.profit < 0 ? colors.loss : colors.profit },
  ].filter(s => s.pct > 0.5);
}
