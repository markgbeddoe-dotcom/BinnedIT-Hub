import React, { useState, useRef } from 'react';
import { B, fontHead, fontBody } from '../theme';
import { useAuth } from '../context/AuthContext';

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
