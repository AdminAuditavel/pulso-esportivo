//components/ChartPanel.jsx
'use client';

import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import LoadingChartPlaceholder from './LoadingChartPlaceholder';
import { MANUAL_PALETTE } from '../lib/rankingUtils';

function toNumber(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'string' ? Number(String(x).replace(',', '.')) : Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeClubKey(name) {
  const s = String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function format2(x) {
  const n = toNumber(x);
  if (n === null) return null;
  return Number(n.toFixed(2));
}

/**
 * ChartPanel (Ranking chart)
 * Props:
 *  - rows: [{ club, value, rawItem, __club_key, ... }]
 *  - loading: bool
 *  - height: number (px)
 *  - topN: number (default 20)
 *  - prevMetricsMap: Map(key -> { score/iap/value, rank, ... }) (opcional)
 *  - prevDateUsed: string YYYY-MM-DD (opcional)
 */
export default function ChartPanel({
  rows = [],
  loading = false,
  height = 520,
  topN = 20,
  prevMetricsMap = null,
  prevDateUsed = '',
}) {
  const primary = MANUAL_PALETTE[0] ?? '#337d26';

  const clean = useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];

    // já vem ordenado no Ranking.jsx, mas vamos garantir:
    const normalized = arr
      .map((r, idx) => {
        const club = r?.club;
        const value = toNumber(r?.value ?? r?.score ?? r?.iap ?? r?.iap_score ?? null);
        if (!club || club === '—' || value === null) return null;

        const rawItem = r?.rawItem ?? r;
        const rankPos = Number(rawItem?.rank_position) || idx + 1;

        const key =
          r?.__club_key ||
          rawItem?.__club_key ||
          normalizeClubKey(club);

        let prevVal = null;
        if (prevMetricsMap && typeof prevMetricsMap.get === 'function') {
          const pm =
            prevMetricsMap.get(key) ??
            prevMetricsMap.get(club) ??
            prevMetricsMap.get(normalizeClubKey(club));

          const pv = pm?.score ?? pm?.iap ?? pm?.iap_score ?? pm?.value ?? null;
          prevVal = toNumber(pv);
        }

        const delta = prevVal === null ? null : value - prevVal;

        return {
          club,
          value,
          rankPos,
          key,
          prevVal,
          delta,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.rankPos - b.rankPos)
      .slice(0, Math.max(1, Number(topN) || 20));

    return normalized;
  }, [rows, topN, prevMetricsMap]);

  if (loading) {
    return (
      <div style={{ height, width: '100%' }}>
        <LoadingChartPlaceholder height={height} />
      </div>
    );
  }

  if (clean.length === 0) {
    return (
      <div style={{ height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }}>
        Sem dados para plotar.
      </div>
    );
  }

  const labels = clean.map((r) => `#${r.rankPos} • ${r.club}`);
  const values = clean.map((r) => r.value);

  const barData = {
    labels,
    datasets: [
      {
        label: 'IAP',
        data: values,
        backgroundColor: primary,
        borderWidth: 0,
        borderRadius: 8,
        barThickness: 14,
        maxBarThickness: 16,
      },
    ],
  };

  const barOptions = {
    indexAxis: 'y', // horizontal
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (items) => {
            if (!items?.length) return '';
            // o label já contém rank + clube
            return items[0].label || '';
          },
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const row = clean[idx];
            const iap = format2(row?.value);
            const parts = [`IAP: ${iap !== null ? iap.toFixed(2) : '—'}`];

            if (prevDateUsed && row?.delta !== null) {
              const d = format2(row.delta);
              const sign = d > 0 ? '+' : '';
              parts.push(`Δ vs ${prevDateUsed}: ${sign}${d.toFixed(2)}`);
            } else if (prevDateUsed) {
              parts.push(`Δ vs ${prevDateUsed}: —`);
            }

            return parts;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          autoSkip: false,
          font: { size: 12 },
          // deixa o texto compacto
          callback: function (val) {
            const label = this.getLabelForValue(val);
            // corta se ficar grande
            return String(label).length > 26 ? String(label).slice(0, 26) + '…' : label;
          },
        },
        grid: { display: false },
      },
      x: {
        beginAtZero: true,
        ticks: { font: { size: 12 } },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
    },
  };

  return (
    <div style={{ height, width: '100%' }}>
      <Bar data={barData} options={barOptions} />
      {/* legenda pequena */}
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
        Exibindo Top {clean.length}. Passe o mouse/toque nas barras para ver IAP e Δ{prevDateUsed ? ` vs ${prevDateUsed}` : ''}.
      </div>
    </div>
  );
}
