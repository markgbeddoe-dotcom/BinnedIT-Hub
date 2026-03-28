import React from 'react';
import { B, fontHead } from '../theme';

export const KPITile = ({label,value,sub,trend,status,large}) => {
  const sc = status==='green'?B.green:status==='red'?B.red:status==='amber'?B.amber:B.yellow;
  return (
    <div style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:10,padding:large?'18px 22px':'14px 18px',position:'relative',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
      <div style={{position:'absolute',top:0,left:0,width:4,bottom:0,background:sc}} />
      <div style={{paddingLeft:8}}>
        <div style={{fontSize:11,fontWeight:600,color:B.textMuted,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>{label}</div>
        <div style={{fontSize:large?30:24,fontWeight:800,color:B.textPrimary,lineHeight:1.1,fontFamily:fontHead}}>{value}</div>
        {sub && <div style={{fontSize:12,color:B.textSecondary,marginTop:4}}>{sub}</div>}
        {trend!==undefined && <div style={{fontSize:12,color:trend>0?B.green:B.red,marginTop:4,fontWeight:700}}>{trend>0?'▲':'▼'} {Math.abs(trend)}% vs prior</div>}
      </div>
    </div>
  );
};

export const SectionHeader = ({title,subtitle}) => (
  <div style={{marginBottom:18,marginTop:4}}>
    <h2 style={{fontSize:20,fontWeight:800,color:B.textPrimary,margin:0,fontFamily:fontHead,textTransform:'uppercase',letterSpacing:'0.04em'}}>{title}</h2>
    {subtitle && <p style={{fontSize:13,color:B.textSecondary,margin:'4px 0 0'}}>{subtitle}</p>}
  </div>
);

export const ChartCard = ({title,children}) => (
  <div style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
    <div style={{fontSize:13,fontWeight:700,color:B.textPrimary,marginBottom:12,textTransform:'uppercase',letterSpacing:'0.03em'}}>{title}</div>
    {children}
  </div>
);

export const AlertItem = ({severity,text}) => {
  const c = severity==='critical'?B.red:severity==='warning'?B.amber:severity==='info'?B.blue:B.green;
  const label = severity==='critical'?'CRITICAL':severity==='warning'?'WARNING':severity==='info'?'INFO':'POSITIVE';
  return (
    <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 0',borderBottom:`1px solid ${B.cardBorder}`}}>
      <span style={{fontSize:10,fontWeight:800,color:c,background:`${c}15`,padding:'2px 8px',borderRadius:4,flexShrink:0,fontFamily:fontHead}}>{label}</span>
      <span style={{fontSize:12,color:B.textSecondary,lineHeight:1.5}}>{text}</span>
    </div>
  );
};

export const LoadingSkeleton = ({ height = 200, message = 'Loading data…' }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height, background:'#1a1a1a', borderRadius:8, color:'#666', fontSize:14 }}>
    {message}
  </div>
)

export const CustomTooltip = ({active,payload,label,formatter}) => {
  if (!active||!payload||!payload.length) return null;
  return (
    <div style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:8,padding:'10px 14px',fontSize:12,boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
      <div style={{color:B.textPrimary,fontWeight:700,marginBottom:6}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:B.textPrimary,padding:'2px 0',display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:p.color||B.yellow,display:'inline-block',flexShrink:0}} />
          <span style={{color:B.textSecondary}}>{p.name}:</span>
          <span style={{fontWeight:600}}>{formatter?formatter(p.value,p.name):p.value}</span>
        </div>
      ))}
    </div>
  );
};
