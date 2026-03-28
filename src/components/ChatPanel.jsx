import React, { useState, useRef, useEffect } from 'react';
import { B, fontHead, fontBody } from '../theme';
import * as D from '../data/financials';

const SUGGESTED_QUESTIONS = [
  "What's my biggest cash flow risk?",
  "How does this month compare to last month?",
  "Which bin type has the worst margin?",
  "What compliance items are due soon?",
];

export default function ChatPanel({ open, onClose, selectedMonth, monthCount, selLabel, isMobile }) {
  const [chatMsgs, setChatMsgs] = useState([
    { role: 'assistant', text: 'Hi Mark! Ask me anything about your dashboard, reports, or business.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  const mi = (monthCount || 1) - 1;

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

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: userMsg }],
          reportMonth: selectedMonth || '2026-02',
          userId: null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      // Stream SSE response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      // Add empty assistant message to fill in
      setChatMsgs(prev => [...prev, { role: 'assistant', text: '' }]);

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
                accumulatedText += parsed.text;
                setChatMsgs(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', text: accumulatedText };
                  return updated;
                });
              }
            } catch {
              // Skip malformed
            }
          }
        }
      }

      if (!accumulatedText) {
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
          updated[updated.length - 1] = { role: 'assistant', text: `Connection issue: ${e.message || 'Please try again.'}` };
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
            <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>Binned-IT Assistant</div>
            <div style={{ fontSize: 10, color: '#888' }}>Powered by Claude · {selLabel || 'Feb 2026'}</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chatMsgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.role === 'user' ? B.yellow : B.bg, color: m.role === 'user' ? '#fff' : B.textPrimary, borderRadius: 12, padding: '10px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {m.text || (m.role === 'assistant' && chatLoading ? '...' : '')}
              </div>
            ))}
            {chatLoading && chatMsgs[chatMsgs.length - 1]?.text === '' && (
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
