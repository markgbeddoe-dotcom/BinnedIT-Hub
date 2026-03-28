import React from 'react';
import CompetitorPage from '../CompetitorPage';

export default function CompetitorsTab({ data, selectedMonth, monthCount, monthLabel, onBack }) {
  return <CompetitorPage onBack={onBack || (() => {})} />;
}
