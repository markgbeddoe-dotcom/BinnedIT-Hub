import React, { useState, useEffect } from 'react';
import { B, fontHead, fmtFull } from '../theme';
import { useCompetitorRates, useUpsertRate, useDeleteRate } from '../hooks/useCompetitors';

const defaultBinServices = [
  '4m³ GW','6m³ GW','8m³ GW','10m³ GW','12m³ GW','16m³ GW','23m³ GW',
  '4m³ Soil','6m³ Soil','8m³ Soil',
  '4m³ Asbestos','6m³ Asbestos','8m³ Asbestos',
  '6m³ Green Waste','8m³ Green Waste',
];

const binnedItRates = {
  '4m³ GW':641,'6m³ GW':865,'8m³ GW':961,'10m³ GW':1215,'12m³ GW':996,'16m³ GW':1681,'23m³ GW':2762,
  '4m³ Soil':492,'6m³ Soil':588,'8m³ Soil':506,
  '4m³ Asbestos':910,'6m³ Asbestos':1389,'8m³ Asbestos':2282,
  '6m³ Green Waste':700,'8m³ Green Waste':850,
};

const seedCompetitors = [
  {id:1,name:'Kwik Bins',source:'kwikbins.com.au',date:'Feb 2026',rates:{'4m³ GW':430,'6m³ GW':590,'8m³ GW':670,'12m³ GW':865}},
  {id:2,name:'Need A Skip Now',source:'needaskipnow.com.au',date:'Feb 2026',rates:{'6m³ GW':547,'4m³ Soil':347}},
  {id:3,name:'Big Bin Hire',source:'bigbinhire.com.au',date:'Feb 2026',rates:{'6m³ Soil':530}},
  {id:4,name:'Rhino Bins',source:'rhinobins.com.au',date:'Phone req\'d',rates:{}},
  {id:5,name:'All Over Bins',source:'alloverbins.com.au',date:'Phone req\'d',rates:{}},
];

const STORAGE_KEY = 'binnedit_competitors';

// Transform flat Supabase rows -> [{id, name, date, rates:{binType: rate}}]
function transformSupabaseRates(rows) {
  const map = {};
  rows.forEach(row => {
    const name = row.competitor_name;
    if (!map[name]) {
      map[name] = {
        id: name,
        name,
        source: row.notes || '',
        date: row.updated_at ? new Date(row.updated_at).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) : 'Unknown',
        rates: {},
        dbRateIds: {},
      };
    }
    if (row.rate !== null && row.rate !== undefined) {
      map[name].rates[row.bin_type] = row.rate;
      map[name].dbRateIds[row.bin_type] = row.id;
    }
  });
  return Object.values(map);
}

