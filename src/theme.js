// Binned-IT brand — LIGHT MODE with clean pastel palette
export const B = {
  bg:'#D8D5E0', cardBg:'#FFFFFF', cardBgHover:'#FAFAFA', cardBorder:'#C8C5D0',
  headerBg:'#000000',
  yellow:'#7B8FD4', yellowDark:'#5A6FB5', yellowLight:'#E8ECF8',
  white:'#FFFFFF', black:'#1A1A1A',
  textPrimary:'#2D2640', textSecondary:'#5A5270', textMuted:'#8E87A0',
  green:'#5E9E78', red:'#C96B6B', amber:'#9B8EC9', orange:'#D4839B',
  blue:'#6B8EC9', purple:'#8B6EB5', cyan:'#5EA0A8', teal:'#5E9E8E',
};
export const fontHead = '"Oswald",system-ui,sans-serif';
export const fontBody = '"DM Sans",system-ui,sans-serif';
export const catColors = {"General Waste":'#7B8FD4',"Asbestos":'#D4839B',"Soil":'#9B8EC9',"Green Waste":'#5E9E78',"Other":'#8B6EB5'};
export const fmt = v => Math.abs(v)>=1e6?`$${(v/1e6).toFixed(1)}M`:Math.abs(v)>=1e3?`$${(v/1e3).toFixed(0)}k`:`$${v.toFixed(0)}`;
export const fmtFull = v => { const n = Math.round(v); return n < 0 ? `-$${Math.abs(n).toLocaleString('en-AU')}` : `$${n.toLocaleString('en-AU')}`; };
export const fmtPct = v => `${v.toFixed(1)}%`;
