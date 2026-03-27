// Work Plan — intelligently prioritised actions
// Priority: Grow & Compete → Cash → Revenue Protection → Compliance → Data → Systems → Strategy

export const defaultWorkPlan = {
  thisWeek: [
    { id:1, action:"First competitive pricing benchmark — call Rhino, All Over, Big Bin for 4m/6m/12m rates", owner:"Mark", why:"Can't optimise pricing without market data. Competitors may be cheaper or more expensive.", effort:"1 hour", area:"Competitors" },
    { id:2, action:"Reprice 4m³ General Waste — currently losing 9.2% on 188 jobs YTD", owner:"Mark", why:"$50 increase × 188 jobs = ~$9,400 annual profit improvement. Highest impact quick win.", effort:"30 min", area:"Pricing" },
    { id:3, action:"Reprice 8m³ Soil — worst performer at -17.1% net margin on 73 jobs", owner:"Mark", why:"Losing ~$6,300 on this product YTD. Second-worst performer by margin.", effort:"30 min", area:"Pricing" },
    { id:4, action:"Chase Feb debtors — $63,726 gap between invoiced and cash received", owner:"Mark / Admin", why:"Largest cash gap in 8 months. Cash balance will decline if not addressed.", effort:"2 hours", area:"Cash Flow" },
    { id:5, action:"Chase REMEED SOLUTIONS — $20,935 outstanding (largest debtor)", owner:"Mark / Admin", why:"Single largest debtor. Concentration risk — 14% of total AR.", effort:"1 phone call", area:"Debtors" },
    { id:6, action:"Confirm ATO payment plan status for $540k GST/PAYG liability", owner:"Accountant", why:"ATO can issue garnishee notices. Director personal liability.", effort:"1 phone call", area:"Cash Flow" },
    { id:7, action:"Post missing Feb COS invoices — $10,757 vs ~$54,000 expected", owner:"Bookkeeper", why:"Dashboard margins are wrong until this is fixed.", effort:"2 hours", area:"Margins" },
  ],
  thisMonth: [
    { id:8, action:"Post missing fuel invoices (Jan $651, Feb $165 vs $10k avg)", owner:"Bookkeeper", why:"Fuel is a major cost line showing near-zero.", effort:"30 min", area:"Margins" },
    { id:9, action:"Post Feb rent ($0 vs $4,667/month)", owner:"Bookkeeper", why:"Distorts opex figures. Quick fix.", effort:"5 min", area:"Margins" },
    { id:10, action:"Implement WHS incident register", owner:"Mark", why:"Director personal liability under WHS Act. Zero documentation = maximum exposure.", effort:"30 min", area:"Risk/EPA" },
    { id:11, action:"Review 10m³ Asbestos pricing — negative gross margin", owner:"Mark", why:"Only product where disposal costs exceed the charge rate.", effort:"Review", area:"Pricing" },
    { id:12, action:"Call top 3 dormant accounts: Salvage ($2,134), KDK ($1,804), Multimode ($1,770)", owner:"Mark / BDM", why:"Combined $5,708 YTD revenue at risk. A phone call might reactivate them.", effort:"3 calls", area:"BDM" },
    { id:13, action:"Follow up SALT PROJECTS — 4 jobs in first month, potential key account", owner:"Mark", why:"New high-volume customer. Early relationship building = retention.", effort:"1 call", area:"BDM" },
    { id:14, action:"Set up asbestos documentation tracking system", owner:"Mark", why:"Regulatory exposure on every asbestos job. Documentation must be 100%.", effort:"Half day", area:"Risk/EPA" },
    { id:15, action:"Create training currency matrix for all staff", owner:"Mark", why:"Regulated waste handlers need verified, current certifications.", effort:"Half day", area:"Risk/EPA" },
  ],
  thisQuarter: [
    { id:16, action:"Full pricing review across all 18 bin types", owner:"Mark", why:"11 of 18 bin types unprofitable after full cost allocation. Systemic pricing problem.", effort:"Full day", area:"Pricing" },
    { id:17, action:"Customer retention strategy — 18 dormant vs 9 new (net decline)", owner:"Mark / BDM", why:"Losing more customers than gaining. Need proactive re-engagement.", effort:"Project", area:"BDM" },
    { id:18, action:"Review $108k annual debt service vs cash generation", owner:"Mark / Accountant", why:"$9k/month in loan payments before any profit. Explore refinancing.", effort:"Meeting", area:"Cash Flow" },
    { id:19, action:"Investigate FY2025 data import for year-on-year comparison", owner:"Mark", why:"Enables trend analysis and seasonal pattern recognition.", effort:"2 hours", area:"Strategy" },
    { id:20, action:"Review balance sheet structure — negative equity, high tax liabilities", owner:"Mark / Accountant", why:"Business is technically insolvent on paper. Need plan to rebuild.", effort:"Meeting", area:"Cash Flow" },
  ],
};
