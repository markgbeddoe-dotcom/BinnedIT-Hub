import React, { useState, useEffect, useRef, useCallback } from 'react';
import { B, fontHead } from '../theme';

// Sprint 11A: replaced opaque "Collect" (⚖️) with "Load Data" (📥) so Sarah can
// reach the wizard from any mobile page. Collections is still reachable from the
// hamburger side menu. Audit-ux.md §1 ranked the scales-of-justice icon as the
// 7th-worst kid-test confusion point.
const NAV_ITEMS = [
  { id: 'home',         screen: 'home',         icon: '🏠', label: 'Home' },
  { id: 'dispatch',     screen: 'dispatch',     icon: '🗂️', label: 'Dispatch' },
  { id: 'bookings',     screen: 'bookings',     icon: '📅', label: 'Jobs' },
  { id: 'month-select', screen: 'month-select', icon: '📥', label: 'Load Data' },
  { id: 'dashboard',    screen: 'dashboard',    icon: '📊', label: 'Reports' },
  { id: 'chat',         screen: null,           icon: '💬', label: 'Chat' },
];

// Sprint 15 #23: dashboard tab picker drawer — when on /dashboard/* tapping
// "Reports" again opens a bottom-sheet with all 12 tabs grouped by category,
// fixing the audit-ux.md §1 #2 "CRITICAL" mobile reachability gap.
const PICKER_GROUPS = [
  { title: 'At a glance', ids: ['snapshot'] },
  { title: 'Money',       ids: ['revenue', 'margins', 'cashflow', 'debtors'] },
  { title: 'Operations',  ids: ['fleet', 'bdm'] },
  { title: 'Comparison',  ids: ['benchmarking', 'competitors', 'pricing'] },
  { title: 'Compliance + Action', ids: ['risk', 'workplan'] },
];

