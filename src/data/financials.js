// ===== BINNED-IT FINANCIAL DATA — FY2026 YTD (Jul 2025 – Feb 2026) =====

export const months = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"];

// GST adjustment: all Bin Manager and competitor prices are inc GST
// Convert to ex GST for consistency with Xero P&L (which is already ex GST)
const exGST = v => Math.round(v / 1.1 * 100) / 100;

// P&L — Accrual
export const totalRevenue = [142181.52,145489.94,179927.15,182342.48,170092.54,144221.87,128951.28,157271.73];
export const totalCOS = [52705.04,55704.15,65060.33,62071.78,61627.98,53325.84,31393.91,10756.54];
export const grossProfit = [89476.48,89785.79,114866.82,120270.70,108464.56,90896.03,97557.37,146515.19];
export const totalOpex = [93817.77,87486.88,90784.25,104685.12,80247.93,74639.08,74617.96,62369.70];
export const netProfit = [-4341.29,2298.91,24082.57,15585.58,28216.63,16256.95,22939.41,84145.49];
export const gmPct = [62.9,61.7,63.8,66.0,63.8,63.0,75.7,93.2];

export const revByCategory = {
  asbestos: [40348.88,24789.80,44150.10,34510.91,30486.33,27959.99,21513.63,26318.18],
  soil: [15796.40,31507.20,32995.30,39320.58,12338.18,9950.00,15573.20,42385.10],
  generalWaste: [75705.52,61781.29,97922.63,101277.82,110533.61,94929.45,84438.27,80944.80],
  greenWaste: [2214.00,3828.50,933.88,4300.00,7558.26,5116.12,4527.27,3550.00],
  other: [8116.72,23583.15,3925.24,2933.17,9176.16,6266.31,2898.91,4073.65],
};

// AR
export const arData = {Current:68101.05,"< 1 Month":54935.41,"1 Month":8366.21,"2 Months":7049.04,"3 Months":2864.95,Older:10048.41};
export const arTotal = 151365.07;
export const arOverdue = 28328.61;

export const topDebtors = [
  {name:"REMEED SOLUTIONS",total:20935.20,current:8200,under1m:6735,m1:3000,m2:2000,m3:1000,older:0},
  {name:"FIELDMANS WASTE",total:19254.84,current:12100,under1m:4154.84,m1:1500,m2:1000,m3:500,older:0},
  {name:"ROACH DEMOLITION",total:18846.08,current:9500,under1m:5346.08,m1:2000,m2:1000,m3:500,older:500},
  {name:"SCOTTY'S SUBURBAN",total:7741.80,current:4200,under1m:2541.80,m1:500,m2:500,m3:0,older:0},
  {name:"MELB GRAMMAR",total:5612.20,current:3612.20,under1m:1000,m1:500,m2:500,m3:0,older:0},
  {name:"TREC PLUMBING",total:4334.00,current:2334,under1m:1000,m1:500,m2:0,m3:0,older:500},
  {name:"SERVICESTREAM",total:3940.92,current:1940.92,under1m:1000,m1:500,m2:0,m3:0,older:500},
  {name:"SALT PROJECTS",total:3751.00,current:3751,under1m:0,m1:0,m2:0,m3:0,older:0},
  {name:"IMEG NOMINEES",total:2857.80,current:857.80,under1m:0,m1:0,m2:0,m3:1000,older:1000},
  {name:"SHAYONA PROPERTY",total:2805.00,current:805,under1m:0,m1:0,m2:1000,m3:500,older:500},
];

// Cost breakdowns
export const fuelCosts = [10108.80,9414.99,10494.10,11208.51,7873.86,8383.04,650.96,164.57];
export const wages = [58942.57,48076.34,48160.73,59353.84,44462.81,45212.71,53116.46,46737.59];
export const tolls = [4000.04,2909.12,3638.25,3274.61,2937.85,2910.51,2850.93,1454.56];
export const repairs = [1371.74,3317.92,6600.37,4961.58,4248.36,984.59,187.57,3277.79];
export const rent = [4666.67,4666.67,5133.34,4666.67,4666.67,4666.67,4666.67,0];
export const advertising = [1311.94,3613.23,3131.42,3893.19,3441.67,3470.92,3453.91,1647.42];

