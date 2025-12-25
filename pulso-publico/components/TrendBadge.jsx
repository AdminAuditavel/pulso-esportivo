//pulso-publico/components/TrendBadge.jsx
import React from 'react';

/**
 * TrendBadge
 * props:
 *  - direction: 'up' | 'down' | 'flat'
 *  - value: number (magnitude)
 *
 * acessibilidade: aria-label descritivo
 */
export default function TrendBadge({ direction = 'flat', value = 0 }) {
  const upColor = '#16A34A';
  const downColor = '#DC2626';
  const flatColor = '#6B7280';

  if (direction === 'up') {
    return (
      <span aria-label={`Subiu ${value}`} style={{ color: upColor, fontWeight: 700 }}>
        ↑ +{value}
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span aria-label={`Caiu ${value}`} style={{ color: downColor, fontWeight: 700 }}>
        ↓ {value}
      </span>
    );
  }
  return (
    <span aria-label="Sem variação" style={{ color: flatColor, fontWeight: 700 }}>
      → 0
    </span>
  );
}
