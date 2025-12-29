//components/ChartPanel.jsx
'use client';

import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import LoadingChartPlaceholder from './LoadingChartPlaceholder';
import { MANUAL_PALETTE } from '../lib/rankingUtils';
import ctrlStyles from './controls.module.css';

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
  // altura base (usada apenas como fallback)
  height = 640,
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

        // prevRank via prevRankMap (preferido)
        let prevRank = null;
        if (prevRankMap && typeof prevRankMap.get === 'function') {
          const prRaw =
            prevRankMap.get(key) ??
            prevRankMap.get(club) ??
            prevRankMap.get(normalizeClubKey(club));
          const pr = toNumber(prRaw);
          prevRank = pr !== null ? pr : null;
        }

        // fallback: prevMetricsMap pode ter rank e score
        let prevScore = null;
        if ((prevRank === null || prevRank === undefined) && prevMetricsMap && typeof prevMetricsMap.get === 'function') {
          const pm =
            prevMetricsMap.get(key) ??
            prevMetricsMap.get(club) ??
            prevMetricsMap.get(normalizeClubKey(club));
          const pr = toNumber(pm?.rank);
          if (pr !== null) prevRank = pr;
          const ps = toNumber(pm?.score ?? pm?.iap ?? pm?.iap_score ?? pm?.value);
          prevScore = ps;
        } else if (prevMetricsMap && typeof prevMetricsMap.get === 'function') {
          const pm =
            prevMetricsMap.get(key) ??
            prevMetricsMap.get(club) ??
            prevMetricsMap.get(normalizeClubKey(club));
          const ps = toNumber(pm?.score ?? pm?.iap ?? pm?.iap_score ?? pm?.value);
          prevScore = ps;
        }

        const rankDelta = prevRank !== null ? (prevRank - rankPos) : null;

        return { club, value, rankPos, key, prevRank, prevScore, rankDelta, rawItem };
      })
      .filter(Boolean)
      .sort((a, b) => a.rankPos - b.rankPos)
      .slice(0, Math.max(1, Number(topN) || 20));
  }, [rows, topN, prevMetricsMap, prevRankMap]);

  if (loading) {
    return (
      <section className={ctrlStyles.topicCard} style={{ minHeight: height }}>
        <LoadingChartPlaceholder height={height} />
      </section>
    );
  }

  if (clean.length === 0) {
    return (
      <section className={ctrlStyles.topicCard} style={{ minHeight: height }}>
        <div style={{ height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }}>
          Sem dados para plotar.
        </div>
      </section>
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
        barThickness: 18,
        maxBarThickness: 22,
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

      const insideFont = '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      // valor: fonte menor e sem negrito (peso 400)
      const valueFont = '400 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';

      // mapeia explicitamente dataIndex -> elemento gráfico
      const dataIndexToBar = new Map();
      for (let i = 0; i < meta.data.length; i += 1) {
        const bar = meta.data[i];
        const dataIndex = (bar && (bar.index ?? bar.dataIndex ?? bar._index)) ?? i;
        if (!dataIndexToBar.has(dataIndex)) dataIndexToBar.set(dataIndex, bar);
      }

      for (const [dataIndex, bar] of dataIndexToBar.entries()) {
        const idx = Number(dataIndex);
        const row = clean[idx];
        if (!row) continue;

        const props =
          typeof bar.getProps === 'function'
            ? bar.getProps(['x', 'y', 'base', 'width', 'height'], true)
            : bar;

        const xEnd = props.x;
        const xStart = props.base;
        const yMid = props.y;

        // TEXTO DENTRO DA BARRA
        const padIn = 12;
        const innerLeft = Math.max(xStart + padIn, chartArea.left + 6);
        const innerRight = Math.min(xEnd - padIn, chartArea.right - 6);
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
            const short = `${row.rankPos}° ${String(row.club).slice(0, 14)}…`;
            if (ctx.measureText(short).width <= innerWidth) ctx.fillText(short, innerLeft, yMid);
          }
        }

        // VALOR À DIREITA (apenas o valor; sem desenho de tendência aqui)
        const padOut = 12;
        const outX = Math.min(xEnd + padOut, chartArea.right - 8);

        ctx.font = valueFont;
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.textAlign = 'left';

        const valueStr = fmt2(dataset.data[idx]);
        ctx.fillText(valueStr, outX, yMid);
      }

      ctx.restore();
    },
  };

  const barOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      // padding right reduzido; tendência aparece só no tooltip
      padding: { left: 12, right: 48 },
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
              if (row.rankDelta === null) {
                // fallback por prevScore no tooltip quando não há rankDelta
                if (row.prevScore !== null && row.prevScore !== undefined) {
                  const ds = Number((row.value - row.prevScore));
                  if (!Number.isNaN(ds)) {
                    lines.push(`Movimento vs ${prevDateUsed}: ${ds > 0 ? `↑ ${ds.toFixed(2)}` : ds < 0 ? `↓ ${Math.abs(ds).toFixed(2)}` : '0'}`);
                  } else {
                    lines.push(`Movimento vs ${prevDateUsed}: —`);
                  }
                } else {
                  lines.push(`Movimento vs ${prevDateUsed}: —`);
                }
              } else if (row.rankDelta > 0) lines.push(`Movimento vs ${prevDateUsed}: ↑ ${row.rankDelta}`);
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
        ticks: { font: { size: 13 } },
      },
    },
  };

  // altura do card: ocupa quase todo o viewport para dar efeito "full screen card"
  const cardHeight = `calc(100vh - 140px)`; // ajuste se necessário

  return (
    <section className={ctrlStyles.topicCard} style={{ height: cardHeight, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Ranking — gráfico amplo</div>

      <div style={{ flex: 1, minHeight: 240 }}>
        <Bar data={barData} options={barOptions} plugins={[labelsPlugin]} />
      </div>

      <div style={{ fontSize: 13, opacity: 0.8 }}>
        {prevDateUsed ? `Comparação: vs ${prevDateUsed}.` : 'Sem comparação (sem dia anterior).'} Passe o mouse/toque nas barras para detalhes.
      </div>
    </section>
  );
}
