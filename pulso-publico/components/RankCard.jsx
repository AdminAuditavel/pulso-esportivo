//pulso-publico/components/RankCard.jsx

'use client';

import React from 'react';
import Link from 'next/link';
import MiniSparkline from './MiniSparkline';
import PlatformBreakdown from './PlatformBreakdown';
import TrendBadge from './TrendBadge';

/**
 * RankCard
 * Props:
 *  - rank (number)
 *  - item (raw item from /api/daily_ranking)
 *  - prevRankMap (Map<string, number>) optional — para calcular delta de posição
 *
 * Exibe: posição, nome, IAP (formatado), delta vs dia anterior (TrendBadge), sparkline (se houver),
 * breakdown por plataforma (PlatformBreakdown) e CTA para detalhe do clube.
 */

const NF = new Intl.NumberFormat('pt-BR');

function getClubName(item) {
  if (!item) return '—';
  if (item.club && typeof item.club === 'object' && (item.club.name || item.club.club_name)) {
    return item.club.name ?? item.club.club_name;
  }
  if (item.club_name) return item.club_name;
  if (item.name) return item.name;
  if (item.club) {
    if (typeof item.club === 'string') return item.club;
    try { return JSON.stringify(item.club); } catch {}
  }
  if (item.club_id) return String(item.club_id).slice(0, 8) + '…';
  return '—';
}

export default function RankCard({ rank, item = {}, prevRankMap = new Map() }) {
  const name = getClubName(item);
  const iap = item?.score ?? item?.iap ?? null;
  const iapNum = iap === null || iap === undefined ? null : Number(String(iap).replace(',', '.'));
  const series = Array.isArray(item?.series) ? item.series.map((s) => (s && s.value ? Number(String(s.value).replace(',', '.')) : null)) : [];

  const currRank = Number(item?.rank_position) || rank;
  const prev = prevRankMap.get(name);
  let trend = null;
  if (prev !== undefined && prev !== null && currRank) {
    const delta = prev - currRank;
    if (delta > 0) trend = { direction: 'up', value: delta };
    else if (delta < 0) trend = { direction: 'down', value: Math.abs(delta) };
    else trend = { direction: 'flat', value: 0 };
  }

  return (
    <article style={{
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: 12,
      padding: 12,
      background: '#fff',
      boxShadow: '0 8px 20px rgba(36,58,105,0.04)'
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#243a69', width: 46, textAlign: 'center' }}>{currRank}</div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ fontWeight: 800, color: '#191013' }}>
              <Link href={`/club/${encodeURIComponent(name)}`} style={{ textDecoration: 'none', color: 'inherit' }}>{name}</Link>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{iapNum !== null && !Number.isNaN(iapNum) ? NF.format(iapNum) : '—'}</div>
                <div style={{ fontSize: 12, color: '#6b6b6b' }}>IAP</div>
              </div>

              <div style={{ minWidth: 60 }}>
                {trend ? <TrendBadge direction={trend.direction} value={trend.value} /> : <span style={{ opacity: 0.6 }}>—</span>}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <MiniSparkline data={series} width={220} height={34} stroke="#243a69" />
            </div>

            <div style={{ marginLeft: 12 }}>
              <PlatformBreakdown item={item} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
