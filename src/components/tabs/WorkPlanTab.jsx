import React, { useState } from 'react';
import { B, fontHead } from '../../theme';
import { SectionHeader } from '../UIComponents';
import { defaultWorkPlan } from '../../data/workplan';
import { useWorkPlanItems, useMarkComplete, useUnmarkComplete } from '../../hooks/useWorkPlan';

// Build fallback structure from defaultWorkPlan for when Supabase is empty
function buildFallbackSections(wpDone) {
  return [
    { title: 'THIS WEEK', color: B.red, items: defaultWorkPlan.thisWeek },
    { title: 'THIS MONTH', color: B.amber, items: defaultWorkPlan.thisMonth },
    { title: 'THIS QUARTER', color: B.textMuted, items: defaultWorkPlan.thisQuarter },
  ].map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      done: wpDone[item.id] || null,
    })),
  }));
}

// Build sections from Supabase data
// Supabase schema: id (uuid), title, description, area, horizon (week|month|quarter),
//                 priority, effort_hours, business_impact, owner_role, is_active
function buildSupabaseSections(items) {
  const horizonMap = { week: 'THIS WEEK', month: 'THIS MONTH', quarter: 'THIS QUARTER' };
  const colorMap = { 'THIS WEEK': B.red, 'THIS MONTH': B.amber, 'THIS QUARTER': B.textMuted };
  const bySection = { 'THIS WEEK': [], 'THIS MONTH': [], 'THIS QUARTER': [] };

  items.forEach(item => {
    const sectionKey = horizonMap[item.horizon] || 'THIS MONTH';
    const latestCompletion = item.work_plan_completions?.[0] || null;
    bySection[sectionKey].push({
      id: item.id,
      action: item.title || item.description || 'Untitled task',
      why: item.business_impact || item.description || '',
      owner: item.owner_role || 'Mark',
      effort: item.effort_hours ? `${item.effort_hours}h` : '',
      area: item.area || '',
      done: latestCompletion
        ? { by: latestCompletion.completed_by || 'Mark', at: latestCompletion.completed_at }
        : null,
      supabaseId: item.id,
    });
  });

  return Object.entries(bySection)
    .filter(([, sectionItems]) => sectionItems.length > 0)
    .map(([title, sectionItems]) => ({ title, color: colorMap[title] || B.textMuted, items: sectionItems }));
}

export default function WorkPlanTab({ wpDone, toggleDone }) {
  const { data: supabaseItems, isLoading, isError } = useWorkPlanItems();
  const markComplete = useMarkComplete();
  const unmarkComplete = useUnmarkComplete();
  const [notes, setNotes] = useState('');

  const useSupabase = supabaseItems && supabaseItems.length > 0;

  const sections = useSupabase
    ? buildSupabaseSections(supabaseItems)
    : buildFallbackSections(wpDone || {});

  const handleToggle = (item) => {
    if (useSupabase) {
      if (item.done) {
        unmarkComplete.mutate({ itemId: item.supabaseId });
      } else {
        markComplete.mutate({ itemId: item.supabaseId, notes: '' });
      }
    } else {
      toggleDone && toggleDone(item.id);
    }
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Work Plan" subtitle="Loading..." />
        <div style={{ color: B.textMuted, fontSize: 13, padding: '20px 0' }}>Loading work plan items...</div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Work Plan"
        subtitle="Prioritised by: Growth first → Cash → Compliance → Data → Systems → Strategy"
      />
      {isError && (
        <div style={{ background: `${B.amber}15`, border: `1px solid ${B.amber}40`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: B.amber }}>
          Using offline data — Supabase connection issue
        </div>
      )}
      {sections.map((section, si) => (
        <div key={si} style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, color: section.color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.06em' }}>
            {section.title} ({section.items.filter(it => !it.done).length} open, {section.items.filter(it => it.done).length} done)
          </div>
          {section.items.map((item, itemIdx) => {
            const done = item.done;
            return (
              <div
                key={item.id}
                style={{
                  background: done ? `${B.green}08` : B.cardBg,
                  border: `1px solid ${done ? `${B.green}33` : B.cardBorder}`,
                  borderRadius: 10,
                  padding: '14px 16px',
                  marginBottom: 8,
                  borderLeft: `4px solid ${done ? B.green : section.color}`,
                  opacity: done ? 0.6 : 1,
                  transition: 'all 0.2s',
                  minHeight: 48,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: fontHead, fontSize: 16, color: section.color, fontWeight: 700 }}>#{typeof item.id === 'number' ? item.id : itemIdx + 1}</span>
                      <span style={{ fontSize: 13, color: done ? B.textMuted : B.textPrimary, fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>{item.action}</span>
                    </div>
                    <div style={{ fontSize: 11, color: B.textMuted, marginTop: 4 }}>{item.why}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: B.yellow, background: `${B.yellow}15`, padding: '2px 8px', borderRadius: 4 }}>{item.owner}</span>
                      <span style={{ fontSize: 10, color: B.textMuted }}>{item.effort}</span>
                      <span style={{ fontSize: 10, color: B.textMuted }}>Area: {item.area}</span>
                      {done && <span style={{ fontSize: 10, color: B.green }}>[OK] Done by {done.by} — {new Date(done.at).toLocaleDateString('en-AU')}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(item)}
                    style={{
                      background: done ? B.green : 'none',
                      border: `2px solid ${done ? B.green : B.cardBorder}`,
                      borderRadius: 6,
                      width: 28,
                      height: 28,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: done ? '#0A0A0A' : B.textMuted,
                      fontSize: 14,
                      fontWeight: 700,
                      minHeight: 28,
                    }}
                  >
                    {done ? 'OK' : ''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
