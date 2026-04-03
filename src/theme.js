// SkipSync brand — dark operations-first layout
export const B = {
  bg:'#F2F6F4',           // off-white page background
  cardBg:'#FFFFFF',
  cardBgHover:'#F8FAF9',
  cardBorder:'#D8DDD9',
  headerBg:'#000006',     // industrial black (headers, sidebar, nav)
  slateBg:'#1A1A2E',      // slate (secondary backgrounds)
  yellow:'#EFDF0F',       // primary yellow (CTAs, highlights, active states)
  yellowDark:'#C8BB00',
  yellowLight:'#FFFDE0',
  white:'#FFFFFF',
  black:'#000006',
  textPrimary:'#000006',
  textSecondary:'#3D3D4F',
  textMuted:'#6B7280',
  green:'#27AE60',        // success
  red:'#E74C3C',          // alert
  amber:'#F39C12',        // warning orange
  orange:'#F39C12',
  blue:'#2E86DE',         // info
  purple:'#8B6EB5',
  cyan:'#1ABC9C',
  teal:'#16A085',
};
export const fontHead = '"Oswald",system-ui,sans-serif';
export const fontBody = '"DM Sans",system-ui,sans-serif';
export const catColors = {"General Waste":'#2E86DE',"Asbestos":'#E74C3C',"Soil":'#F39C12',"Green Waste":'#27AE60',"Other":'#8B6EB5'};
export const fmt = v => Math.abs(v)>=1e6?`$${(v/1e6).toFixed(1)}M`:Math.abs(v)>=1e3?`$${(v/1e3).toFixed(0)}k`:`$${v.toFixed(0)}`;
export const fmtFull = v => { const n = Math.round(v); return n < 0 ? `-$${Math.abs(n).toLocaleString('en-AU')}` : `$${n.toLocaleString('en-AU')}`; };
export const fmtPct = v => `${v.toFixed(1)}%`;