export default function CompetitorPage({ onBack }) {
  const { data: supabaseRates, isLoading, isError } = useCompetitorRates();
  const upsertRate = useUpsertRate();
  const deleteRate = useDeleteRate();

  // localStorage fallback state
  const [localCompetitors, setLocalCompetitors] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedCompetitors; } catch { return seedCompetitors; }
  });

  const useSupabase = !isError && supabaseRates && supabaseRates.length > 0;
  const competitors = useSupabase ? transformSupabaseRates(supabaseRates) : localCompetitors;

  useEffect(() => {
    if (!useSupabase) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localCompetitors));
    }
  }, [localCompetitors, useSupabase]);

  const [binServices] = useState(defaultBinServices);
  const [showAddComp, setShowAddComp] = useState(false);
  const [newComp, setNewComp] = useState({name:'',source:'',date:''});
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  const addCompetitor = () => {
    if (!newComp.name.trim()) return;
    if (useSupabase) {
      // In Supabase mode, just add to local list — rates will be stored when cells are edited
      setNewComp({name:'',source:'',date:''}); setShowAddComp(false);
      // We don't create a competitor record directly — just track the name for editing
    } else {
      const id = Math.max(0,...localCompetitors.map(c=>c.id))+1;
      setLocalCompetitors([...localCompetitors,{id,name:newComp.name.trim(),source:newComp.source.trim(),date:newComp.date.trim()||'Not set',rates:{}}]);
      setNewComp({name:'',source:'',date:''}); setShowAddComp(false);
    }
  };

  const removeCompetitor = (comp) => {
    if(!confirm('Remove this competitor and all their rates?')) return;
    if (useSupabase) {
      // Delete all rates for this competitor from Supabase
      const rateIds = Object.values(comp.dbRateIds || {});
      rateIds.forEach(id => deleteRate.mutate({ id }));
    } else {
      setLocalCompetitors(localCompetitors.filter(c=>c.id!==comp.id));
    }
  };

  const startEdit = (compId, service, currentVal) => {
    setEditingCell({compId, service});
    setEditValue(currentVal || '');
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const val = editValue.trim();
    const comp = competitors.find(c => c.id === editingCell.compId || c.name === editingCell.compId);

    if (useSupabase && comp) {
      if (val === '' || val === '0') {
        // Delete the rate
        const rateId = comp.dbRateIds?.[editingCell.service];
        if (rateId) deleteRate.mutate({ id: rateId });
      } else {
        const n = parseFloat(val.replace(/[$,]/g,''));
        const finalVal = !isNaN(n) ? n : null;
        if (finalVal !== null) {
          upsertRate.mutate({
            competitorName: comp.name,
            binType: editingCell.service,
            rate: finalVal,
            notes: comp.source || null,
          });
        }
      }
    } else {
      // localStorage mode
      setLocalCompetitors(localCompetitors.map(c => {
        if (c.id !== editingCell.compId) return c;
        const newRates = {...c.rates};
        if (val === '' || val === '0') {
          delete newRates[editingCell.service];
        } else {
          const n = parseFloat(val.replace(/[$,]/g,''));
          if (!isNaN(n)) newRates[editingCell.service] = n;
          else newRates[editingCell.service] = val;
        }
        return {...c, rates: newRates};
      }));
    }
    setEditingCell(null); setEditValue('');
  };

  const getComparison = (service) => {
    const yours = binnedItRates[service];
    if (!yours) return null;
    const compRates = competitors.map(c => c.rates[service]).filter(r => typeof r === 'number' && r > 0);
    if (!compRates.length) return null;
    const avg = compRates.reduce((a,b) => a + b, 0) / compRates.length;
    return {avg: Math.round(avg), diff: Number(((yours-avg)/avg*100).toFixed(0)), yours};
  };

  const iStyle = {background:B.bg,border:`1px solid ${B.cardBorder}`,borderRadius:6,padding:'8px 12px',fontSize:13,color:B.textPrimary,width:'100%',outline:'none',fontFamily:'"DM Sans",system-ui,sans-serif'};
  const btnS = (c) => ({background:'none',border:`1px solid ${c}`,color:c,padding:'6px 16px',borderRadius:6,cursor:'pointer',fontFamily:fontHead,fontSize:11,fontWeight:600,textTransform:'uppercase'});

  if (isLoading) {
    return (
      <div style={{maxWidth:1200,margin:'0 auto',padding:'20px 24px'}}>
        <div style={{color:B.textMuted,fontSize:13,padding:'40px 0',textAlign:'center'}}>Loading competitor rates...</div>
      </div>
    );
  }

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'20px 24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:B.textPrimary,margin:0,fontFamily:fontHead,textTransform:'uppercase'}}>Competitor Pricing Matrix</h2>
          <p style={{fontSize:13,color:B.textSecondary,margin:'4px 0 0'}}>
            Click any cell to enter or update a rate — {useSupabase ? 'saves to Supabase' : 'saves locally'}
          </p>
        </div>
        <button onClick={onBack} style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,color:B.textPrimary,padding:'8px 20px',borderRadius:6,cursor:'pointer',fontFamily:fontHead,fontSize:12,textTransform:'uppercase'}}>← Back</button>
      </div>

      {isError && (
        <div style={{background:`${B.amber}15`,border:`1px solid ${B.amber}40`,borderRadius:8,padding:'8px 14px',marginBottom:16,fontSize:12,color:B.amber}}>
          Using offline data — Supabase connection issue
        </div>
      )}

      <div style={{display:'flex',gap:10,marginBottom:16}}>
        <button onClick={()=>setShowAddComp(!showAddComp)} style={btnS(B.green)}>+ Add Competitor</button>
        {!useSupabase && (
          <button onClick={()=>{if(confirm('Reset to defaults?')){setLocalCompetitors(seedCompetitors);}}} style={btnS(B.textMuted)}>Reset Defaults</button>
        )}
      </div>

      {showAddComp && (
        <div style={{background:B.cardBg,border:`1px solid ${B.green}44`,borderRadius:10,padding:16,marginBottom:16,display:'flex',gap:10,alignItems:'flex-end'}}>
          <div style={{flex:1}}><label style={{fontSize:10,color:B.textMuted,display:'block',marginBottom:4}}>Competitor Name *</label>
            <input value={newComp.name} onChange={e=>setNewComp(p=>({...p,name:e.target.value}))} placeholder="e.g. Rhino Bins" style={iStyle} /></div>
          <div style={{flex:1}}><label style={{fontSize:10,color:B.textMuted,display:'block',marginBottom:4}}>Source</label>
            <input value={newComp.source} onChange={e=>setNewComp(p=>({...p,source:e.target.value}))} placeholder="e.g. rhinobins.com.au" style={iStyle} /></div>
          <div style={{width:140}}><label style={{fontSize:10,color:B.textMuted,display:'block',marginBottom:4}}>Date</label>
            <input type="date" value={newComp.date} onChange={e=>setNewComp(p=>({...p,date:e.target.value}))} style={iStyle} /></div>
          <button onClick={addCompetitor} style={{...btnS(B.green),padding:'8px 20px',height:38}}>Add</button>
          <button onClick={()=>setShowAddComp(false)} style={{...btnS(B.textMuted),padding:'8px 14px',height:38}}>x</button>
        </div>
      )}

      <div style={{overflowX:'auto',background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:10,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:800}}>
          <thead><tr>
            <th style={{padding:'10px',textAlign:'left',fontFamily:fontHead,fontSize:10,color:B.textPrimary,borderBottom:`2px solid ${B.cardBorder}`,background:B.bg,position:'sticky',left:0,zIndex:2,minWidth:140}}>Service</th>
            <th style={{padding:'10px',textAlign:'center',fontFamily:fontHead,fontSize:10,color:B.yellow,borderBottom:`2px solid ${B.cardBorder}`,background:`${B.yellow}08`,minWidth:90}}>BINNED-IT</th>
            {competitors.map((c,ci)=>(
              <th key={ci} style={{padding:'10px',textAlign:'center',fontFamily:fontHead,fontSize:10,color:B.textPrimary,borderBottom:`2px solid ${B.cardBorder}`,background:B.bg,minWidth:100}}>
                <div>{c.name}</div>
                <div style={{fontSize:8,color:B.textMuted,fontWeight:400}}>{c.date}</div>
              </th>
            ))}
            <th style={{padding:'10px',textAlign:'center',fontFamily:fontHead,fontSize:10,color:B.textPrimary,borderBottom:`2px solid ${B.cardBorder}`,background:B.bg}}>Market Avg</th>
            <th style={{padding:'10px',textAlign:'center',fontFamily:fontHead,fontSize:10,color:B.textPrimary,borderBottom:`2px solid ${B.cardBorder}`,background:B.bg}}>Position</th>
          </tr></thead>
          <tbody>{binServices.map((service,si)=>{
            const comp = getComparison(service);
            return (
              <tr key={si} style={{borderBottom:`1px solid ${B.cardBorder}`}}>
                <td style={{padding:'8px 10px',fontWeight:600,position:'sticky',left:0,background:B.cardBg,zIndex:1}}>{service}</td>
                <td style={{padding:'8px 10px',textAlign:'center',background:`${B.yellow}06`,fontWeight:700,color:B.yellow}}>{binnedItRates[service]?`$${binnedItRates[service]}`:'—'}</td>
                {competitors.map((c,ci)=>{
                  const rate = c.rates[service];
                  const compId = c.id || c.name;
                  const isEd = editingCell?.compId === compId && editingCell?.service === service;
                  return (
                    <td key={ci} style={{padding:'4px 6px',textAlign:'center',cursor:'pointer'}} onClick={()=>!isEd&&startEdit(compId,service,rate)}>
                      {isEd
                        ? <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditingCell(null);}} placeholder="$ or POA" style={{background:B.bg,border:`1px solid ${B.yellow}`,borderRadius:4,padding:'4px 6px',fontSize:12,color:B.textPrimary,width:80,textAlign:'center',outline:'none'}} />
                        : <span style={{color:rate?B.textPrimary:B.textMuted,fontSize:rate?12:10}}>{typeof rate==='number'?`$${rate}`:rate||'—'}</span>
                      }
                    </td>
                  );
                })}
                <td style={{padding:'8px 10px',textAlign:'center'}}>{comp?`$${comp.avg}`:'—'}</td>
                <td style={{padding:'8px 10px',textAlign:'center'}}>
                  {comp
                    ? <span style={{fontSize:11,fontWeight:700,color:comp.diff>0?B.green:comp.diff<-10?B.red:B.amber,background:comp.diff>0?`${B.green}12`:comp.diff<-10?`${B.red}12`:`${B.amber}12`,padding:'2px 8px',borderRadius:4}}>{comp.diff>0?'+':''}{comp.diff}%</span>
                    : <span style={{color:B.textMuted,fontSize:10}}>Need data</span>
                  }
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:20}}>
        {[
          {t:"Services With Data",v:`${binServices.filter(s=>competitors.some(c=>c.rates[s])).length} / ${binServices.length}`,c:B.textPrimary},
          {t:"Premium Position",v:`${binServices.filter(s=>{const c=getComparison(s);return c&&c.diff>0;}).length}`,c:B.green},
          {t:"Below Market",v:`${binServices.filter(s=>{const c=getComparison(s);return c&&c.diff<0;}).length}`,c:B.red}
        ].map((k,i)=>(
          <div key={i} style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:10,padding:16,textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <div style={{fontSize:10,color:B.textMuted,textTransform:'uppercase'}}>{k.t}</div>
            <div style={{fontFamily:fontHead,fontSize:24,color:k.c,fontWeight:700,marginTop:4}}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:20}}>
        <div style={{fontFamily:fontHead,fontSize:14,color:B.textPrimary,fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Competitors ({competitors.length})</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
          {competitors.map((c,ci)=>(
            <div key={ci} style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:8,padding:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontFamily:fontHead,fontSize:13,fontWeight:700}}>{c.name}</div>
                <button onClick={()=>removeCompetitor(c)} style={{background:'none',border:'none',color:B.red,cursor:'pointer',fontSize:14,padding:0}}>x</button>
              </div>
              <div style={{fontSize:11,color:B.textMuted,marginTop:4}}>{c.source||'No source'}</div>
              <div style={{fontSize:11,color:B.textMuted}}>Updated: {c.date}</div>
              <div style={{fontSize:11,color:Object.keys(c.rates).length>0?B.green:B.amber,marginTop:4}}>{Object.keys(c.rates).length} rates on file</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
