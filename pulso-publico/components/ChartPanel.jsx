//components/ChartPanel.jsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import LoadingChartPlaceholder from './LoadingChartPlaceholder';
import { MANUAL_PALETTE } from '../lib/rankingUtils';
import ctrlStyles from './controls.module.css';
import '../styles/chart-tooltip.css';

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
function formatDateBRdash(isoYmd) {
  if (!isoYmd) return '';
  const s = String(isoYmd).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
// color helpers
function lerp(a, b, t) { return a + (b - a) * t; }
function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const bigint = parseInt(full, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function rgbToHex(r, g, b) {
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function lerpColorHex(aHex, bHex, t) {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return rgbToHex(r, g, bl);
}

export default function ChartPanel({
  rows = [],
  loading = false,
  height = 640,
  topN = 20,
  prevMetricsMap = null,
  prevRankMap = null,
  prevDateUsed = '',
  effectiveDate = '',
}) {
  const primary = MANUAL_PALETTE[0] ?? '#337d26';

  // track viewport width to adapt layout (client-side)
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    function onResize() { setVw(window.innerWidth); }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isNarrow = vw < 520; // breakpoint mobile
  const cardHeight = isNarrow ? `calc(100vh - 100px)` : `calc(100vh - 140px)`;
  const datasetBarThickness = isNarrow ? 12 : 18;
  const datasetMaxBarThickness = isNarrow ? 14 : 22;
  const layoutPadding = { left: isNarrow ? 8 : 12, right: isNarrow ? 24 : 48 };

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

  // color ramp settings
  const greenLight = '#d7f4e0';
  const greenDark = '#1b7f3a';
  const redLight = '#f7d6d6';
  const redDark = '#c62828';
  const neutral = '#6c9bd1';

  const absDeltas = clean.map((r) => (r.rankDelta !== null && r.rankDelta !== undefined ? Math.abs(Number(r.rankDelta)) : 0));
  const maxAbsDelta = Math.max(...absDeltas, 1);

  const bgColors = clean.map((r) => {
    if (!prevDateUsed) return primary;
    if (r.rankDelta === null || r.rankDelta === undefined) return neutral;
    const t = Math.min(Math.abs(Number(r.rankDelta)) / maxAbsDelta, 1);
    if (r.rankDelta > 0) return lerpColorHex(greenLight, greenDark, t);
    if (r.rankDelta < 0) return lerpColorHex(redLight, redDark, t);
    return neutral;
  });

  const barData = {
    labels: clean.map((r) => r.club),
    datasets: [
      {
        label: 'IAP',
        data: clean.map((r) => r.value),
        backgroundColor: bgColors,
        borderWidth: 0,
        borderRadius: 10,
        barThickness: datasetBarThickness,
        maxBarThickness: datasetMaxBarThickness,
      },
    ],
  };

  // plugin draws text; adapts to chart.width for mobile
  const labelsPlugin = {
    id: 'labelsPlugin',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      const dataset = chart.data.datasets[0];
      if (!meta?.data?.length) return;

      const small = (chart.width && chart.width < 520) || isNarrow;
      const insideFont = small ? '600 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial' : '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      const valueFont = small ? '400 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial' : '400 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      const padIn = small ? 8 : 12;
      const padOut = small ? 8 : 12;

      ctx.save();
      ctx.textBaseline = 'middle';

      for (let i = 0; i < meta.data.length; i += 1) {
        const bar = meta.data[i];
        const dataIndex = i;
        const row = clean[dataIndex];
        if (!row) continue;

        const props = typeof bar.getProps === 'function' ? bar.getProps(['x', 'y', 'base', 'width', 'height'], true) : bar;
        const xEnd = props.x;
        const xStart = props.base;
        const yMid = props.y;

        const innerLeft = Math.max(xStart + padIn, chartArea.left + 6);
        const innerRight = Math.min(xEnd - padIn, chartArea.right - 6);
        const innerWidth = innerRight - innerLeft;

        // choose text color depending on bar color luminance
        const barColor = bgColors[dataIndex] || primary;
        const barRgb = hexToRgb(barColor);
        const luminance = 0.2126 * barRgb.r + 0.7152 * barRgb.g + 0.0722 * barRgb.b;
        const insideTextColor = luminance > 180 ? 'rgba(0,0,0,0.85)' : '#ffffff';

        ctx.font = insideFont;
        ctx.fillStyle = insideTextColor;
        ctx.textAlign = 'left';

        const insideText = `${row.rankPos}° ${row.club}`;

        // if bar interior is wide enough, draw inside; else draw truncated (short) or attempt to draw slightly outside to avoid hiding last label
        if (innerWidth > 60) {
          const fullW = ctx.measureText(insideText).width;
          if (fullW <= innerWidth) {
            ctx.fillText(insideText, innerLeft, yMid);
          } else {
            // try a shorter label
            const short = `${row.rankPos}° ${String(row.club).slice(0, Math.max(6, small ? 8 : 12))}…`;
            ctx.fillText(short, innerLeft, yMid);
          }
        } else {
          // interior too small: draw club name to the left of the bar (if there's space), otherwise draw short label inside
          const leftX = Math.max(chartArea.left + 6, xStart - 8 - 120); // attempt left of bar with cap
          ctx.textAlign = 'right';
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          const shortLeft = `${row.rankPos}° ${String(row.club).slice(0, Math.max(4, small ? 6 : 8))}…`;
          ctx.font = valueFont;
          ctx.fillText(shortLeft, leftX, yMid);
        }

        // draw value at right
        const outX = Math.min(xEnd + padOut, chartArea.right - 8);
        ctx.font = valueFont;
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.textAlign = 'left';
        const valueStr = fmt2(dataset.data[dataIndex]);
        ctx.fillText(valueStr, outX, yMid);
      }

      ctx.restore();
    },
  };

  // external tooltip (unchanged behavior) appended to body (position: fixed)
  const externalTooltip = (context) => {
    const tooltip = context.tooltip;
    const chart = context.chart;
    const body = document.body;

    let tooltipEl = body.querySelector('.chartjs-custom-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'chartjs-custom-tooltip';
      tooltipEl.style.position = 'fixed';
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.transition = 'all .06s ease';
      tooltipEl.style.background = 'rgba(255,255,255,0.98)';
      tooltipEl.style.color = '#111';
      tooltipEl.style.padding = '8px 10px';
      tooltipEl.style.borderRadius = '6px';
      tooltipEl.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial";
      tooltipEl.style.fontSize = '13px';
      tooltipEl.style.lineHeight = '1.2';
      tooltipEl.style.whiteSpace = 'nowrap';
      tooltipEl.style.zIndex = 9999;
      tooltipEl.style.border = '1px solid rgba(0,0,0,0.06)';
      tooltipEl.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
      body.appendChild(tooltipEl);
    }

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      tooltipEl.style.pointerEvents = 'none';
      return;
    }

    const dataPoint = tooltip.dataPoints && tooltip.dataPoints[0];
    if (!dataPoint) {
      tooltipEl.style.opacity = '0';
      return;
    }

    const dataIndex = dataPoint.dataIndex;
    const row = clean[dataIndex];

    let arrowText = '';
    let arrowColor = '#666';
    if (row) {
      if (row.rankDelta !== null && row.rankDelta !== undefined) {
        if (row.rankDelta > 0) {
          arrowText = `↑${row.rankDelta}`;
          arrowColor = '#1b7f3a';
        } else if (row.rankDelta < 0) {
          arrowText = `↓${Math.abs(row.rankDelta)}`;
          arrowColor = '#c62828';
        } else {
          arrowText = '0';
          arrowColor = '#666';
        }
      } else if (row.prevScore !== null && row.prevScore !== undefined) {
        const ds = Number(row.value - row.prevScore);
        if (!Number.isNaN(ds)) {
          if (ds > 0) {
            arrowText = `↑${ds.toFixed(2)}`;
            arrowColor = '#1b7f3a';
          } else if (ds < 0) {
            arrowText = `↓${Math.abs(ds).toFixed(2)}`;
            arrowColor = '#c62828';
          } else {
            arrowText = '0';
            arrowColor = '#666';
          }
        }
      }
    }

    const baseLabel = effectiveDate ? formatDateBRdash(String(effectiveDate).slice(0, 10)) : '';
    const prevLabel = prevDateUsed ? formatDateBRdash(String(prevDateUsed).slice(0, 10)) : '';

    const titleText = row ? `${row.rankPos}° ${row.club}` : (chart.data.labels && chart.data.labels[dataIndex]) || '';
    const arrowHtml = arrowText ? `<strong style="color: ${arrowColor}; margin-left:8px; font-weight:700;">${arrowText}</strong>` : '';
    const titleHtml = `<div style="font-weight:700; display:flex; gap:8px; align-items:center;">${escapeHtml(titleText)}${arrowHtml}</div>`;

    let datesHtml = '';
    if (baseLabel && prevLabel) {
      datesHtml = `<div style="font-weight:500; margin-top:4px; opacity:0.95;">${escapeHtml(baseLabel)} vs ${escapeHtml(prevLabel)}</div>`;
    } else if (baseLabel) {
      datesHtml = `<div style="font-weight:500; margin-top:4px; opacity:0.95;">${escapeHtml(baseLabel)}</div>`;
    } else if (prevLabel) {
      datesHtml = `<div style="font-weight:500; margin-top:4px; opacity:0.95;">vs ${escapeHtml(prevLabel)}</div>`;
    }

    tooltipEl.innerHTML = `${titleHtml}${datesHtml}`;

    // position using bar element coords (viewport)
    const meta = chart.getDatasetMeta(0);
    const bar = meta && meta.data && meta.data[dataIndex];
    let sourceViewportX = null;
    let sourceViewportY = null;

    if (bar) {
      const props =
        typeof bar.getProps === 'function'
          ? bar.getProps(['x', 'y', 'base', 'width', 'height'], true)
          : bar;
      const canvasRect = chart.canvas.getBoundingClientRect();
      if (props && typeof props.x === 'number' && typeof props.y === 'number') {
        sourceViewportX = canvasRect.left + props.x;
        sourceViewportY = canvasRect.top + props.y;
      } else if (bar && (bar.x || bar.y)) {
        sourceViewportX = canvasRect.left + (bar.x ?? 0);
        sourceViewportY = canvasRect.top + (bar.y ?? 0);
      }
    }

    if (sourceViewportX === null || sourceViewportY === null) {
      const canvasRect = chart.canvas.getBoundingClientRect();
      const caretX = tooltip.caretX ?? canvasRect.width / 2;
      const caretY = tooltip.caretY ?? canvasRect.height / 2;
      sourceViewportX = canvasRect.left + caretX;
      sourceViewportY = canvasRect.top + caretY;
    }

    tooltipEl.style.left = '0px';
    tooltipEl.style.top = '0px';
    tooltipEl.style.opacity = '0';
    tooltipEl.style.display = 'block';

    const rect = tooltipEl.getBoundingClientRect();
    const ttWidth = rect.width || 160;
    const ttHeight = rect.height || 40;

    let left = sourceViewportX - ttWidth / 2;
    const minLeft = 8;
    const maxLeft = window.innerWidth - ttWidth - 8;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    const gap = 6;
    const topAbove = sourceViewportY - ttHeight - gap;
    const topBelow = sourceViewportY + gap;
    const minTop = 8;
    const maxTop = window.innerHeight - ttHeight - 8;

    let top;
    if (topAbove >= minTop) top = topAbove;
    else if (topBelow <= maxTop) top = topBelow;
    else top = Math.min(Math.max(topAbove, minTop), maxTop);

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.style.opacity = '1';
    tooltipEl.style.pointerEvents = 'none';
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const barOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: layoutPadding },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: externalTooltip,
      },
    },
    scales: {
      y: { ticks: { display: false }, grid: { display: false } },
      x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: isNarrow ? 12 : 13 } } },
    },
  };

  return (
    <section className={ctrlStyles.topicCard} style={{ height: cardHeight, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Ranking — gráfico amplo</div>

      <div style={{ flex: 1, minHeight: 240 }}>
        <Bar data={barData} options={barOptions} plugins={[labelsPlugin]} />
      </div>

      <div style={{ fontSize: 13, opacity: 0.8 }}>
        {effectiveDate ? `${formatDateBRdash(effectiveDate)} (base)` : ''}
        {effectiveDate && prevDateUsed ? ' • ' : ''}
        {prevDateUsed ? `${formatDateBRdash(prevDateUsed)} (anterior)` : ''}
        {(!effectiveDate && !prevDateUsed) ? 'Sem comparação (sem dia anterior).' : ''} Passe o mouse/toque nas barras para detalhes.
      </div>
    </section>
  );
}