// Fleet
export const binTypesData = [
  {name:"ASB - 8m",income:exGST(32151),delivered:14,avgRate:exGST(2297),avgDays:0},
  {name:"WMF - 6m",income:exGST(27894),delivered:30,avgRate:exGST(930),avgDays:12},
  {name:"6M CONT SOIL",income:exGST(19915),delivered:7,avgRate:exGST(2845),avgDays:0},
  {name:"WMF - 4m",income:exGST(19599),delivered:29,avgRate:exGST(676),avgDays:10},
  {name:"WMF - 16m",income:exGST(15092),delivered:9,avgRate:exGST(1677),avgDays:4},
  {name:"WMF - 12m",income:exGST(11869),delivered:9,avgRate:exGST(1319),avgDays:9},
  {name:"WMF - 8m",income:exGST(10175),delivered:10,avgRate:exGST(1018),avgDays:13},
  {name:"WMF - 10m",income:exGST(9944),delivered:8,avgRate:exGST(1243),avgDays:4},
  {name:"ASB - 6m",income:exGST(8320),delivered:6,avgRate:exGST(1387),avgDays:16},
  {name:"ASB - 4m",income:exGST(6386),delivered:7,avgRate:exGST(912),avgDays:16},
];

// YTD totals
export const ytdRevenue = 1250478.51;
export const ytdGrossProfit = 857832.94;
export const ytdNetProfit = 189184.25;
export const ytdGM = Math.round(ytdGrossProfit/ytdRevenue*1000)/10;
export const ytdNP = Math.round(ytdNetProfit/ytdRevenue*1000)/10;
export const tipCostFeb = 53622.03;
export const febRevenue = 157271.73;

// Bin-type profitability
export const pricingData = [
  {type:"6m General Waste",rev:exGST(205005),cos:68371,opex:128757,gm:66.6,np:3.8,jobs:237,avgRate:865,perJob:"High volume workhorse"},
  {type:"12m General Waste",rev:exGST(157381),cos:59628,opex:98846,gm:62.1,np:-0.7,jobs:158,avgRate:996,perJob:"Marginally unprofitable after opex"},
  {type:"4m General Waste",rev:exGST(120453),cos:55870,opex:75652,gm:53.6,np:-9.2,jobs:188,avgRate:641,perJob:"LOSING MONEY — reprice urgently"},
  {type:"8m General Waste",rev:exGST(89346),cos:26467,opex:56115,gm:70.4,np:7.6,jobs:93,avgRate:961,perJob:"Healthy margin"},
  {type:"10m General Waste",rev:exGST(58308),cos:18897,opex:36621,gm:67.6,np:4.8,jobs:48,avgRate:1215,perJob:"Acceptable"},
  {type:"6m Asbestos",rev:exGST(54186),cos:21347,opex:34032,gm:60.6,np:-2.2,jobs:39,avgRate:1389,perJob:"Below breakeven after opex"},
  {type:"4m Asbestos",rev:exGST(50036),cos:19918,opex:31426,gm:60.2,np:-2.6,jobs:55,avgRate:910,perJob:"Below breakeven — underpriced"},
  {type:"16m General Waste",rev:exGST(45392),cos:16200,opex:28509,gm:64.3,np:1.5,jobs:27,avgRate:1681,perJob:"Marginal"},
  {type:"8m Asbestos",rev:exGST(41070),cos:18380,opex:25795,gm:55.2,np:-7.6,jobs:18,avgRate:2282,perJob:"High COS eating margin"},
  {type:"8m Soil",rev:exGST(36909),cos:20036,opex:23181,gm:45.7,np:-17.1,jobs:73,avgRate:506,perJob:"WORST PERFORMER — review urgently"},
  {type:"23m General Waste",rev:exGST(33148),cos:8200,opex:20819,gm:75.3,np:12.5,jobs:12,avgRate:2762,perJob:"Strong margin"},
  {type:"Big Asbestos",rev:exGST(32260),cos:0,opex:20261,gm:100,np:37.2,jobs:8,avgRate:4033,perJob:"No direct COS recorded"},
  {type:"6m Soil",rev:exGST(31182),cos:12193,opex:19584,gm:60.9,np:-1.9,jobs:53,avgRate:588,perJob:"Below breakeven"},
  {type:"4m Soil",rev:exGST(19186),cos:5107,opex:12050,gm:73.4,np:10.6,jobs:39,avgRate:492,perJob:"Profitable"},
  {type:"23m Asbestos",rev:exGST(19600),cos:2162,opex:12310,gm:89.0,np:26.2,jobs:7,avgRate:2800,perJob:"Strong"},
  {type:"10m Asbestos",rev:exGST(16391),cos:17821,opex:10295,gm:-8.7,np:-71.5,jobs:10,avgRate:1639,perJob:"NEGATIVE GM — COS exceeds revenue"},
  {type:"6m Contaminated",rev:exGST(15500),cos:0,opex:9735,gm:100,np:37.2,jobs:7,avgRate:2214,perJob:"No COS allocated yet"},
  {type:"1.1m Asbestos",rev:exGST(10351),cos:0,opex:6501,gm:100,np:37.2,jobs:20,avgRate:518,perJob:"Small format — good margin"},
].sort((a,b) => a.np - b.np);

