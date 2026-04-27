import React from 'react';
import { B, fontHead } from '../theme';

const NAV_ITEMS = [
  { id: 'home',        screen: 'home',        icon: '🏠',  label: 'Home' },
  { id: 'dispatch',    screen: 'dispatch',    icon: '🗂️',  label: 'Dispatch' },
  { id: 'bookings',    screen: 'bookings',    icon: '📅',  label: 'Jobs' },
  { id: 'collections', screen: 'collections', icon: '⚖️',  label: 'Collect' },
  { id: 'dashboard',   screen: 'dashboard',   icon: '📊',  label: 'Reports' },
  { id: 'chat',        screen: null,          icon: '💬',  label: 'Chat' },
];

export default function MobileNav({ currentScreen, currentTab, alertCount, onNavigate, onChatOpen, chatOpen }) {
  return (
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
          if (item.tab) { onNavigate(item.screen, item.tab); return; }
          onNavigate(item.screen);
        };

        return (
          <button key={item.id} onClick={handleTap} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '4px 0', flex: 1, position: 'relative',
            color: isActive ? B.yellow : '#888',
          }}>
            <div style={{ fontSize: 20, position: 'relative' }}>
              {item.icon}
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
  );
}
