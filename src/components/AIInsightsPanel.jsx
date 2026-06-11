/**
 * @file AIInsightsPanel.jsx
 * Reusable AI insights panel component.
 *
 * Renders a collapsible panel with a "Generate" button that calls /api/chat
 * and streams a structured analysis of the provided contextSummary.
 *
 * Used by: SnapshotTab (Business Snapshot), RevenueTab (Revenue Analysis),
 *          CompetitorPage (Market Research)
 *
 * Requires: ANTHROPIC_API_KEY set in Vercel environment variables.
 *           Use `vercel dev` locally — does not work with `npm run dev`.
 *
 * WP-G (R7 / FR7.7.3): also renders an "Operational Efficiency" section
 * listing ai_insights rows (daily cron + manual refresh via
 * POST /api/efficiency-insights). Controlled by the `showEfficiency` prop;
 * defaults to true on the Business Snapshot tab only, so the section
 * appears once across the three existing call sites.
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { B, fontHead, fontBody, fmtFull } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { supabase } from '../lib/supabase';

const CATEGORY_COLORS = {
  tipping: B.purple,
  fuel: B.orange,
  routing: B.blue,
  pricing: B.teal,
  recycling: B.green,
  pipeline: B.cyan,
  general: B.textMuted,
};

const CONFIDENCE_COLORS = { high: B.green, medium: B.amber, low: B.textMuted };

function InsightCard({ insight, isManager, onSetStatus, busy }) {
  const catColor = CATEGORY_COLORS[insight.category] || B.textMuted;
  const confColor = CONFIDENCE_COLORS[insight.confidence] || B.textMuted;
  const resolved = insight.status !== 'new';
  return (
    <div
      data-testid="efficiency-insight-card"
      style={{
        border: `1px solid ${B.cardBorder}`,
        borderRadius: 8,
        padding: '12px 14px',
        background: B.cardBg,
        opacity: resolved ? 0.65 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          background: `${catColor}1A`, color: catColor, border: `1px solid ${catColor}55`,
          borderRadius: 999, padding: '2px 10px', fontFamily: fontHead, fontSize: 10,
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {insight.category}
        </span>
        <span style={{ fontSize: 10, color: confColor, fontFamily: fontHead, fontWeight: 700, textTransform: 'uppercase' }}>
          {insight.confidence} confidence
        </span>
        {resolved && (
          <span style={{ fontSize: 10, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase' }}>
            {insight.status}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: B.textMuted }}>{insight.period}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: B.textPrimary, fontFamily: fontBody, lineHeight: 1.4 }}>
        {insight.title}
      </div>
      {insight.detail && (
        <div style={{ fontSize: 12, color: B.textSecondary, lineHeight: 1.55, fontFamily: fontBody }}>
          {insight.detail}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: insight.est_saving_aud ? B.green : B.textMuted, fontFamily: fontBody }}>
          {insight.est_saving_aud != null ? `~${fmtFull(insight.est_saving_aud)}/mo est.` : 'Saving not quantified'}
        </span>
        {isManager && !resolved && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              data-testid="insight-actioned"
              disabled={busy}
              onClick={() => onSetStatus(insight.id, 'actioned')}
              style={{
                background: 'none', border: `1px solid ${B.green}`, color: B.green,
                padding: '4px 10px', borderRadius: 6, cursor: busy ? 'default' : 'pointer',
                fontFamily: fontHead, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              }}
            >
              Actioned
            </button>
            <button
              data-testid="insight-dismiss"
              disabled={busy}
              onClick={() => onSetStatus(insight.id, 'dismissed')}
              style={{
                background: 'none', border: `1px solid ${B.cardBorder}`, color: B.textMuted,
                padding: '4px 10px', borderRadius: 6, cursor: busy ? 'default' : 'pointer',
                fontFamily: fontHead, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OperationalEfficiencySection() {
  const { session, isManager } = useAuth();
  const { isMobile } = useBreakpoint();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [refreshNote, setRefreshNote] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  // Hardcoded-fallback convention: any Supabase failure → empty list, never a crash.
  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('ai_insights')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const newInsights = insights.filter((i) => i.status === 'new');
  const resolvedInsights = insights.filter((i) => i.status !== 'new');

  const refreshInsights = async () => {
    setRefreshing(true);
    setRefreshError('');
    setRefreshNote('');
    try {
      const token = session?.access_token;
      const response = await fetch('/api/efficiency-insights', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setRefreshNote(
        data.note || (data.inserted > 0
          ? `${data.inserted} new insight${data.inserted === 1 ? '' : 's'} generated.`
          : 'Run complete — no new findings since the last run.')
      );
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    } catch (e) {
      setRefreshError(e.message || 'Refresh failed — AI service unavailable.');
    }
    setRefreshing(false);
  };

  const setStatus = async (id, status) => {
    setStatusBusy(true);
    setRefreshError('');
    try {
      const { error } = await supabase.from('ai_insights').update({ status }).eq('id', id);
      if (error) throw new Error(error.message);
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    } catch (e) {
      setRefreshError(`Could not update insight: ${e.message}`);
    }
    setStatusBusy(false);
  };

  return (
    <div data-testid="efficiency-section" style={{ marginTop: 16, border: `1px solid ${B.teal}55`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        background: `${B.teal}10`, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.teal, textTransform: 'uppercase' }}>
            Operational Efficiency
          </span>
          {newInsights.length > 0 && (
            <span style={{
              background: B.teal, color: '#fff', borderRadius: 999, padding: '1px 8px',
              fontFamily: fontHead, fontSize: 10, fontWeight: 700,
            }}>
              {newInsights.length} new
            </span>
          )}
        </div>
        {isManager && (
          <button
            data-testid="efficiency-refresh"
            disabled={refreshing}
            onClick={refreshInsights}
            style={{
              background: refreshing ? B.cardBorder : B.teal, border: 'none', borderRadius: 6,
              padding: '6px 14px', cursor: refreshing ? 'default' : 'pointer',
              fontFamily: fontHead, fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase',
            }}
          >
            {refreshing ? 'Analysing…' : 'Refresh insights'}
          </button>
        )}
      </div>

      <div style={{ padding: '14px 16px', background: B.cardBg }}>
        {refreshError && (
          <div style={{ fontSize: 12, color: B.red, background: `${B.red}10`, borderRadius: 6, padding: '10px 14px', marginBottom: 10 }}>
            {refreshError}
          </div>
        )}
        {refreshNote && !refreshError && (
          <div style={{ fontSize: 12, color: B.teal, background: `${B.teal}10`, borderRadius: 6, padding: '10px 14px', marginBottom: 10 }}>
            {refreshNote}
          </div>
        )}

        {isLoading ? (
          <div style={{ fontSize: 12, color: B.textMuted, fontFamily: fontBody }}>Loading efficiency insights…</div>
        ) : newInsights.length === 0 ? (
          <div style={{ fontSize: 12, color: B.textMuted, fontFamily: fontBody, lineHeight: 1.6 }}>
            No efficiency insights yet. The AI analyst runs automatically every day at ~5:00 AM Melbourne time
            once operational data (job costs, tip fees, fuel, loads) starts flowing.
            {isManager ? ' Use "Refresh insights" to run it now.' : ''}
            <br />
            <span style={{ fontSize: 11 }}>Savings shown are AI estimates, not audited figures.</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
              {newInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} isManager={isManager} onSetStatus={setStatus} busy={statusBusy} />
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: B.textMuted, fontFamily: fontBody }}>
              Savings are AI estimates, not audited figures. Refreshed daily at ~5:00 AM Melbourne.
            </div>
          </>
        )}

        {resolvedInsights.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button
              data-testid="efficiency-show-resolved"
              onClick={() => setShowResolved((v) => !v)}
              style={{
                background: 'none', border: `1px solid ${B.cardBorder}`, color: B.textMuted,
                padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                fontFamily: fontHead, fontSize: 11, textTransform: 'uppercase',
              }}
            >
              {showResolved ? 'Hide' : 'Show'} resolved ({resolvedInsights.length})
            </button>
            {showResolved && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
                {resolvedInsights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} isManager={isManager} onSetStatus={setStatus} busy={statusBusy} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIInsightsPanel({ tabName, contextSummary, selectedMonth, selLabel }) {
  const { user } = useAuth();
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    setError('');
    setInsights('');
    setOpen(true);

    const prompt = `Analyse the following ${tabName} data for Binned-IT (skip bin hire, Melbourne) and provide 3-5 specific, actionable insights with dollar amounts where possible. Focus on the most important findings and what actions to take.\n\nData:\n${contextSummary}`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          reportMonth: selectedMonth || '2026-02',
          userId: user?.id || null,
          financialSummary: contextSummary,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulated += parsed.text;
                setInsights(accumulated);
              }
            } catch { /* skip */ }
          }
        }
      }

      if (!accumulated) setError('No insights generated — check AI service configuration.');
    } catch (e) {
      setError(e.message || 'AI service unavailable. Ensure ANTHROPIC_API_KEY is set in Vercel and use vercel dev locally.');
    }

    setLoading(false);
  };

  return (
    <div style={{ marginTop: 16, border: `1px solid ${B.yellow}44`, borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{ background: `${B.yellow}12`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => !loading && (open ? setOpen(false) : (insights ? setOpen(true) : generateInsights()))}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.yellow, textTransform: 'uppercase' }}>
            AI Insights — {tabName}
          </span>
          {insights && !loading && (
            <span style={{ fontSize: 10, color: B.textMuted }}>({selLabel || 'current period'})</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading ? (
            <span style={{ fontSize: 11, color: B.textMuted }}>Analysing...</span>
          ) : !insights ? (
            <button
              onClick={e => { e.stopPropagation(); generateInsights(); }}
              style={{ background: B.yellow, border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: fontHead, fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}
            >
              Generate
            </button>
          ) : (
            <span style={{ fontSize: 12, color: B.textMuted }}>{open ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {open && (
        <div style={{ padding: '14px 16px', background: B.cardBg }}>
          {error ? (
            <div style={{ fontSize: 12, color: B.red, background: `${B.red}10`, borderRadius: 6, padding: '10px 14px' }}>{error}</div>
          ) : (
            <div style={{ fontSize: 13, color: B.textPrimary, lineHeight: 1.65, whiteSpace: 'pre-wrap', fontFamily: fontBody }}>
              {insights || (loading ? 'Generating insights...' : '')}
            </div>
          )}
          {insights && !loading && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={generateInsights}
                style={{ background: 'none', border: `1px solid ${B.yellow}`, color: B.yellow, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: fontHead, fontSize: 11, textTransform: 'uppercase' }}
              >
                Regenerate
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: `1px solid ${B.cardBorder}`, color: B.textMuted, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: fontHead, fontSize: 11, textTransform: 'uppercase' }}
              >
                Collapse
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