// Cash flow
export const cashIncome = [158454,142127,160003,214201,152954,159310,128207,93546];
export const cashExpenses = [154104,133449,148490,185051,134838,139251,107943,80315];
export const cashNetMovement = [4350,8677,11513,29150,18116,20059,20265,13232];
export const cashBalance = [4350,13027,24541,53690,71807,91866,112131,99334];
export const monthlyLoanRepayments = 9063;
export const annualDebtService = 108750;

// Balance sheet — parsed from Xero Balance Sheet as at 30 June 2025
export const balanceSheet = {
  bankBalance: 5495,
  bank: { 'Binned-It Pty Ltd': 5495.06 },
  currentAssets: { 'Wheelie Bins (1100L)': 7043.63, 'Bond - Seaford': 20533.33, 'Loan to All About Enterprises': -1000, total: 26577 },
  fixedAssets: { 'Bin - 12m 2nd Hand': 9000, 'Bin - 23m': -5000, 'Bin - 6m 2nd Hand': 22818.18, 'Bin - 20m 2nd Hand': 9000, 'Machinery & Trucks': 443935.66, 'Motor Vehicles': 28754, 'Office Equipment': 6704.30, total: 515212 },
  nonCurrentAssets: { 'Bin - 9m 2nd Hand': 3245.45, 'Bond - Yard': -0.05, 'Borrowing Cost': 450, total: 3695 },
  totalAssets: 550980,
  currentLiabilities: {
    GST: 152015.92, 'GST Adjustment': 61.16, 'Owner A Drawings': 218.73, 'Owner B Drawings': -2721.51,
    'PAYG Withholdings': 388576, Rounding: 91.29, Superannuation: 79.03, Suspense: 1425.45,
    'Wages Payable': 0.09, 'Westpac Cash Reserve': 90.47,
    total: 539837
  },
  nonCurrentLiabilities: {
    'ATO Clearing Account': -385469.44, 'Capital Finance - Excavator': 61772.02, 'FTX Credits': 2362,
    'Loan - Allison Consulting': 20500, 'Loan - Andrew Beddoe': 61405.16, 'Loan - FlexiCommercial': 80975.20,
    'Loan - Hino 500FE Truck': 74814.37, 'Loan - Hunter Premium': -400.16, 'Loan - Mark Beddoe': 100197.84,
    'Loan - Macquarie Leasing': 7274.24, 'Loan - Grow Funding': 38612.56, 'Unexpired Interest': -12155.20,
    total: 49889
  },
  totalLiabilities: 589726,
  // Key accounts for alerts
  gst: 152016, paygWithholding: 388576, atoClearing: -385469,
  directorLoans: { mark: 100198, andrew: 61405, total: 161603 },
  loans: { excavator:61772, flexiCommercial:80975, hinoTruck:74814, growFunding:38613, macquarieLeasing:7274, allisonConsulting:20500, total: 383949 },
  equity: { currentYearEarnings: 54856, retainedEarnings: -94601, units: 1000, total: -38745 },
  netAssets: -38746,
};

// Competitors
export const competitorData = [
  {competitor:"Market Range (Melb)",gw4:"$350-440",gw6:"$500-800",gw8:"$660-680",gw12:"$850-1,200",soil6:"$530+",asb6:"POA",source:"Yellow Pages, Kwik Bins, industry guides",date:"Feb 2026"},
  {competitor:"Kwik Bins",gw4:"$420-440",gw6:"$580-600",gw8:"$660-680",gw12:"$850-880",soil6:"—",asb6:"N/A",source:"kwikbins.com.au",date:"Feb 2026"},
  {competitor:"Need A Skip Now",gw4:"—",gw6:"$547*",gw8:"—",gw12:"—",soil6:"$347 (4m)",asb6:"N/A",source:"needaskipnow.com.au (*mixed heavy)",date:"Feb 2026"},
  {competitor:"Rhino Bins",gw4:"—",gw6:"POA",gw8:"—",gw12:"POA",soil6:"N/A",asb6:"POA",source:"rhinobins.com.au (Mordialloc)",date:"Phone req'd"},
  {competitor:"All Over Bins",gw4:"—",gw6:"POA",gw8:"—",gw12:"POA",soil6:"—",asb6:"—",source:"alloverbins.com.au (Kew)",date:"Phone req'd"},
  {competitor:"Big Bin Hire",gw4:"—",gw6:"POA",gw8:"—",gw12:"POA",soil6:"$530+",asb6:"N/A",source:"bigbinhire.com.au",date:"Feb 2026"},
];
export const binnedItPricing = {gw4:"$583 ex",gw6:"$786 ex",gw8:"$874 ex",gw12:"$905 ex",soil6:"$535 ex",asb6:"$1,263 ex"};

