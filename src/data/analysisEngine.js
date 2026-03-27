// Analysis Engine — generates recommended actions per dashboard tab
import * as D from './financials';

const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
const sum = arr => arr.reduce((a,b)=>a+b,0);
const last = arr => arr[arr.length-1];
const prev = arr => arr[arr.length-2];

export function generateAlerts() {
  const alerts = {};
  const latestMonth = D.months[D.months.length-1];
  const prevMonth = D.months[D.months.length-2];

  // === SNAPSHOT ===
  alerts.snapshot = [];
  if (last(D.netProfit) < 0) alerts.snapshot.push({sev:'critical', text:`${latestMonth} made a net loss of $${Math.abs(Math.round(last(D.netProfit))).toLocaleString()} — review cost drivers immediately`});
  if (last(D.gmPct) > 85) alerts.snapshot.push({sev:'critical', text:`${latestMonth} gross margin is ${last(D.gmPct)}% which is abnormally high — almost certainly due to missing COS invoices`});
  if (D.netProfit.slice(-3).every((v,i,a) => i===0 || v < a[i-1])) alerts.snapshot.push({sev:'warning', text:`Net profit has declined for 3 consecutive months — review pipeline and costs`});
  if (D.ytdNetProfit > 0) alerts.snapshot.push({sev:'positive', text:`Business is profitable YTD — $${Math.round(D.ytdNetProfit).toLocaleString()} net profit (${D.ytdNP}% margin)`});
  const bestMonth = Math.max(...D.totalRevenue);
  const bestIdx = D.totalRevenue.indexOf(bestMonth);
  alerts.snapshot.push({sev:'positive', text:`${D.months[bestIdx]} was the strongest revenue month at $${Math.round(bestMonth).toLocaleString()}`});

  // === REVENUE ===
  alerts.revenue = [];
  const catTotals = {
    'General Waste': sum(D.revByCategory.generalWaste),
    'Asbestos': sum(D.revByCategory.asbestos),
    'Soil': sum(D.revByCategory.soil),
    'Green Waste': sum(D.revByCategory.greenWaste),
    'Other': sum(D.revByCategory.other),
  };
  const totalRev = Object.values(catTotals).reduce((a,b)=>a+b,0);
  Object.entries(catTotals).forEach(([cat,val]) => {
    const pct = (val/totalRev*100).toFixed(1);
    if (pct > 60) alerts.revenue.push({sev:'warning', text:`${cat} is ${pct}% of total revenue — profit concentration risk if margins shift. Diversify revenue streams.`});
    if (pct < 5 && pct > 0) alerts.revenue.push({sev:'info', text:`${cat} is only ${pct}% of revenue — growth opportunity if margins are healthy`});
  });
  // Month-on-month profit impact
  const gwLast = last(D.revByCategory.generalWaste);
  const gwPrev = prev(D.revByCategory.generalWaste);
  if (gwLast < gwPrev * 0.6) alerts.revenue.push({sev:'critical', text:`General Waste revenue dropped ${((1-gwLast/gwPrev)*100).toFixed(0)}% — estimated $${Math.round((gwPrev-gwLast)*0.65).toLocaleString()} profit impact (at ~65% GM)`});
  // Profit trend
  const npTrend = D.netProfit.slice(-3);
  if (npTrend[2] > npTrend[1] && npTrend[1] > npTrend[0]) alerts.revenue.push({sev:'positive', text:`Net profit improving 3 months running — from $${Math.round(npTrend[0]).toLocaleString()} to $${Math.round(npTrend[2]).toLocaleString()}`});
  if (D.ytdNetProfit > 0) alerts.revenue.push({sev:'positive', text:`YTD net profit $${Math.round(D.ytdNetProfit).toLocaleString()} at ${D.ytdNP}% margin — on track for ~$${Math.round(D.ytdNetProfit/8*12).toLocaleString()} annualised`});

  // === MARGINS ===
  alerts.margins = [];
  const avgCOS = avg(D.totalCOS.slice(0,-1)); // exclude latest
  if (last(D.totalCOS) < avgCOS * 0.3) alerts.margins.push({sev:'critical', text:`${latestMonth} COS ($${Math.round(last(D.totalCOS)).toLocaleString()}) is ${Math.round((1-last(D.totalCOS)/avgCOS)*100)}% below average — almost certainly missing invoices. Average is $${Math.round(avgCOS).toLocaleString()}`});
  const avgFuel = avg(D.fuelCosts.slice(0,-2));
  if (last(D.fuelCosts) < avgFuel * 0.1) alerts.margins.push({sev:'critical', text:`Fuel cost $${Math.round(last(D.fuelCosts)).toLocaleString()} appears unposted — 8-month average is $${Math.round(avgFuel).toLocaleString()}`});
  if (D.fuelCosts.length > 1 && D.fuelCosts[D.fuelCosts.length-2] < avgFuel * 0.1) alerts.margins.push({sev:'critical', text:`${prevMonth} fuel ($${Math.round(prev(D.fuelCosts)).toLocaleString()}) also appears unposted`});
  if (last(D.rent) === 0) alerts.margins.push({sev:'critical', text:`Rent is $0 in ${latestMonth} — payment not posted. Monthly average is $${Math.round(avg(D.rent.filter(r=>r>0))).toLocaleString()}`});
  const avgWage = avg(D.wages);
  if (last(D.wages) > avgWage * 1.2) alerts.margins.push({sev:'warning', text:`Wages ($${Math.round(last(D.wages)).toLocaleString()}) are ${Math.round((last(D.wages)/avgWage-1)*100)}% above average — check overtime`});

  // === PRICING ===
  alerts.pricing = [];
  D.pricingData.forEach(p => {
    if (p.np < -15) alerts.pricing.push({sev:'critical', text:`${p.type}: NET MARGIN ${p.np}% on ${p.jobs} jobs — losing significant money. Review urgently.`});
    else if (p.np < 0) alerts.pricing.push({sev:'warning', text:`${p.type}: unprofitable at ${p.np}% net margin (${p.jobs} jobs, avg $${p.avgRate}). Price increase needed.`});
    else if (p.np > 20 && p.jobs > 5) alerts.pricing.push({sev:'positive', text:`${p.type}: strong performer at ${p.np}% net margin — maintain pricing`});
  });
  // Dollar impact
  const worstByImpact = D.pricingData.filter(p=>p.np<0).sort((a,b)=>a.jobs*Math.abs(a.np)-b.jobs*Math.abs(b.np)).reverse();
  if (worstByImpact.length > 0) {
    const w = worstByImpact[0];
    alerts.pricing.push({sev:'info', text:`Biggest dollar opportunity: $50 price increase on ${w.type} (${w.jobs} jobs) = ~$${(w.jobs*50).toLocaleString()} annual profit improvement`});
  }

  // === COMPETITORS ===
  alerts.competitors = [];
  alerts.competitors.push({sev:'warning', text:`Most competitor pricing is "POA" — phone round needed to get actual market rates`});
  alerts.competitors.push({sev:'positive', text:`Your 4m GW at $641 is ABOVE budget market range ($350-$440) — premium position`});
  alerts.competitors.push({sev:'positive', text:`Your 6m GW at $865 is within top of market range ($500-$800) — strong pricing power`});

  // === BDM ===
  alerts.bdm = [];
  const newCount = D.newCustomersFeb.length;
  const dormantCount = D.dormantCustomers.length;
  if (dormantCount > newCount) alerts.bdm.push({sev:'critical', text:`Net customer decline: ${newCount} new vs ${dormantCount} dormant — retention strategy needed`});
  const highValueDormant = D.dormantCustomers.filter(c=>c.totalYTD>1000).sort((a,b)=>b.totalYTD-a.totalYTD);
  highValueDormant.forEach(c => alerts.bdm.push({sev:'warning', text:`Call ${c.name} — $${c.totalYTD.toLocaleString()} YTD revenue, dormant since ${c.lastJob}`}));
  const keyNew = D.newCustomersFeb.filter(c=>c.jobs>=3);
  keyNew.forEach(c => alerts.bdm.push({sev:'positive', text:`Key account alert: ${c.name} placed ${c.jobs} jobs in first month ($${c.revenue.toLocaleString()}) — nurture relationship`}));

  // === FLEET ===
  alerts.fleet = [];
  D.binTypesData.forEach(b => {
    if (b.avgDays > 14) alerts.fleet.push({sev:'warning', text:`${b.name}: avg ${b.avgDays} days on site — consider hire period enforcement or surcharge`});
    if (b.delivered < 5) alerts.fleet.push({sev:'info', text:`${b.name}: only ${b.delivered} deliveries in ${latestMonth} — consider whether to maintain stock`});
  });
  alerts.fleet.push({sev:'positive', text:`Top earner: ${D.binTypesData[0].name} — $${D.binTypesData[0].income.toLocaleString()} from ${D.binTypesData[0].delivered} deliveries`});

  // === DEBTORS ===
  alerts.debtors = [];
  const overduePct = (D.arOverdue/D.arTotal*100).toFixed(1);
  if (overduePct > 20) alerts.debtors.push({sev:'critical', text:`${overduePct}% of AR is overdue ($${Math.round(D.arOverdue).toLocaleString()}) — tighten collection process`});
  else if (overduePct > 10) alerts.debtors.push({sev:'warning', text:`${overduePct}% of AR is overdue ($${Math.round(D.arOverdue).toLocaleString()}) — monitor closely`});
  D.topDebtors.slice(0,3).forEach(d => {
    const pct = (d.total/D.arTotal*100).toFixed(1);
    if (pct > 10) alerts.debtors.push({sev:'warning', text:`${d.name} owes $${Math.round(d.total).toLocaleString()} (${pct}% of total AR) — concentration risk`});
  });
  if (D.arData.Older > 5000) alerts.debtors.push({sev:'critical', text:`Aged debt in 'Older' bucket is $${Math.round(D.arData.Older).toLocaleString()} — may need to write off or escalate`});

  // === CASHFLOW ===
  alerts.cashflow = [];
  const cashGap = last(D.totalRevenue) - last(D.cashIncome);
  if (Math.abs(cashGap) > 50000) alerts.cashflow.push({sev:'critical', text:`Cash gap of $${Math.round(Math.abs(cashGap)).toLocaleString()} — invoices not being collected. Chase debtors urgently.`});
  if (last(D.cashBalance) < prev(D.cashBalance)) alerts.cashflow.push({sev:'warning', text:`Cash balance fell from $${Math.round(prev(D.cashBalance)).toLocaleString()} to $${Math.round(last(D.cashBalance)).toLocaleString()}`});
  const taxLiability = (D.balanceSheet.gst || 0) + (D.balanceSheet.paygWithholding || 0);
  if (taxLiability > 100000) alerts.cashflow.push({sev:'critical', text:`Tax liability ($${Math.round(taxLiability).toLocaleString()}) — confirm ATO payment plan is in place`});
  if (D.balanceSheet.equity.total < 0) alerts.cashflow.push({sev:'warning', text:`Net equity is negative ($${Math.round(D.balanceSheet.equity.total).toLocaleString()}) — business needs sustained profitability to rebuild`});

  // === RISK ===
  alerts.risk = [];
  alerts.risk.push({sev:'critical', text:`No WHS incident register. Director liability exposure. Implement immediately.`});
  alerts.risk.push({sev:'critical', text:`Asbestos documentation completeness not tracked. Must be 100% for every job.`});
  alerts.risk.push({sev:'critical', text:`Training currency matrix does not exist. All regulated waste handlers need verified records.`});
  if (sum(D.revByCategory.asbestos) > 0) alerts.risk.push({sev:'warning', text:`$${Math.round(sum(D.revByCategory.asbestos)).toLocaleString()} YTD asbestos revenue — documentation compliance is essential`});
  if (sum(D.revByCategory.soil) > 0) alerts.risk.push({sev:'warning', text:`$${Math.round(sum(D.revByCategory.soil)).toLocaleString()} YTD contaminated soil revenue — verify all tip receipts and classifications`});

  return alerts;
}
