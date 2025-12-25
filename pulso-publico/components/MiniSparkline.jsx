//pulso-publico/components/MiniSparkline.jsx
import React from 'react';

/**
 * MiniSparkline - SVG sparkline muito leve
 * props:
 *  - data: array de numbers (se valores faltantes use null)
 *  - width, height
 *
 * Não depende de libs externas; ideal para inline em tabelas.
 */
export default function MiniSparkline({ data = [], width = 120, height = 28, stroke = '#243a69' }) {
  if (!Array.isArray(data) || data.length === 0) {
    // placeholder vazio
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
      </svg>
    );
  }

  const vals = data.map((v) => (v === null || v === undefined ? null : Number(v)));
  const numeric = vals.filter((v) => v !== null && Number.isFinite(v));
  if (numeric.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
      </svg>
    );
  }

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;

  const stepX = width / Math.max(1, vals.length - 1);

  const points = vals.map((v, i) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y];
  });

  // build path skipping nulls (span gaps = false)
  let d = '';
  let started = false;
  points.forEach((p) => {
    if (!p) {
      started = false;
      return;
    }
    if (!started) {
      d += `M ${p[0].toFixed(2)} ${p[1].toFixed(2)} `;
      started = true;
    } else {
      d += `L ${p[0].toFixed(2)} ${p[1].toFixed(2)} `;
    }
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
