import React, { useState, useMemo } from 'react';
import { B, fontHead, fmtFull } from '../theme';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { pricingData, binTypesData, totalRevenue, totalCOS, totalOpex, fuelCosts, wages, tolls, repairs, rent, advertising, competitorData } from '../data/financials';
import { allocateCosts, getJobCostBarSegments } from '../data/costAllocator';

// Map binTypesData names → pricingData type names
const binNameMap = {
  'WMF - 4m': '4m General Waste', 'WMF - 6m': '6m General Waste', 'WMF - 8m': '8m General Waste',
  'WMF - 10m': '10m General Waste', 'WMF - 12m': '12m General Waste', 'WMF - 16m': '16m General Waste',
  'WMF - 23m': '23m General Waste', 'ASB - 4m': '4m Asbestos', 'ASB - 6m': '6m Asbestos',
  'ASB - 8m': '8m Asbestos', '6M CONT SOIL': '8m Soil',
  'ASB - Bigm': '8m Asbestos', 'ASB - 10m': '10m Asbestos', 'ASB - 16m': '16m Asbestos',
  'ASB - 23m': '23m Asbestos', 'ASB - 2M': '2m Asbestos', 'ASBESTOS 2M': '2m Asbestos',
};

// Market ranges converted to ex GST (competitor websites show inc GST)
const exG = v => Math.round(v / 1.1);
const marketRanges = {
  '4m General Waste': { low: exG(350), high: exG(440), label: '$318-$400 ex' },
  '6m General Waste': { low: exG(500), high: exG(800), label: '$455-$727 ex' },
  '8m General Waste': { low: exG(660), high: exG(680), label: '$600-$618 ex' },
  '10m General Waste': { low: exG(700), high: exG(900), label: '$636-$818 ex' },
  '12m General Waste': { low: exG(850), high: exG(1200), label: '$773-$1,091 ex' },
  '16m General Waste': { low: exG(1200), high: exG(1800), label: '$1,091-$1,636 ex' },
  '4m Asbestos': { low: exG(800), high: exG(1100), label: '$727-$1,000 ex' },
  '6m Asbestos': { low: exG(1200), high: exG(1800), label: '$1,091-$1,636 ex' },
  '8m Asbestos': { low: exG(1800), high: exG(2500), label: '$1,636-$2,273 ex' },
};

const barColors = {
  tipping: '#B07090', fuel: B.red, wagesDirect: B.orange, tolls: '#7B8AAA', repairs: '#8B6EB5',
  rent: B.blue, advertising: B.cyan, wagesOH: '#9B8EC9', otherOpex: B.amber,
  profit: B.green, loss: '#8B6080',
};

