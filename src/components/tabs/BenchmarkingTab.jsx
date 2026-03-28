import React from 'react';
import PricingTab from '../PricingTab';

export default function BenchmarkingTab({ data, selectedMonth, monthCount, monthLabel }) {
  // PricingTab uses monthIndex (0-based) and monthLabel
  const mi = monthCount - 1;
  return <PricingTab monthIndex={mi} monthLabel={monthLabel} />;
}
