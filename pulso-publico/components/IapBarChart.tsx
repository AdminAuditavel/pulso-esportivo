'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Row = {
  club: string;
  iap: number;
};

export default function IapBarChart({ rows }: { rows: Row[] }) {
  const labels = rows.map((r) => r.club);
  const data = rows.map((r) => r.iap);

  return (
    <div style={{ width: '100%', maxWidth: 980 }}>
      <Bar
        data={{
          labels,
          datasets: [{ label: 'IAP', data }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
          },
          scales: {
            y: { beginAtZero: true },
          },
        }}
        height={360}
      />
    </div>
  );
}