export default function PricingTab({ monthIndex = 7, monthLabel = 'Feb 2026' }) {
  const { isMobile } = useBreakpoint();
  const [expanded, setExpanded] = useState(null);
  const [showRecon, setShowRecon] = useState(false);
  const [sortCol, setSortCol] = useState('profit');
  const [sortAsc, setSortAsc] = useState(true);

  // YTD allocation (all 8 months) — used to derive per-type cost ratios
  const { allocated: ytdAllocated, costs: ytdCosts, reconCheck } = useMemo(() => allocateCosts(pricingData), []);

  // Build selected month data + derive YTD avg from prior months
  const typeData = useMemo(() => {
    const curRev = totalRevenue[monthIndex];
    const curCOS = totalCOS[monthIndex];
    const curOpex = totalOpex[monthIndex];
    const priorCount = monthIndex; // months before selected (0 for Jul = no prior avg)

    // Build per-bin-type data for the selected month
    const curBins = {};
    if (monthIndex === 7) {
      // Feb: use real Bin Manager data
      binTypesData.forEach(b => {
        const mapped = binNameMap[b.name];
        if (!mapped) return;
        if (!curBins[mapped]) curBins[mapped] = { income: 0, jobs: 0, avgRate: 0 };
        curBins[mapped].income += b.income;
        curBins[mapped].jobs += b.delivered;
      });
    } else {
      // Other months: estimate from YTD pricingData proportions
      const ytdTotalRev = pricingData.reduce((s, p) => s + p.rev, 0);
      const avgMonthRevAll = ytdTotalRev / 8;
      const monthScale = avgMonthRevAll > 0 ? curRev / avgMonthRevAll : 1;
      pricingData.forEach(p => {
        const share = ytdTotalRev > 0 ? p.rev / ytdTotalRev : 0;
        const estIncome = curRev * share;
        const estJobs = Math.max(1, Math.round((p.jobs / 8) * monthScale));
        curBins[p.type] = { income: estIncome, jobs: estJobs, avgRate: estJobs > 0 ? Math.round(estIncome / estJobs) : p.avgRate };
      });
    }
    Object.values(curBins).forEach(cb => { if (cb.jobs > 0 && cb.avgRate === 0) cb.avgRate = Math.round(cb.income / cb.jobs); });
    const curTotalBinRev = Object.values(curBins).reduce((s, b) => s + b.income, 0);

    return ytdAllocated.map(ytd => {
      const cur = curBins[ytd.type] || { income: 0, jobs: 0, avgRate: 0 };

      // Selected month cost allocation
      const curRevShare = curTotalBinRev > 0 ? cur.income / curTotalBinRev : 0;
      const curDirectCost = curCOS * curRevShare;
      const curOverhead = curOpex * curRevShare;
      const curTotalCost = curDirectCost + curOverhead;
      const curProfit = cur.income - curTotalCost;
      const curNP = cur.income > 0 ? (curProfit / cur.income * 100) : 0;
      const curGM = cur.income > 0 ? ((cur.income - curDirectCost) / cur.income * 100) : 0;

      const curPerJob = cur.jobs > 0 ? {
        revenue: cur.income / cur.jobs,
        directCost: curDirectCost / cur.jobs,
        overhead: curOverhead / cur.jobs,
        totalCost: curTotalCost / cur.jobs,
        profit: curProfit / cur.jobs,
      } : null;

      // YTD avg from months BEFORE selected
      const ytdExCurRev = ytd.rev - cur.income;
      const ytdExCurJobs = ytd.jobs - cur.jobs;
      const ytdExCurDirect = ytd.alloc.totalDirect * ((ytd.rev - cur.income) / (ytd.rev || 1));
      const ytdExCurOH = ytd.alloc.totalOverhead * ((ytd.rev - cur.income) / (ytd.rev || 1));
      const avgMonthRev = priorCount > 0 ? ytdExCurRev / priorCount : 0;
      const avgMonthJobs = priorCount > 0 ? ytdExCurJobs / priorCount : 0;
      const avgMonthDirect = priorCount > 0 ? ytdExCurDirect / priorCount : 0;
      const avgMonthOH = priorCount > 0 ? ytdExCurOH / priorCount : 0;
      const avgMonthProfit = avgMonthRev - avgMonthDirect - avgMonthOH;
      const avgMonthNP = avgMonthRev > 0 ? (avgMonthProfit / avgMonthRev * 100) : 0;
      const avgMonthRate = avgMonthJobs > 0 ? Math.round(avgMonthRev / avgMonthJobs) : 0;

      const avgPerJob = avgMonthJobs > 0 ? {
        revenue: avgMonthRev / avgMonthJobs,
        directCost: avgMonthDirect / avgMonthJobs,
        overhead: avgMonthOH / avgMonthJobs,
        totalCost: (avgMonthDirect + avgMonthOH) / avgMonthJobs,
        profit: avgMonthProfit / avgMonthJobs,
      } : null;

      // Market position
      const market = marketRanges[ytd.type] || null;
      const rate = cur.avgRate || ytd.avgRate;
      let marketPosition = 'unknown';
      if (market) {
        if (rate < market.low) marketPosition = 'below';
        else if (rate > market.high) marketPosition = 'above';
        else marketPosition = 'within';
      }

      return {
        type: ytd.type,
        // Selected month numbers (kept as 'feb' key for backward compat with render code)
        feb: { rev: cur.income, jobs: cur.jobs, avgRate: cur.avgRate, directCost: curDirectCost, overhead: curOverhead, totalCost: curTotalCost, profit: curProfit, np: curNP, gm: curGM, perJob: curPerJob },
        // YTD monthly avg (prior months)
        avg: { rev: avgMonthRev, jobs: Math.round(avgMonthJobs * 10) / 10, avgRate: avgMonthRate, directCost: avgMonthDirect, overhead: avgMonthOH, totalCost: avgMonthDirect + avgMonthOH, profit: avgMonthProfit, np: avgMonthNP, perJob: avgPerJob },
        ytdAlloc: ytd,
        market,
        marketPosition,
      };
    }).filter(d => d.feb.jobs > 0 || d.avg.jobs > 0);
  }, [ytdAllocated, monthIndex]);

  // Selected month P&L totals for top KPIs
  const curMonthRev = totalRevenue[monthIndex];
  const curMonthCOS = totalCOS[monthIndex];
  const curMonthOpex = totalOpex[monthIndex];
  const curMonthJobs = typeData.reduce((s, d) => s + d.feb.jobs, 0);
  const curMonthNP = curMonthRev > 0 ? ((curMonthRev - curMonthCOS - curMonthOpex) / curMonthRev * 100) : 0;
  const curMonthGM = curMonthRev > 0 ? ((curMonthRev - curMonthCOS) / curMonthRev * 100) : 0;

  // AI suggestions with market context
  const suggestions = useMemo(() => {
    const items = [];
    typeData.forEach(d => {
      if (d.feb.jobs === 0) return;
      const pj = d.feb.perJob;
      if (!pj) return;

      if (d.feb.np < 0) {
        const shortfall = pj.totalCost - pj.revenue;
        let text = d.type + ': Losing ' + fmtFull(Math.abs(pj.profit)) + '/job this month (' + d.feb.np.toFixed(1) + '% NP).';
        if (d.avg.perJob && d.avg.perJob.profit > pj.profit) {
          text += ' This is WORSE than your Jul–Jan avg of ' + fmtFull(d.avg.perJob.profit) + '/job.';
        } else if (d.avg.perJob) {
          text += ' Avg month (Jul–Jan) was also loss-making at ' + fmtFull(d.avg.perJob.profit) + '/job — systemic issue.';
        }
        if (d.market) {
          if (d.marketPosition === 'above') {
            text += ' CAUTION: Your rate ($' + (d.feb.avgRate || d.ytdAlloc.avgRate) + ') is ABOVE market (' + d.market.label + '). Raising prices further risks volume loss — focus on cost reduction instead.';
          } else if (d.marketPosition === 'within') {
            const headroom = d.market.high - (d.feb.avgRate || d.ytdAlloc.avgRate);
            text += ' Market range is ' + d.market.label + '. Room for ~$' + Math.round(headroom) + ' increase before exceeding market.';
          } else if (d.marketPosition === 'below') {
            text += ' Currently BELOW market (' + d.market.label + '). Strong case for price increase.';
          }
        }
        items.push({ sev: 'critical', text });
      } else if (d.feb.np < 5 && d.feb.np >= 0) {
        let text = d.type + ': Marginal at ' + d.feb.np.toFixed(1) + '% NP this month (' + fmtFull(pj.profit) + '/job).';
        if (d.market && d.marketPosition !== 'above') {
          text += ' Market range ' + d.market.label + ' allows room for improvement.';
        }
        items.push({ sev: 'warning', text });
      }
    });
    const profitable = typeData.filter(d => d.feb.np > 5 && d.feb.jobs > 0).sort((a, b) => b.feb.np - a.feb.np);
    if (profitable.length > 0) {
      items.push({ sev: 'positive', text: 'Top performers this month: ' + profitable.slice(0, 3).map(d => d.type + ' (' + d.feb.np.toFixed(1) + '% NP, ' + d.feb.jobs + ' jobs)').join(', ') + '. Push volume on these.' });
    }
    return items;
  }, [typeData]);

  const Delta = ({ val, invert }) => {
    if (val === null || val === undefined || isNaN(val)) return <span style={{ color: B.textMuted }}>—</span>;
    const good = invert ? val < 0 : val > 0;
    const c = good ? B.green : val === 0 ? B.textMuted : B.red;
    return <span style={{ color: c, fontWeight: 600, fontSize: 11 }}>{val > 0 ? '↑' : val < 0 ? '↓' : '='}{Math.abs(val).toFixed(1)}%</span>;
  };

  // Sort columns config
  const sortKeys = {
    type: d => d.type.toLowerCase(),
    rev: d => d.feb.rev,
    direct: d => d.feb.directCost,
    oh: d => d.feb.overhead,
    profit: d => d.feb.profit,
    np: d => d.feb.np,
    jobs: d => d.feb.jobs,
  };
  const sortedData = useMemo(() => {
    const fn = sortKeys[sortCol] || sortKeys.np;
    return [...typeData].sort((a, b) => {
      const av = fn(a), bv = fn(b);
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
  }, [typeData, sortCol, sortAsc]);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(col === 'type'); }
  };

  const hdrs = [
    { label: 'Bin Type', key: 'type', align: 'left' },
    { label: 'Rev', key: 'rev', align: 'right' },
    { label: 'Direct', key: 'direct', align: 'right' },
    { label: 'OH', key: 'oh', align: 'right' },
    { label: 'Profit', key: 'profit', align: 'right' },
    { label: 'NP%', key: 'np', align: 'right' },
    { label: 'Jobs (Feb / Avg)', key: 'jobs', align: 'right' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: B.textPrimary, margin: 0, fontFamily: fontHead, textTransform: 'uppercase' }}>Benchmarking & Pricing Analysis</h2>
        <p style={{ fontSize: 13, color: B.textSecondary, margin: '4px 0 0' }}>{monthLabel} performance by bin type — click column headers to sort — all figures ex GST</p>
      </div>

      {/* Feb KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Revenue', v: fmtFull(curMonthRev) },
          { l: 'Direct Costs', v: fmtFull(curMonthCOS), note: monthIndex >= 7 ? '⚠️ May be incomplete' : '' },
          { l: 'Overheads', v: fmtFull(curMonthOpex) },
          { l: 'GM%', v: curMonthGM.toFixed(1) + '%' },
          { l: 'Jobs', v: curMonthJobs.toString() },
        ].map((k, i) => (
          <div key={i} style={{ background: B.cardBg, border: '1px solid ' + B.cardBorder, borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: B.textMuted, textTransform: 'uppercase' }}>{k.l}</div>
            <div style={{ fontFamily: fontHead, fontSize: 20, color: B.textPrimary, fontWeight: 700, marginTop: 4 }}>{k.v}</div>
            {k.note && <div style={{ fontSize: 9, color: B.amber, marginTop: 2 }}>{k.note}</div>}
          </div>
        ))}
      </div>

      {/* Pricing Table — Feb numbers only */}
      <div style={{ background: B.cardBg, border: '1px solid ' + B.cardBorder, borderRadius: 10, overflow: isMobile ? 'auto' : 'hidden', marginBottom: 20, ...(isMobile && { overflowX: 'auto' }) }}>
      <div style={{ minWidth: isMobile ? 600 : 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.9fr 0.9fr 0.9fr 0.9fr 0.7fr 1fr', padding: '10px 16px', background: B.bg, borderBottom: '2px solid ' + B.cardBorder }}>
          {hdrs.map((h, i) => (
            <div key={i} onClick={() => handleSort(h.key)} style={{ fontSize: 9, fontWeight: 700, color: sortCol === h.key ? B.yellow : B.textPrimary, fontFamily: fontHead, textTransform: 'uppercase', textAlign: h.align, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: h.align === 'left' ? 'flex-start' : 'flex-end', gap: 3 }}>
              {h.label}
              {sortCol === h.key && <span style={{ fontSize: 8 }}>{sortAsc ? '▲' : '▼'}</span>}
            </div>
          ))}
        </div>

        {sortedData.map((d, i) => {
          const isExp = expanded === d.type;
          const npColor = d.feb.np < -10 ? B.red : d.feb.np < 0 ? B.orange : d.feb.np < 5 ? B.amber : B.green;

          return (
            <div key={i}>
              <div onClick={() => setExpanded(isExp ? null : d.type)} style={{
                display: 'grid', gridTemplateColumns: '2fr 0.9fr 0.9fr 0.9fr 0.9fr 0.7fr 1fr', padding: '10px 16px',
                cursor: 'pointer', borderBottom: '1px solid ' + B.cardBorder, background: isExp ? B.bg : (d.feb.np < -10 ? B.red + '06' : B.cardBg), transition: 'background 0.15s'
              }} onMouseOver={e => { if (!isExp) e.currentTarget.style.background = B.bg }} onMouseOut={e => { if (!isExp) e.currentTarget.style.background = d.feb.np < -10 ? B.red + '06' : B.cardBg }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: B.textMuted, transform: isExp ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>{'▶'}</span>
                  {d.type}
                </div>
                <div style={{ fontSize: 12, textAlign: 'right' }}>{fmtFull(d.feb.rev)}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: B.red }}>{fmtFull(d.feb.directCost)}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: B.amber }}>{fmtFull(d.feb.overhead)}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: d.feb.profit < 0 ? B.red : B.green, fontWeight: 600 }}>{fmtFull(d.feb.profit)}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: npColor, fontWeight: 700 }}>{d.feb.np.toFixed(1)}%</div>
                <div style={{ fontSize: 12, textAlign: 'right' }}>
                  <span style={{ fontWeight: 600, color: B.textPrimary }}>{d.feb.jobs}</span>
                  <span style={{ color: B.textMuted, fontSize: 10 }}> / {d.avg.jobs.toFixed(0)}</span>
                  {d.avg.jobs > 0 && <span style={{ fontSize: 10, marginLeft: 4, color: d.feb.jobs > d.avg.jobs ? B.green : d.feb.jobs < d.avg.jobs ? B.red : B.textMuted }}>{d.feb.jobs > d.avg.jobs ? '↑' : d.feb.jobs < d.avg.jobs ? '↓' : ''}</span>}
                </div>
              </div>

              {/* ===== EXPANDED DRILL-DOWN: Feb vs YTD Monthly Avg ===== */}
              {isExp && (
                <div style={{ background: B.bg, padding: '20px 24px', borderBottom: '2px solid ' + npColor + '44' }}>
                  <div style={{ fontFamily: fontHead, fontSize: 13, color: npColor, fontWeight: 700, textTransform: 'uppercase', marginBottom: 16 }}>
                    {d.type} — {monthLabel} vs Monthly Average
                  </div>

                  {/* Head-to-head comparison table */}
                  <div style={{ background: B.cardBg, borderRadius: 10, border: '1px solid ' + B.cardBorder, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 16px', background: B.bg, borderBottom: '1px solid ' + B.cardBorder }}>
                      {['', monthLabel, 'Monthly Avg', 'Change'].map((h, hi) => (
                        <div key={hi} style={{ fontSize: 10, fontWeight: 700, color: B.textPrimary, fontFamily: fontHead, textTransform: 'uppercase', textAlign: hi === 0 ? 'left' : 'right' }}>{h}</div>
                      ))}
                    </div>
                    {[
                      { l: 'Revenue', f: d.feb.rev, a: d.avg.rev },
                      { l: 'Jobs', f: d.feb.jobs, a: d.avg.jobs, noFmt: true },
                      { l: 'Avg Rate / Job', f: d.feb.avgRate, a: d.avg.avgRate },
                      { l: 'Direct Costs', f: d.feb.directCost, a: d.avg.directCost, invert: true },
                      { l: 'Overheads', f: d.feb.overhead, a: d.avg.overhead, invert: true },
                      { l: 'Profit', f: d.feb.profit, a: d.avg.profit },
                      { l: 'Net Profit %', f: d.feb.np, a: d.avg.np, isPct: true },
                    ].map((row, ri) => {
                      const delta = row.isPct ? (row.f - row.a) : (row.a !== 0 ? ((row.f / row.a) - 1) * 100 : 0);
                      return (
                        <div key={ri} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '6px 16px', borderBottom: '1px solid ' + B.cardBorder + '44' }}>
                          <div style={{ fontSize: 12, color: B.textSecondary, fontWeight: 500 }}>{row.l}</div>
                          <div style={{ fontSize: 12, textAlign: 'right', fontWeight: 600, color: B.textPrimary }}>
                            {row.isPct ? row.f.toFixed(1) + '%' : row.noFmt ? row.f : fmtFull(row.f)}
                          </div>
                          <div style={{ fontSize: 12, textAlign: 'right', color: B.textMuted }}>
                            {row.isPct ? row.a.toFixed(1) + '%' : row.noFmt ? row.a.toFixed(1) : fmtFull(row.a)}
                          </div>
                          <div style={{ textAlign: 'right' }}><Delta val={delta} invert={row.invert} /></div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Per-Job comparison if we have both */}
                  {d.feb.perJob && d.avg.perJob && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: fontHead, fontSize: 11, color: B.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Per-Job Breakdown</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {/* Feb per-job */}
                        <div style={{ background: B.cardBg, borderRadius: 8, padding: 12, border: '1px solid ' + B.cardBorder }}>
                          <div style={{ fontFamily: fontHead, fontSize: 10, color: B.yellow, textTransform: 'uppercase', marginBottom: 8 }}>{monthLabel} / Job</div>
                          {[{ l: 'Revenue', v: d.feb.perJob.revenue }, { l: 'Direct Costs', v: d.feb.perJob.directCost }, { l: 'Overheads', v: d.feb.perJob.overhead }].map((r, j) => (
                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid ' + B.cardBorder + '44' }}>
                              <span style={{ fontSize: 11, color: B.textSecondary }}>{r.l}</span>
                              <span style={{ fontSize: 11, fontWeight: 600 }}>{fmtFull(r.v)} <span style={{ color: B.textMuted, fontSize: 10 }}>({(r.v / d.feb.perJob.revenue * 100).toFixed(0)}%)</span></span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontWeight: 700, marginTop: 4 }}>
                            <span style={{ fontSize: 12 }}>Profit / Job</span>
                            <span style={{ fontSize: 12, color: d.feb.perJob.profit < 0 ? B.red : B.green }}>{fmtFull(d.feb.perJob.profit)}</span>
                          </div>
                        </div>
                        {/* Avg per-job */}
                        <div style={{ background: B.cardBg, borderRadius: 8, padding: 12, border: '1px solid ' + B.cardBorder }}>
                          <div style={{ fontFamily: fontHead, fontSize: 10, color: B.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Monthly Avg / Job</div>
                          {[{ l: 'Revenue', v: d.avg.perJob.revenue }, { l: 'Direct Costs', v: d.avg.perJob.directCost }, { l: 'Overheads', v: d.avg.perJob.overhead }].map((r, j) => (
                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid ' + B.cardBorder + '44' }}>
                              <span style={{ fontSize: 11, color: B.textSecondary }}>{r.l}</span>
                              <span style={{ fontSize: 11, fontWeight: 600 }}>{fmtFull(r.v)} <span style={{ color: B.textMuted, fontSize: 10 }}>({(r.v / d.avg.perJob.revenue * 100).toFixed(0)}%)</span></span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontWeight: 700, marginTop: 4 }}>
                            <span style={{ fontSize: 12 }}>Profit / Job</span>
                            <span style={{ fontSize: 12, color: d.avg.perJob.profit < 0 ? B.red : B.green }}>{fmtFull(d.avg.perJob.profit)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cost % bar with YTD avg marker */}
                  {d.feb.perJob && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: B.textMuted, marginBottom: 6 }}>{monthLabel} revenue allocation per job:</div>
                      {(() => {
                        const pj = d.feb.perJob;
                        const total = pj.revenue;
                        if (total <= 0) return null;
                        const segs = [
                          { label: 'Direct', amount: pj.directCost, color: B.red },
                          { label: 'OH', amount: pj.overhead, color: B.amber },
                          { label: pj.profit >= 0 ? 'Profit' : 'Loss', amount: Math.abs(pj.profit), color: pj.profit >= 0 ? B.green : '#8B6080' },
                        ].map(s => ({ ...s, pct: (s.amount / total) * 100 }));

                        // YTD avg cost % marker
                        const avgCostPct = d.avg.perJob ? ((d.avg.perJob.directCost + d.avg.perJob.overhead) / d.avg.perJob.revenue * 100) : null;

                        return (<>
                          <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', height: 32, borderRadius: 4, overflow: 'hidden', width: '100%' }}>
                              {segs.map((s, j) => (
                                <div key={j} style={{ width: s.pct + '%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label} {s.pct.toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                            {avgCostPct !== null && (
                              <div style={{ position: 'absolute', left: avgCostPct + '%', top: -6, bottom: -6 }}>
                                <div style={{ width: 2, height: 44, background: B.yellow, position: 'relative' }}>
                                  <div style={{ position: 'absolute', top: -14, left: -20, fontSize: 8, color: B.yellow, fontWeight: 700, whiteSpace: 'nowrap' }}>Avg {avgCostPct.toFixed(0)}%</div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 14, marginTop: 8, alignItems: 'center' }}>
                            {segs.map((s, j) => (
                              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                                <span style={{ fontSize: 10, color: B.textMuted }}>{s.label} ({fmtFull(s.amount)})</span>
                              </div>
                            ))}
                            {avgCostPct !== null && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                                <div style={{ width: 12, height: 2, background: B.yellow }} />
                                <span style={{ fontSize: 10, color: B.yellow, fontWeight: 600 }}>Prior months avg cost line</span>
                              </div>
                            )}
                          </div>
                        </>);
                      })()}
                    </div>
                  )}

                  {/* Market context */}
                  {d.market && (
                    <div style={{ background: B.cardBg, border: '1px solid ' + B.cardBorder, borderRadius: 6, padding: 10, marginBottom: 16, fontSize: 11 }}>
                      <strong>Market Position:</strong> Your rate ${d.feb.avgRate || d.ytdAlloc.avgRate} vs market range {d.market.label}.
                      {d.marketPosition === 'above' && <span style={{ color: B.red }}> You are ABOVE market — price increases carry high risk of losing volume.</span>}
                      {d.marketPosition === 'within' && <span style={{ color: B.textSecondary }}> Within range — room for modest adjustment.</span>}
                      {d.marketPosition === 'below' && <span style={{ color: B.green }}> BELOW market — strong case for price increase.</span>}
                    </div>
                  )}

                  {/* Break-even for unprofitable */}
                  {d.feb.perJob && d.feb.perJob.profit < 0 && (
                    <div style={{ background: B.cardBg, border: '1px solid ' + B.yellow, borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, color: B.textPrimary, fontWeight: 600 }}>Break-Even Analysis</div>
                      <div style={{ fontSize: 12, color: B.textSecondary, marginTop: 4 }}>
                        Charging <strong>{fmtFull(d.feb.perJob.revenue)}</strong>/job. Break-even needs <strong>{fmtFull(d.feb.perJob.totalCost)}</strong>/job.
                        Shortfall: <strong style={{ color: B.red }}>{fmtFull(d.feb.perJob.totalCost - d.feb.perJob.revenue)}</strong>/job
                        {' × '}{d.feb.jobs} jobs = <strong style={{ color: B.red }}>{fmtFull(Math.abs(d.feb.profit))}</strong> monthly loss.
                      </div>
                      {d.market && d.marketPosition === 'above' && (
                        <div style={{ fontSize: 11, color: B.red, marginTop: 4, fontWeight: 600 }}>
                          Already above market ({d.market.label}). Must reduce costs, not raise prices.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Sum totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.9fr 0.9fr 0.9fr 0.9fr 0.7fr 1fr', padding: '10px 16px', background: B.bg, borderTop: '2px solid ' + B.yellow + '44' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.textPrimary }}>TOTAL</div>
          <div style={{ fontSize: 12, textAlign: 'right', fontWeight: 700 }}>{fmtFull(typeData.reduce((s, d) => s + d.feb.rev, 0))}</div>
          <div style={{ fontSize: 12, textAlign: 'right', fontWeight: 700, color: B.red }}>{fmtFull(typeData.reduce((s, d) => s + d.feb.directCost, 0))}</div>
          <div style={{ fontSize: 12, textAlign: 'right', fontWeight: 700, color: B.amber }}>{fmtFull(typeData.reduce((s, d) => s + d.feb.overhead, 0))}</div>
          <div style={{ fontSize: 12, textAlign: 'right', fontWeight: 700, color: typeData.reduce((s, d) => s + d.feb.profit, 0) < 0 ? B.red : B.green }}>{fmtFull(typeData.reduce((s, d) => s + d.feb.profit, 0))}</div>
          <div></div>
          <div style={{ fontSize: 12, textAlign: 'right', fontWeight: 700 }}>{curMonthJobs}</div>
        </div>
      </div>{/* close minWidth div */}
      </div>{/* close table container */}

      {/* AI Pricing Recommendations */}
      {suggestions.length > 0 && (
        <div style={{ background: B.cardBg, border: '1px solid ' + B.cardBorder, borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, color: B.yellow, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
            Pricing Recommendations (with Market Context)
          </div>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < suggestions.length - 1 ? '1px solid ' + B.cardBorder : 'none' }}>
              <span style={{ fontSize: 14, lineHeight: '1.4' }}>{s.sev === 'critical' ? '🔴' : s.sev === 'warning' ? '🟡' : '🟢'}</span>
              <div style={{ fontSize: 12, color: B.textSecondary, lineHeight: 1.5 }}>{s.text}</div>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 10, color: B.textMuted, fontStyle: 'italic' }}>
            Market rates from competitor websites/industry guides. Monthly avg excludes current month to show if selected month is improving or worsening vs trend.
          </div>
        </div>
      )}
    </div>
  );
}