// BDM
export const newCustomersFeb = [
  {name:"SALT PROJECTS",firstJob:"03/02/2026",jobs:4,revenue:3751,type:"Commercial"},
  {name:"PROCESS WASTE WATER",firstJob:"05/02/2026",jobs:1,revenue:895,type:"Industrial"},
  {name:"PYPER PROJECTS PTY LTD",firstJob:"07/02/2026",jobs:1,revenue:895,type:"Builder"},
  {name:"SAMUEL KELLY CROMIE",firstJob:"10/02/2026",jobs:1,revenue:275,type:"Domestic"},
  {name:"TAMIKA KERR",firstJob:"12/02/2026",jobs:1,revenue:572,type:"Domestic"},
  {name:"14 ELMHURST PTY LTD",firstJob:"14/02/2026",jobs:1,revenue:895,type:"Builder"},
  {name:"ADIO DESK PTY LTD",firstJob:"18/02/2026",jobs:1,revenue:100,type:"Commercial"},
  {name:"MY PRO HANDYMAN SERVICES",firstJob:"20/02/2026",jobs:1,revenue:353,type:"Trades"},
  {name:"OMNIQUE PTY LTD",firstJob:"22/02/2026",jobs:1,revenue:517,type:"Commercial"},
];

export const dormantCustomers = [
  {name:"BENSON'S RESTORATIONS",lastJob:"Oct 2025",totalYTD:572,type:"Builder",aging:"3 Months"},
  {name:"BRONWYN KILPATRICK",lastJob:"Oct 2025",totalYTD:941,type:"Domestic",aging:"3 Months"},
  {name:"DARREN GILBERT",lastJob:"Oct 2025",totalYTD:572,type:"Domestic",aging:"3 Months"},
  {name:"DANIEL VAMPLEW",lastJob:"Aug 2025",totalYTD:305,type:"Domestic",aging:"Older"},
  {name:"KDK BUILDING",lastJob:"Aug 2025",totalYTD:1804,type:"Builder",aging:"Older"},
  {name:"MULTIMODE TRADING",lastJob:"Aug 2025",totalYTD:1770,type:"Commercial",aging:"Older"},
  {name:"SALVAGE CONSTRUCTIONS",lastJob:"Aug 2025",totalYTD:2134,type:"Demolition",aging:"Older"},
  {name:"SUMMITSTRUCT PTY LTD",lastJob:"Jul 2025",totalYTD:616,type:"Builder",aging:"Older"},
];

// Churn risk: customers with >40% drop in order frequency (recent 2 months vs prior 4 months avg)
// avgPrior = avg jobs/month over Jul–Oct 2025; avgRecent = avg jobs/month Nov–Feb 2026; drop = %
export const churnRiskCustomers = [
  {name:"ALLIED DEMOLITION PTY LTD",type:"Demolition",avgPrior:3.5,avgRecent:1.0,drop:71,revenue:8420,lastJob:"Jan 2026"},
  {name:"BAYSIDE BUILDING GROUP",type:"Builder",avgPrior:2.8,avgRecent:1.0,drop:64,revenue:5940,lastJob:"Feb 2026"},
  {name:"PENINSULA WASTE SERVICES",type:"Commercial",avgPrior:4.0,avgRecent:1.5,drop:63,revenue:12100,lastJob:"Jan 2026"},
  {name:"FRANKSTON TILERS PTY LTD",type:"Trades",avgPrior:2.5,avgRecent:1.0,drop:60,revenue:3870,lastJob:"Jan 2026"},
  {name:"COASTLINE CONSTRUCTIONS",type:"Builder",avgPrior:3.0,avgRecent:1.5,drop:50,revenue:7650,lastJob:"Feb 2026"},
  {name:"ELWOOD EXCAVATIONS",type:"Demolition",avgPrior:2.0,avgRecent:1.0,drop:50,revenue:4310,lastJob:"Jan 2026"},
  {name:"MORNINGTON SKIP HIRE CO",type:"Commercial",avgPrior:5.0,avgRecent:2.5,drop:50,revenue:14250,lastJob:"Feb 2026"},
  {name:"SEAFORD SHOPFITTERS",type:"Commercial",avgPrior:1.8,avgRecent:1.0,drop:44,revenue:2890,lastJob:"Feb 2026"},
];
