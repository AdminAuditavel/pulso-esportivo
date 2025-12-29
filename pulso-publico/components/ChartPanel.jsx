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

/**
 * ChartPanel (Ranking chart)
 * Props:
 *  - rows: [{ club, value, rawItem, __club_key, ... }]
 *  - loading: bool
 *  - height: number (px)
 *  - topN: number
 *  - prevMetricsMap: Map(key -> { rank, score/iap/value, ... }) (opcional)
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

    return arr
      .map((r, idx) => {
        const club = r?.club;
        const rawItem = r?.rawItem ?? r;
        const value = toNumber(r?.value ?? r?.score ?? r?.iap ?? r?.iap_score ?? null);

        if (!club || club === '—' || value === null) return null;

        const rankPos = Number(rawItem?.rank_position) || idx + 1;

        const key = r?.__club_key || rawItem?.__club_key || normalizeClubKey(club);

        // prev rank (para ↑/↓)
        let prevRank = null;
        if (prevMetricsMap && typeof prevMetricsMap.get === 'function') {
          const pm =
            prevMetricsMap.get(key) ??
            prevMetricsMap.get(club) ??
            prevMetricsMap.get(normalizeClubKey(club));

          const pr = toNumber(pm?.rank);
          prevRank = pr !== null ? pr : null;
        }

        // delta rank: positivo = subiu (melhorou)
        // ex: prevRank=19, curr=1 => delta=18 (↑ 18)
        let rankDelta = null;
        if (prevRank !== null) {
          rankDelta = prevRank - rankPos;
        }

        return {
          club,
          value,
          rankPos,
          key,
          prevRank,
          rankDelta,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.rankPos - b.rankPos)
      .slice(0, Math.max(1, Number(topN) || 20));
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

  const barData = {
    // labels aqui não serão exibidos (vamos desenhar dentro da barra)
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

  // Plugin custom: desenha texto dentro da barra
  const barInnerLabelsPlugin = {
    id: 'barInnerLabels',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      const dataset = chart.data.datasets[0];

      if (!meta?.data?.length) return;

      ctx.save();
      ctx.textBaseline = 'middle';

      // fontes (ajuste fino)
      const leftFont = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      const rightFont = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';

      for (let i = 0; i < meta.data.length; i += 1) {
        const bar = meta.data[i];
        const row = clean[i];
        const value = dataset.data[i];

        // coordenadas do retângulo da barra
        // bar é um elemento; getProps é mais robusto em versões diferentes
        const props = typeof bar.getProps === 'function'
          ? bar.getProps(['x', 'y', 'base', 'width', 'height'], true)
          : bar;

        const xEnd = props.x;          // final da barra (direita)
        const xStart = props.base;     // início da barra (esquerda)
        const yMid = props.y;

        // padding interno
        const padLeft = 10;
        const padRight = 10;

        // garante que desenhamos somente dentro da área útil
        const leftX = Math.max(xStart + padLeft, chartArea.left + 4);
        const rightX = Math.min(xEnd - padRight, chartArea.right - 4);

        // label esquerda: "1° . Chapecoense ↑ 18"
        let trendTxt = '';
        if (row.rankDelta !== null) {
          const d = row.rankDelta;
          if (d > 0) trendTxt = `↑ ${d}`;
          else if (d < 0) trendTxt = `↓ ${Math.abs(d)}`;
          else trendTxt = '• 0';
        } else if (prevDateUsed) {
          // existe prevDateUsed, mas sem match desse clube no dia anterior
          trendTxt = '• —';
        } else {
          // sem dia anterior
          trendTxt = '';
        }

        const leftText = `${row.rankPos}° . ${row.club}${trendTxt ? ' ' + trendTxt : ''}`;

        // label direita: "IAP: 78.59"
        const rightText = `IAP: ${fmt2(value)}`;

        // escolha de cor do texto (dentro da barra verde)
        ctx.fillStyle = '#ffffff';

        // desenha esquerda
        ctx.font = leftFont;
        // evita desenhar se a barra for curta demais
        if (rightX - leftX > 80) {
          ctx.fillText(leftText, leftX, yMid);
        }

        // desenha direita (alinhado à direita)
        ctx.font = rightFont;
        ctx.textAlign = 'right';
        if (rightX - leftX > 60) {
          ctx.fillText(rightText, rightX, yMid);
        }
        ctx.textAlign = 'left';
      }

      ctx.restore();
    },
  };

  const barOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (items) => {
            if (!items?.length) return '';
            const idx = items[0].dataIndex;
            const row = clean[idx];
            return `${row.rankPos}° • ${row.club}`;
          },
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const row = clean[idx];

            const lines = [];
            lines.push(`IAP: ${fmt2(row.value)}`);

            // rank delta
            if (prevDateUsed) {
              if (row.rankDelta === null) {
                lines.push(`Movimento vs ${prevDateUsed}: —`);
              } else if (row.rankDelta > 0) {
                lines.push(`Movimento vs ${prevDateUsed}: ↑ ${row.rankDelta}`);
              } else if (row.rankDelta < 0) {
                lines.push(`Movimento vs ${prevDateUsed}: ↓ ${Math.abs(row.rankDelta)}`);
              } else {
                lines.push(`Movimento vs ${prevDateUsed}: 0`);
              }
            }

            return lines;
          },
        },
      },
    },
    scales: {
      y: {
        // vamos esconder ticks porque o texto já vai dentro da barra
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
    <div style={{ height, width: '100%' }}>
      <Bar data={barData} options={barOptions} plugins={[barInnerLabelsPlugin]} />
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
        {prevDateUsed ? `Comparação: vs ${prevDateUsed}.` : 'Sem comparação (sem dia anterior).'}
        {' '}Passe o mouse/toque nas barras para detalhes.
      </div>
    </div>
  );
}
