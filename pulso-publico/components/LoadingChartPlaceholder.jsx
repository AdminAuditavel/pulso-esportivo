//pulso-publico/components/LoadingChartPlaceholder.jsx

import React from 'react';
import Skeleton from './Skeleton';

/**
 * Placeholder para charts com altura fixa
 * props:
 *  - height (number) optional
 */
export default function LoadingChartPlaceholder({ height = 360 }) {
  return (
    <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '92%', display: 'grid', gap: 8 }}>
        <Skeleton height={16} />
        <Skeleton height={8} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width="30%" height={8} />
          <Skeleton width="30%" height={8} />
          <Skeleton width="30%" height={8} />
        </div>
        <div style={{ height: height - 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton height={height - 100} />
        </div>
      </div>
    </div>
  );
}
