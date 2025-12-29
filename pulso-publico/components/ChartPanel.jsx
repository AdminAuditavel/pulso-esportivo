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

function fmt2(x) {
  const n = toNumber(x);
  if (n === null) return '—';
  return n.toFixed(2);
}

export default function ChartPanel({
  rows = [],
  loading = false,
  height = 520,
  topN = 20,
  prevMetricsMap = null,
  prevRankMap = null,
  prevDateUsed = '',
}) {
  const primary = MANUAL_PALETTE[0] ?? '#337d26';

  const clean = useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];

    return arr
      .map((r, idx) => {
        const club = r?.club;
        const rawItem = r?.rawItem ?? r;

        const value = toNumber(r?.value ?? r?.score ?? r?.iap ?? r?.iap_score ?? null);
        if (!club || club === '—' || value === null) return null;

        const rankPos = Number(rawItem?.rank_position) || idx + 1;

        const key =
          (rawItem?.club_id ? String(rawItem.club_id) : null) ||
          (r?.__club_key ? String(r.__club_key) : null) ||
          (rawItem?.__club_key ? String(rawItem.__club_key) : null) ||
          normalizeClubKey(club);

        let prevRank = null;
        if (prevRankMap && typeof prevRankMap.get === 'function') {
          const prRaw =
            prevRankMap.get(key) ??
            prevRankMap.get(club) ??
            prevRankMap.get(normalizeClubKey(club));
          const pr = toNumber(prRaw);
          prevRank = pr !== null ? pr : null;
        }

        if ((prevRank === null || prevRank === undefined) && prevMetricsMap && typeof prevMetricsMap.get === 'function') {
          const pm =
            prevMetricsMap.get(key) ??
            prevMetricsMap.get(club) ??
            prevMetricsMap.get(normalizeClubKey(club));
          const pr = toNumber(pm?.rank);
          if (pr !== null) prevRank = pr;
        }

        const rankDelta = prevRank !== null ? (prevRank - rankPos) : null;

        return { club, value, rankPos, key, prevRank, rankDelta, rawItem };
      })
      .filter(Boolean)
      .sort((a, b) => a.rankPos - b.rankPos)
      .slice(0, Math.max(1, Number(topN) || 20));
  }, [rows, topN, prevMetricsMap, prevRankMap]);

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

  const barData = {
    labels: clean.map((r) => r.club),
    datasets: [
      {
        label: 'IAP',
        data: clean.map((r) => r.value),
        backgroundColor: primary,
        borderWidth: 0,
        borderRadius: 10,
        barThickness: 16,
        maxBarThickness: 18,
      },
    ],
  };

  const labelsPlugin = {
    id: 'labelsPlugin',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      const dataset = chart.data.datasets[0];
      if (!meta?.data?.length) return;

      ctx.save();
      ctx.textBaseline = 'middle';

      const insideFont = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      const valueFont = '800 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      const trendFont = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';

      // Build a map from dataIndex -> bar element (explicit)
      const dataIndexToBar = new Map();
      for (let i = 0; i < meta.data.length; i += 1) {
        const bar = meta.data[i];
        const dataIndex = (bar && (bar.index ?? bar.dataIndex ?? bar._index)) ?? i;
        if (!dataIndexToBar.has(dataIndex)) dataIndexToBar.set(dataIndex, bar);
      }

      // Iterate over entries in the map (dataIndex -> bar)
      for (const [dataIndex, bar] of dataIndexToBar.entries()) {
        const row = clean[dataIndex];
        if (!row) continue;

        const props =
          typeof bar.getProps === 'function'
            ? bar.getProps(['x', 'y', 'base', 'width', 'height'], true)
            : bar;

        const xEnd = props.x;      // fim da barra
        const xStart = props.base; // início da barra
        const yMid = props.y;

        // ===== (B) TEXTO dentro da barra (posição + clube) =====
        const padIn = 10;
        const innerLeft = Math.max(xStart + padIn, chartArea.left + 4);
        const innerRight = Math.min(xEnd - padIn, chartArea.right - 4);
        const innerWidth = innerRight - innerLeft;

        ctx.font = insideFont;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';

        const insideText = `${row.rankPos}° ${row.club}`;

        if (innerWidth > 70) {
          const fullW = ctx.measureText(insideText).width;
          if (fullW <= innerWidth) {
            ctx.fillText(insideText, innerLeft, yMid);
          } else if (innerWidth > 90) {
            const short = `${row.rankPos}° ${String(row.club).slice(0, 12)}…`;
            if (ctx.measureText(short).width <= innerWidth) {
              ctx.fillText(short, innerLeft, yMid);
            }
          }
        }

        // ===== (C) VALOR fora da barra (direita): número =====
        const padOut = 10;
        const outX = Math.min(xEnd + padOut, chartArea.right - 2);

        ctx.font = valueFont;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.textAlign = 'left';

        const valueStr = fmt2(dataset.data[dataIndex]);
        ctx.fillText(valueStr, outX, yMid);

        // ===== (D) TENDÊNCIA APÓS O VALOR =====
        if (prevDateUsed && row.rankDelta !== null && row.rankDelta !== undefined) {
          let trendText = '';
          let trendColor = 'rgba(0,0,0,0.45)';
          if (row.rankDelta > 0) {
            trendText = ` ↑ ${row.rankDelta}`;
            trendColor = '#1b7f3a';
          } else if (row.rankDelta < 0) {
            trendText = ` ↓ ${Math.abs(row.rankDelta)}`;
            trendColor = '#c62828';
          } else {
            trendText = ' 0';
            trendColor = 'rgba(0,0,0,0.55)';
          }

          const valueWidth = ctx.measureText(valueStr).width;
          const spacing = 8;
          const trendX = outX + valueWidth + spacing;

          ctx.font = trendFont;
          ctx.fillStyle = trendColor;
          ctx.textAlign = 'left';
          ctx.fillText(trendText, trendX, yMid);
        }
      }

      ctx.restore();
    },
  };

  const barOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      // espaço à direita para o valor + tendência
      padding: { left: 12, right: 120 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (items) => {
            if (!items?.length) return '';
            const idx = items[0].dataIndex;
            const row = clean[idx];
            return `${row.rankPos}° ${row.club}`;
          },
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const row = clean[idx];

            const lines = [];
            lines.push(`IAP: ${fmt2(row.value)}`);

            if (prevDateUsed) {
              if (row.rankDelta === null) lines.push(`Movimento vs ${prevDateUsed}: —`);
              else if (row.rankDelta > 0) lines.push(`Movimento vs ${prevDateUsed}: ↑ ${row.rankDelta}`);
              else if (row.rankDelta < 0) lines.push(`Movimento vs ${prevDateUsed}: ↓ ${Math.abs(row.rankDelta)}`);
              else lines.push(`Movimento vs ${prevDateUsed}: 0`);
            }

            return lines;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: { display: false },
        grid: { display: false },
      },
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: { font: { size: 12 } },
      },
    },
  };

  return (
    // adiciona paddingBottom para garantir espaço visual e evitar sobreposição do próximo card
    <div style={{ height, width: '100%', paddingBottom: 20 }}>
      <Bar data={barData} options={barOptions} plugins={[labelsPlugin]} />
      {/* garante que essa mensagem fique acima de outros elementos visuais */}
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8, position: 'relative', zIndex: 2 }}>
        {prevDateUsed ? `Comparação: vs ${prevDateUsed}.` : 'Sem comparação (sem dia anterior).'} Passe o mouse/toque nas barras para detalhes.
      </div>
    </div>
  );
}
