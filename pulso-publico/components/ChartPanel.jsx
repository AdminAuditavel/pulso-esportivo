'use client';

import React from 'react';
import { Bar } from 'react-chartjs-2';
import LoadingChartPlaceholder from './LoadingChartPlaceholder';
import { MANUAL_PALETTE } from '../lib/rankingUtils';

/**
 * ChartPanel
 * Props:
 *  - rows: array of {club, value}
 *  - loading: boolean
 */
export default function ChartPanel({ rows = [], loading = false }) {
  const primary = MANUAL_PALETTE[0] ?? '#337d26';

  const barData = {
    labels: rows.map((r) => r.club),
    datasets: [{ label: 'IAP', data: rows.map((r) => r.value), backgroundColor: primary }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: { y: { beginAtZero: true } },
  };

  return <div style={{ height: 360, width: '100%' }}>{loading ? <LoadingChartPlaceholder height={360} /> : <Bar data={barData} options={barOptions} />}</div>;
}
