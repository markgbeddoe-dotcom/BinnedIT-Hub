import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { B, fontHead, fontBody, fmtFull } from '../theme';
import * as D from '../data/financials';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Markdown-lite renderer — the assistant replies with **bold**, `code`,
// in-app links [Label](/route), external links [Label](https://…), and
// images ![alt](/help/…png). Internal links navigate within the SPA via
// onNavigate; no markdown dependency.
function renderChatText(text, onNavigate) {
  if (!text) return text;
  const TOKEN = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  return text.split(TOKEN).map((part, i) => {
    // image: ![alt](url)
    let m = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(part);
    if (m) {
      return (
        <img
          key={i}
          src={m[2]}
          alt={m[1]}
          loading="lazy"
          style={{ display: 'block', maxWidth: '100%', borderRadius: 8, border: `1px solid ${B.cardBorder}`, margin: '8px 0' }}
        />
      );
    }
    // link: [label](url)
    m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (m) {
      const label = m[1], url = m[2];
      const internal = url.startsWith('/');
      if (internal) {
        return (
          <button
            key={i}
            type="button"
            onClick={() => onNavigate(url)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: `${B.blue}15`, border: `1px solid ${B.blue}`, color: B.blue,
              borderRadius: 6, padding: '1px 8px', margin: '0 1px', fontSize: 12,
              fontFamily: fontBody, cursor: 'pointer', verticalAlign: 'baseline',
            }}
          >
            {label} <span style={{ fontSize: 10 }}>↗</span>
          </button>
        );
      }
      return (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: B.blue }}>{label}</a>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 3, padding: '0 4px', fontSize: 12 }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const SUGGESTED_QUESTIONS = [
  "How do I schedule a new service?",
  "How do I add a driver to a job?",
  "Schedule all of today's unassigned jobs",
  "Who's on the roster today?",
  "What's my biggest cash flow risk?",
];

// Friendly verbs for tool activity lines
const TOOL_LABELS = {
  get_jobs: 'Checking jobs',
  get_roster: 'Checking drivers & trucks',
  get_business_rules: 'Checking business rules',
  assign_job: 'Assigning job',
};

function activityLabel(a) {
  const verb = TOOL_LABELS[a.name] || a.name;
  if (a.status === 'running') return `⚙ ${verb}…`;
  if (a.status === 'error') return `⚠ ${a.summary || `${verb} failed`}`;
  return `✓ ${a.summary || `${verb} done`}`;
}

export default function ChatPanel({ open, onClose, selectedMonth, monthCount, selLabel, isMobile }) {
  const [chatMsgs, setChatMsgs] = useState([
    { role: 'assistant', text: "Hi Mark! I can explain how to use SkipSync — and for managers, I can take dispatch actions too: check jobs and the roster, and assign drivers and trucks. What do you need?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const navigate = useNavigate();

  // Click on an in-app link the assistant emitted → navigate there. On mobile,
  // close the chat so the page is visible; on desktop keep it open alongside.
  const handleChatNavigate = (path) => {
    navigate(path);
    if (isMobile) onClose?.();
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  const mi = (monthCount || 1) - 1;
  const { user } = useAuth();

  const ytdRevenue = D.totalRevenue.slice(0, mi + 1).reduce((a, b) => a + b, 0);
  const ytdProfit = D.netProfit.slice(0, mi + 1).reduce((a, b) => a + b, 0);
  const financialSummary = [
    `Period: ${selLabel || 'Feb 2026'} (month ${mi + 1} of FY)`,
    `Revenue this month: $${Math.round(D.totalRevenue[mi] || 0).toLocaleString('en-AU')}`,
    `YTD Revenue: $${Math.round(ytdRevenue).toLocaleString('en-AU')}`,
    `Gross Margin: ${D.gmPct[mi] || 0}%`,
    `Net Profit this month: $${Math.round(D.netProfit[mi] || 0).toLocaleString('en-AU')}`,
    `YTD Net Profit: $${Math.round(ytdProfit).toLocaleString('en-AU')}`,
    `Cash Balance: $${Math.round((D.cashBalance || [])[mi] || 0).toLocaleString('en-AU')}`,
    `Accounts Receivable: $${Math.round(D.arTotal || 0).toLocaleString('en-AU')} (overdue: $${Math.round(D.arOverdue || 0).toLocaleString('en-AU')})`,
    `Wages: $${Math.round((D.wages || [])[mi] || 0).toLocaleString('en-AU')} | Fuel: $${Math.round((D.fuelCosts || [])[mi] || 0).toLocaleString('en-AU')}`,
  ].join('\n');

  const sendChat = async (overrideMsg) => {
    const userMsg = overrideMsg || chatInput.trim();
    if (!userMsg || chatLoading) return;
    setChatInput('');
    setChatMsgs(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const history = chatMsgs.slice(1).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.text,
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: userMsg }],
          reportMonth: selectedMonth || '2026-02',
          userId: user?.id || null,
          financialSummary,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('AI Chat unavailable in local dev — run `vercel dev` instead of `npm run dev`, or use the live app at binnedit-hub.vercel.app')
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      // Stream SSE response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let activity = []; // [{ name, status, summary }] — tool audit trail for this reply

      // Add empty assistant message to fill in
      setChatMsgs(prev => [...prev, { role: 'assistant', text: '', activity: [] }]);

      const pushUpdate = () => {
        setChatMsgs(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', text: accumulatedText, activity: [...activity] };
          return updated;
        });
      };

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
              // Contract is {text: "..."} — but tolerate a bare JSON string
              // delta too, so a server-side shape regression degrades gracefully.
              const textDelta = typeof parsed === 'string' ? parsed : parsed?.text;
              if (typeof textDelta === 'string' && textDelta) {
                accumulatedText += textDelta;
                pushUpdate();
              }
              if (parsed.tool && parsed.tool.name) {
                const t = { name: parsed.tool.name, status: parsed.tool.status || 'running', summary: parsed.tool.summary || '' };
                // Resolve the matching in-flight "running" entry, otherwise stack a new line
                let idx = -1;
                for (let k = activity.length - 1; k >= 0; k--) {
                  if (activity[k].name === t.name && activity[k].status === 'running') { idx = k; break; }
                }
                if (idx >= 0 && t.status !== 'running') activity[idx] = t;
                else activity.push(t);
                pushUpdate();
              }
              // Unknown keys are ignored — text accumulation continues regardless
            } catch {
              // Skip malformed
            }
          }
        }
      }

      if (!accumulatedText && activity.length === 0) {
        setChatMsgs(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', text: 'Sorry, I could not process that request.' };
          return updated;
        });
      }
    } catch (e) {
      // If streaming setup failed, the empty message may not have been added yet
      setChatMsgs(prev => {
        // Check if last message is empty assistant — replace it; otherwise add new one
        if (prev[prev.length - 1]?.role === 'assistant' && prev[prev.length - 1]?.text === '') {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], role: 'assistant', text: `Connection issue: ${e.message || 'Please try again.'}` };
          return updated;
        }
        return [...prev, { role: 'assistant', text: `Connection issue: ${e.message || 'Please try again.'}` }];
      });
    }

    setChatLoading(false);
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  const showSuggestions = chatMsgs.length === 1;

  return (
    <>
      {!isMobile && (
        <button
          onClick={onClose}
          style={{ position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%', background: B.yellow, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, zIndex: 150, color: '#fff' }}
        >
          {open ? '✕' : '💬'}
        </button>
      )}

      {open && (
        <div style={{ position: 'fixed', bottom: isMobile ? 68 : 90, right: isMobile ? 0 : 24, left: isMobile ? 0 : 'auto', width: isMobile ? '100%' : 380, maxWidth: isMobile ? '100%' : 'calc(100vw - 48px)', height: isMobile ? 'calc(100vh - 68px - 56px)' : 520, maxHeight: isMobile ? 'calc(100vh - 68px - 56px)' : '65vh', background: B.cardBg, borderRadius: isMobile ? '14px 14px 0 0' : 14, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', zIndex: 150, overflow: 'hidden', border: `1px solid ${B.cardBorder}` }}>
          {/* Header */}
          <div style={{ background: '#000', padding: '14px 16px', borderBottom: `2px solid ${B.yellow}` }}>
            <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.yellow, textTransform: 'uppercase' }}>SkipSync Assistant</div>
            <div style={{ fontSize: 10, color: '#888' }}>Powered by Claude · {selLabel || 'Feb 2026'}</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chatMsgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Tool activity audit trail — muted rows, not chat bubbles */}
                {m.role === 'assistant' && (m.activity || []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '2px 4px' }}>
                    {m.activity.map((a, j) => (
                      <div key={j} style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', background: B.cardBgHover, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '3px 9px', fontSize: 11, lineHeight: 1.4, color: a.status === 'error' ? B.red : B.textMuted, fontFamily: fontBody, fontStyle: a.status === 'running' ? 'italic' : 'normal' }}>
                        {activityLabel(a)}
                      </div>
                    ))}
                  </div>
                )}
                {(m.text || m.role === 'user' || (m.activity || []).length === 0) && (
                  <div style={{ background: m.role === 'user' ? B.yellow : B.bg, color: m.role === 'user' ? '#fff' : B.textPrimary, borderRadius: 12, padding: '10px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {m.text ? renderChatText(m.text, handleChatNavigate) : (m.role === 'assistant' && chatLoading ? '...' : '')}
                  </div>
                )}
              </div>
            ))}
            {chatLoading && chatMsgs[chatMsgs.length - 1]?.text === '' && (chatMsgs[chatMsgs.length - 1]?.activity || []).length === 0 && (
              <div style={{ alignSelf: 'flex-start', background: B.bg, borderRadius: 12, padding: '10px 14px', fontSize: 13, color: B.textMuted }}>
                Thinking...
              </div>
            )}

            {/* Suggested questions */}
            {showSuggestions && !chatLoading && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: B.textMuted, marginBottom: 6, fontFamily: fontHead, textTransform: 'uppercase' }}>Try asking:</div>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => sendChat(q)} style={{ display: 'block', width: '100%', textAlign: 'left', background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 8, padding: '7px 11px', fontSize: 12, color: B.textSecondary, cursor: 'pointer', marginBottom: 4, fontFamily: fontBody }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${B.cardBorder}`, display: 'flex', gap: 8 }}>
            <input
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
              placeholder="Ask about your business..."
              style={{ flex: 1, background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: B.textPrimary, outline: 'none', fontFamily: fontBody }}
            />
            <button
              onClick={() => sendChat()}
              disabled={chatLoading}
              style={{ background: B.yellow, border: 'none', borderRadius: 8, padding: '8px 14px', cursor: chatLoading ? 'wait' : 'pointer', fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: '#fff' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