export default function MobileNav({
  currentScreen, currentTab, alertCount, onNavigate, onChatOpen, chatOpen,
  dashTabs = [], onTabPick,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const drawerRef = useRef(null);
  const reportsBtnRef = useRef(null);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  // Esc-key closes the drawer
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closePicker(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen, closePicker]);

  // Focus trap: send focus to first row when opening, return to button on close
  useEffect(() => {
    if (pickerOpen && drawerRef.current) {
      const first = drawerRef.current.querySelector('[data-picker-row]');
      if (first) first.focus();
    } else if (!pickerOpen && reportsBtnRef.current) {
      // do not steal focus on initial mount
    }
  }, [pickerOpen]);

  // Trap Tab key inside the drawer when open
  useEffect(() => {
    if (!pickerOpen) return;
    const onTab = (e) => {
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll(
        'button, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onTab);
    return () => window.removeEventListener('keydown', onTab);
  }, [pickerOpen]);

  const handleReportsTap = () => {
    // First tap (not on dashboard): jump to Overview as before.
    // Second tap (already on dashboard): open the picker drawer.
    if (currentScreen === 'dashboard') {
      setPickerOpen(true);
    } else {
      onNavigate('dashboard', 'snapshot');
    }
  };

  const handlePick = (tabId) => {
    setPickerOpen(false);
    if (onTabPick) onTabPick(tabId);
    else onNavigate('dashboard', tabId);
  };

  // Build a quick lookup so groups can render the official label even if the
  // group definition gets out of sync with App.jsx's dashTabs array.
  const labelById = Object.fromEntries(dashTabs.map(t => [t.id, t.label]));

  return (
    <>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 60,
        background: '#111', borderTop: `2px solid ${B.cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        zIndex: 200, fontFamily: fontHead,
      }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.id === 'chat'
            ? chatOpen === true
            : item.tab
              ? currentScreen === item.screen && currentTab === item.tab
              : currentScreen === item.screen;

          const handleTap = () => {
            if (item.id === 'chat') { onChatOpen(); return; }
            if (item.id === 'alerts') { onNavigate('dashboard', 'snapshot'); return; }
            if (item.id === 'dashboard') { handleReportsTap(); return; }
            if (item.tab) { onNavigate(item.screen, item.tab); return; }
            onNavigate(item.screen);
          };

          const isReports = item.id === 'dashboard';

          return (
            <button
              key={item.id}
              ref={isReports ? reportsBtnRef : null}
              onClick={handleTap}
              aria-haspopup={isReports ? 'dialog' : undefined}
              aria-expanded={isReports ? pickerOpen : undefined}
              aria-label={isReports ? (currentScreen === 'dashboard' ? 'Open dashboard tab picker' : 'Reports') : item.label}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '4px 0', flex: 1, position: 'relative',
                color: isActive ? B.yellow : '#888',
              }}>
              <div style={{ fontSize: 20, position: 'relative' }}>
                {item.icon}
                {isReports && currentScreen === 'dashboard' && (
                  // Tiny chevron hint that a second tap opens the picker
                  <span style={{
                    position: 'absolute', top: -4, right: -8,
                    background: B.yellow, color: '#0A0A0A', borderRadius: '50%',
                    width: 12, height: 12, fontSize: 8, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                    lineHeight: 1,
                  }} aria-hidden="true">▾</span>
                )}
                {item.id === 'alerts' && alertCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    background: B.red, color: '#fff', borderRadius: '50%',
                    width: 16, height: 16, fontSize: 9, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                  }}>
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ===== Tab Picker Drawer ===== */}
      {/* Backdrop — fades in/out, click closes */}
      <div
        onClick={closePicker}
        aria-hidden={!pickerOpen}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 300, opacity: pickerOpen ? 1 : 0,
          pointerEvents: pickerOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      />
      {/* Bottom sheet */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard tab picker"
        aria-hidden={!pickerOpen}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          background: B.cardBg, color: B.textPrimary,
          borderTop: `3px solid ${B.yellow}`,
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          zIndex: 301,
          transform: pickerOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s ease',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.3)',
          fontFamily: fontHead,
        }}
      >
        {/* Drag handle + header */}
        <div style={{
          padding: '10px 16px 12px', borderBottom: `1px solid ${B.cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              width: 40, height: 4, borderRadius: 2, background: B.cardBorder,
              margin: '0 auto 8px',
            }} aria-hidden="true" />
            <div style={{
              fontSize: 14, fontWeight: 700, color: B.textPrimary,
              textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
            }}>
              Choose a Report
            </div>
          </div>
          <button
            onClick={closePicker}
            aria-label="Close"
            style={{
              position: 'absolute', right: 12, top: 12,
              background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
              color: B.textMuted, lineHeight: 1, padding: 4,
            }}
          >×</button>
        </div>

        {/* Scrollable list */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '8px 0 24px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {PICKER_GROUPS.map(group => {
            const visibleIds = group.ids.filter(id => labelById[id]);
            if (visibleIds.length === 0) return null;
            return (
              <div key={group.title}>
                <div style={{
                  padding: '12px 20px 6px', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.12em', color: B.textMuted,
                  textTransform: 'uppercase',
                }}>
                  {group.title}
                </div>
                {visibleIds.map(id => {
                  const isCurrent = id === currentTab && currentScreen === 'dashboard';
                  return (
                    <button
                      key={id}
                      data-picker-row
                      onClick={() => handlePick(id)}
                      style={{
                        width: '100%', minHeight: 56,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 20px', background: isCurrent ? B.yellowLight : 'transparent',
                        border: 'none', borderLeft: isCurrent ? `4px solid ${B.yellow}` : '4px solid transparent',
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: fontHead, fontSize: 16,
                        color: B.textPrimary, fontWeight: isCurrent ? 700 : 500,
                      }}
                    >
                      <span>{labelById[id]}</span>
                      {isCurrent ? (
                        <span style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: B.yellow, border: `2px solid ${B.yellowDark}`,
                          flexShrink: 0,
                        }} aria-label="current tab" />
                      ) : (
                        <span style={{ color: B.textMuted, fontSize: 18 }} aria-hidden="true">›</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
