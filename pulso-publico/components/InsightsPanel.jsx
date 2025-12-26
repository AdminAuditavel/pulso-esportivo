'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { NF } from '../lib/rankingUtils';

/* ========= Helpers locais (sem depender de rankingUtils) ========= */
function toNumber(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'string' ? Number(String(x).replace(',', '.')) : Number(x);
  return Number.isFinite(n) ? n : null;
}

function getDisplayName(it) {
  return (it && ((it.club && it.club.name) || it.club_name || it.name || it.club || it.label)) || '—';
}

function normalizeClubKey(name) {
  const s = String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Score robusto: seu ranking diário usa value */
function pickScore(it) {
  return toNumber(
    it?.value ??
      it?._computed_value ??
      it?.iap_score ??
      it?.score ??
      it?.iap ??
      null
  );
}

export default function InsightsPanel({
  tableItems = [],
  prevMetricsMap = new Map(),
  prevDateUsed = '',
  effectiveDate = '',
  linkClub = (n) => `/club/${encodeURIComponent(n)}`,
}) {
  const insights = useMemo(() => {
    if (!Array.isArray(tableItems) || tableItems.length === 0) return null;

    const first = tableItems[0];
    const leaderName = getDisplayName(first);
    const leaderScore = pickScore(first);

    let maxVol = null;
    let maxVolName = null;

    let bestSent = null;
    let bestSentName = null;
    let worstSent = null;
    let worstSentName = null;

    let bestUp = null;
    let bestDown = null;

    for (let i = 0; i < tableItems.length; i += 1) {
      const it = tableItems[i];
      const name = getDisplayName(it);
      if (!name || name === '—') continue;

      const key =
        (it && (it.__club_key || it._club_key)) ? String(it.__club_key || it._club_key) : normalizeClubKey(name);

      const currScore = pickScore(it);
      const currVol = toNumber(it?.volume_total);
      const currSent = toNumber(it?.sentiment_score);

      // volume
      if (currVol !== null) {
        if (maxVol === null || currVol > maxVol) {
          maxVol = currVol;
          maxVolName = name;
        }
      }

      // sentimento
      if (currSent !== null) {
        if (bestSent === null || currSent > bestSent) {
          bestSent = currSent;
          bestSentName = name;
        }
        if (worstSent === null || currSent < worstSent) {
          worstSent = currSent;
          worstSentName = name;
        }
      }

      // prev lookup: tenta display e key normalizada (porque você salva ambas)
      const prev =
        prevMetricsMap.get(name) ??
        prevMetricsMap.get(key) ??
        null;

      const prevScore = prev ? toNumber(prev.score ?? prev.value ?? prev.iap_score ?? prev.iap ?? null) : null;

      if (currScore !== null && prevScore !== null) {
        const delta = currScore - prevScore;

        if (!bestUp || delta > bestUp.delta) bestUp = { name, delta, prev: prevScore, curr: currScore };
        if (!bestDown || delta < bestDown.delta) bestDown = { name, delta, prev: prevScore, curr: currScore };
      }
    }

    return {
      leader: { name: leaderName, score: leaderScore },

      maxVol: maxVolName ? { name: maxVolName, value: maxVol } : null,
      bestSent: bestSentName ? { name: bestSentName, value: bestSent } : null,
      worstSent: worstSentName ? { name: worstSentName, value: worstSent } : null,

      bestUp,
      bestDown,

      hasPrev: Boolean(prevDateUsed && prevMetricsMap && prevMetricsMap.size > 0),
      effectiveDate,
      prevDateUsed,
    };
  }, [tableItems, prevMetricsMap, prevDateUsed, effectiveDate]);

  if (!insights) return <div style={{ fontSize: 12, opacity: 0.8 }}>Sem dados.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
      <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Líder do dia</div>
        <div style={{ fontSize: 14 }}>
          <Link href={linkClub(insights.leader.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
            {insights.leader.name}
          </Link>{' '}
          {insights.leader.score !== null ? (
            <span style={{ opacity: 0.85 }}>({NF.format(insights.leader.score)})</span>
          ) : null}
        </div>
      </div>

      <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Maior alta de IAP (Δ)</div>
        {insights.hasPrev && insights.bestUp ? (
          <div style={{ fontSize: 14 }}>
            <Link href={linkClub(insights.bestUp.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
              {insights.bestUp.name}
            </Link>{' '}
            <span style={{ color: '#16A34A', fontWeight: 700 }}>+{insights.bestUp.delta.toFixed(2)}</span>{' '}
            <span style={{ opacity: 0.75 }}>
              ({insights.bestUp.prev.toFixed(2)} → {insights.bestUp.curr.toFixed(2)})
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            — (IAP ausente para esta data ou para o dia anterior; impossível calcular Δ)
          </div>
        )}
      </div>

      <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Maior queda de IAP (Δ)</div>
        {insights.hasPrev && insights.bestDown ? (
          <div style={{ fontSize: 14 }}>
            <Link href={linkClub(insights.bestDown.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
              {insights.bestDown.name}
            </Link>{' '}
            <span style={{ color: '#DC2626', fontWeight: 700 }}>{insights.bestDown.delta.toFixed(2)}</span>{' '}
            <span style={{ opacity: 0.75 }}>
              ({insights.bestDown.prev.toFixed(2)} → {insights.bestDown.curr.toFixed(2)})
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            — (IAP ausente para esta data ou para o dia anterior; impossível calcular Δ)
          </div>
        )}
      </div>

      <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Maior volume do dia</div>
        {insights.maxVol ? (
          <div style={{ fontSize: 14 }}>
            <Link href={linkClub(insights.maxVol.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
              {insights.maxVol.name}
            </Link>{' '}
            <span style={{ opacity: 0.85 }}>({NF.format(insights.maxVol.value)})</span>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.8 }}>—</div>
        )}
      </div>

      <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Sentimento do dia (melhor / pior)</div>
        <div style={{ fontSize: 13, display: 'grid', gap: 4 }}>
          {insights.bestSent ? (
            <div>
              <Link href={linkClub(insights.bestSent.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
                {insights.bestSent.name}
              </Link>{' '}
              <span style={{ color: '#16A34A', fontWeight: 700 }}>{insights.bestSent.value.toFixed(2)}</span>
            </div>
          ) : (
            <div style={{ opacity: 0.8 }}>—</div>
          )}

          {insights.worstSent ? (
            <div>
              <Link href={linkClub(insights.worstSent.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
                {insights.worstSent.name}
              </Link>{' '}
              <span style={{ color: '#DC2626', fontWeight: 700 }}>{insights.worstSent.value.toFixed(2)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
