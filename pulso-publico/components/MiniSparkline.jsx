//pulso-publico/components/MiniSparkline.jsx
'use client';

import React, { useMemo } from 'react';

/**
 * MiniSparkline - SVG sparkline muito leve
 * props:
 *  - data: array de numbers (se valores faltantes use null)
 *  - width, height
 *  - stroke: cor da linha (aceita CSS var(), hex, rgb...). Default: var(--c-1, #337d26)
 *  - strokeWidth: espessura da linha (default 1.6)
 *
 * Não depende de libs externas; ideal para inline em tabelas.
 */
export default function MiniSparkline({
  data = [],
  width = 120,
  height = 28,
  stroke = 'var(--c-1, #337d26)',
  strokeWidth = 1.6,
  ariaLabel = 'Evolução',
}) {
  const d = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return null;

    const vals = data.map((v) => (v === null || v === undefined ? null : Number(v)));
    const numeric = vals.filter((v) => v !== null && Number.isFinite(v));
    if (numeric.length === 0) return null;

    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const range = max - min || 1;
    const stepX = width / Math.max(1, vals.length - 1);

    let path = '';
    let started = false;

    for (let i = 0; i < vals.length; i += 1) {
      const v = vals[i];
      if (v === null || v === undefined || !Number.isFinite(v)) {
        started = false;
        continue;
      }
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      const seg = `${x.toFixed(2)} ${y.toFixed(2)}`;
      if (!started) {
        path += `M ${seg} `;
        started = true;
      } else {
        path += `L ${seg} `;
      }
    }

    return path || null;
  }, [data, width, height]);

  if (!d) {
    // placeholder vazio (sem linha)
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block' }}
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
