// pulso-publico/components/Ranking.jsx
'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

import fetcher from './hooks/useFetcher';
import TrendBadge from './TrendBadge';
import MiniSparkline from './MiniSparkline';
import Skeleton from './Skeleton';
import LoadingChartPlaceholder from './LoadingChartPlaceholder';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

// Formatter PT-BR
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
    try {
      return JSON.stringify(item.club);
    } catch {
      // ignore
    }
  }
  if (item.club_id) return String(item.club_id).slice(0, 8) + '…';
  return '—';
}

function toNumber(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'string' ? Number(String(x).replace(',', '.')) : Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeSeries(series) {
  const arr = (Array.isArray(series) ? series : [])
    .map((r) => ({
      date: r?.date ? String(r.date).slice(0, 10) : null,
      value: toNumber(r?.value),
    }))
    .filter((r) => r.date && r.value !== null);

  arr.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return arr;
}

function getAggregationDateFromItem(item) {
  const d = item?.aggregation_date ?? item?.metric_date ?? item?.date;
  return d ? String(d).slice(0, 10) : '';
}

function prevDay(yyyyMMdd) {
  if (!yyyyMMdd) return '';
  const p = yyyyMMdd.split('-');
  if (p.length !== 3) return '';
  const dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateBR(yyyyMMdd) {
  if (!yyyyMMdd) return '—';
  const s = String(yyyyMMdd).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Paleta manual para comparação
const MANUAL_PALETTE = ['#2563EB', '#16A34A', '#7C3AED', '#DC2626', '#0EA5E9'];
const COLOR_A = '#2563EB';
const COLOR_B = '#F97316';

export default function Ranking() {
  // filtros
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedClub, setSelectedClub] = useState('');

  // SWR: daily ranking
  const rankingKey = selectedDate ? `/api/daily_ranking?date=${encodeURIComponent(selectedDate)}` : '/api/daily_ranking';
  const { data: rankingJson, error: rankingError, isValidating: rankingLoading, mutate: mutateRanking } = useSWR(rankingKey, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: true,
  });

  // descompacta envelope se houver
  const rankingArr = Array.isArray(rankingJson) ? rankingJson : Array.isArray(rankingJson?.data) ? rankingJson.data : [];
  // resolved_date caso backend retorne envelope
  const resolvedDate = rankingJson && !Array.isArray(rankingJson) && rankingJson?.resolved_date ? String(rankingJson.resolved_date).slice(0, 10) : '';
  const requestedDate = selectedDate ? selectedDate : '';

  // SWR: clubs list
  const { data: clubsJson, error: clubsError, isValidating: clubsLoading, mutate: mutateClubs } = useSWR('/api/clubs', fetcher, {
    revalidateOnFocus: false,
  });
  const clubs = Array.isArray(clubsJson) ? clubsJson : [];

  // prev-day fetch (mantemos AbortController para esse caso específico)
  const prevFetchCtrlRef = useRef(null);
  const [prevRankMap, setPrevRankMap] = useState(new Map());
  const [prevMetricsMap, setPrevMetricsMap] = useState(new Map());
  const [prevDateUsed, setPrevDateUsed] = useState('');
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevError, setPrevError] = useState(null);

  const effectiveDate = resolvedDate || selectedDate || (rankingArr?.[0] ? getAggregationDateFromItem(rankingArr[0]) : '');

  useEffect(() => {
    let cancelled = false;

    async function fetchPrev() {
      if (!effectiveDate) {
        setPrevDateUsed('');
        setPrevRankMap(new Map());
        setPrevMetricsMap(new Map());
        return;
      }
      const p = prevDay(effectiveDate);
      if (!p) {
        setPrevDateUsed('');
        setPrevRankMap(new Map());
        setPrevMetricsMap(new Map());
        return;
      }

      // abort previous
      if (prevFetchCtrlRef.current) {
        try { prevFetchCtrlRef.current.abort(); } catch {}
      }
      const ctrl = new AbortController();
      prevFetchCtrlRef.current = ctrl;

      setPrevDateUsed(p);
      setPrevLoading(true);
      setPrevError(null);

      try {
        const res = await fetch(`/api/daily_ranking?date=${encodeURIComponent(p)}`, { signal: ctrl.signal });
        if (!res.ok) {
          if (!cancelled) {
            setPrevRankMap(new Map());
            setPrevMetricsMap(new Map());
          }
          return;
        }
        const json = await res.json();
        const arr = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

        const rm = new Map();
        const mm = new Map();

        for (let i = 0; i < arr.length; i += 1) {
          const it = arr[i];
          const name = getClubName(it);
          if (!name || name === '—') continue;
          const rp = toNumber(it?.rank_position);
          const rankPos = rp !== null ? rp : i + 1;
          const score = toNumber(it?.score ?? it?.iap ?? it?.iap_score);
          const volume = toNumber(it?.volume_total);
          const sent = toNumber(it?.sentiment_score);
          rm.set(name, rankPos);
          mm.set(name, { rank: rankPos, score, volume, sent });
        }

        if (!cancelled) {
          setPrevRankMap(rm);
          setPrevMetricsMap(mm);
        }
      } catch (e) {
        if (e?.name !== 'AbortError' && !cancelled) {
          setPrevError(e);
          setPrevRankMap(new Map());
          setPrevMetricsMap(new Map());
        }
      } finally {
        if (!cancelled) setPrevLoading(false);
        prevFetchCtrlRef.current = null;
      }
    }

    fetchPrev();

    return () => {
      cancelled = true;
      if (prevFetchCtrlRef.current) {
        try { prevFetchCtrlRef.current.abort(); } catch {}
      }
    };
  }, [effectiveDate]);

  // rows e tabelas
  const clubOptions = useMemo(() => {
    const names = rankingArr.map(getClubName).filter((n) => n && n !== '—');
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [rankingArr]);

  const baseRows = useMemo(() => {
    return (rankingArr || [])
      .map((item) => {
        const raw = item?.score ?? item?.iap;
        const value = toNumber(raw);
        const club = getClubName(item);
        return { club, value, rawItem: item };
      })
      .filter((r) => r.value !== null);
  }, [rankingArr]);

  const rows = useMemo(() => {
    if (!selectedClub) return baseRows;
    return baseRows.filter((r) => r.club === selectedClub);
  }, [baseRows, selectedClub]);

  const barData = useMemo(() => {
    return {
      labels: rows.map((r) => r.club),
      datasets: [{ label: 'IAP', data: rows.map((r) => r.value), backgroundColor: '#243a69' }],
    };
  }, [rows]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: { y: { beginAtZero: true } },
    };
  }, []);

  // comparação multi-clubes: mantemos o mecanismo de AbortController (já estava)
  const [compareSelected, setCompareSelected] = useState([]);
  const [compareMap, setCompareMap] = useState({});
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState(null);
  const compareFetchCtrlRef = useRef(null);
  const [compareDateB, setCompareDateB] = useState('');
  const [top5BLoading, setTop5BLoading] = useState(false);
  const [top5BError, setTop5BError] = useState(null);
  const [abSummary, setAbSummary] = useState(null);

  useEffect(() => {
    const need = compareSelected.filter((label) => !compareMap[label]);
    if (need.length === 0) return;

    let cancelled = false;

    // abort previous batch
    if (compareFetchCtrlRef.current) {
      try { compareFetchCtrlRef.current.abort(); } catch {}
    }
    const ctrl = new AbortController();
    compareFetchCtrlRef.current = ctrl;

    async function loadMissing() {
      setCompareBusy(true);
      try {
        const updates = {};
        for (const label of need) {
          if (ctrl.signal.aborted) throw new Error('Abortado');
          const realName = label.replace(/\s*\((A|B)\)\s*$/, '');
          const res = await fetch(`/api/club_series?club=${encodeURIComponent(realName)}&limit_days=180`, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`Falha ao buscar série: ${label}`);
          const json = await res.json();
          updates[label] = normalizeSeries(json);
        }
        if (!cancelled) setCompareMap((prev) => ({ ...prev, ...updates }));
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') setCompareError(e);
      } finally {
        if (!cancelled) setCompareBusy(false);
      }
    }

    loadMissing();

    return () => {
      cancelled = true;
      try { ctrl.abort(); } catch {}
      compareFetchCtrlRef.current = null;
    };
  }, [compareSelected, compareMap]);

  const compareAligned = useMemo(() => {
    const selected = compareSelected.filter((label) => compareMap[label]);
    if (selected.length === 0) return { labels: [], datasets: [] };

    const dateSet = new Set();
    selected.forEach((label) => {
      compareMap[label].forEach((r) => dateSet.add(r.date));
    });

    const labels = Array.from(dateSet).sort((a, b) => String(a).localeCompare(String(b)));

    let manualIndex = 0;

    const datasets = selected.map((label) => {
      const map = new Map(compareMap[label].map((r) => [r.date, r.value]));
      const dataArr = labels.map((d) => (map.has(d) ? map.get(d) : null));
      let color = '#6B7280';
      if (/\(A\)\s*$/.test(label)) color = COLOR_A;
      else if (/\(B\)\s*$/.test(label)) color = COLOR_B;
      else {
        color = MANUAL_PALETTE[manualIndex % MANUAL_PALETTE.length];
        manualIndex += 1;
      }
      return {
        label,
        data: dataArr,
        borderColor: color,
        backgroundColor: color,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        spanGaps: false,
      };
    });

    return { labels, datasets };
  }, [compareSelected, compareMap]);

  const lineOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true }, tooltip: { enabled: true } },
      scales: { y: { beginAtZero: true } },
      elements: { line: { tension: 0.25 } },
    };
  }, []);

  const clubsForCompareUI = useMemo(() => {
    return (Array.isArray(clubs) ? clubs : [])
      .map((c) => c.label)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [clubs]);

  // render helpers
  function renderTrend(item, idx) {
    const currRank = toNumber(item?.rank_position) !== null ? toNumber(item?.rank_position) : idx + 1;
    const name = getClubName(item);
    const prevRank = prevRankMap.get(name);

    if (!prevDateUsed || prevRank === undefined || prevRank === null || !currRank) return <span style={{ opacity: 0.7 }}>—</span>;

    const delta = prevRank - currRank;
    if (delta > 0) return <TrendBadge direction="up" value={delta} />;
    if (delta < 0) return <TrendBadge direction="down" value={Math.abs(delta)} />;
    return <TrendBadge direction="flat" value={0} />;
  }

  // UI states
  const isLoading = rankingLoading;
  const isError = rankingError;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h2 style={{ margin: 0 }}>Ranking Diário</h2>

      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Exibindo: <strong>{formatDateBR(effectiveDate)}</strong>
        {requestedDate && resolvedDate && resolvedDate !== requestedDate ? (
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.8 }}>
            (data resolvida automaticamente para <strong>{formatDateBR(resolvedDate)}</strong> — você selecionou{' '}
            {formatDateBR(requestedDate)})
          </span>
        ) : null}
        {selectedClub ? <> | Clube: <strong>{selectedClub}</strong></> : null}
        {prevLoading ? <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>Calculando comparações…</span> : prevDateUsed ? <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>vs {formatDateBR(prevDateUsed)}</span> : null}
      </div>

      {isError ? (
        <div>
          Erro ao buscar ranking: {String(rankingError?.message ?? rankingError)}
          <button onClick={() => mutateRanking()} style={{ marginLeft: 12 }}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {/* filtros */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>Data:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            const d = e.target.value;
            setSelectedDate(d);
          }}
        />
        <button
          onClick={() => {
            setSelectedDate('');
          }}
          disabled={isLoading}
          title="Voltar para o padrão (último dia disponível)"
        >
          Hoje/Último
        </button>

        <label style={{ fontSize: 14, marginLeft: 8 }}>Clube:</label>
        <select value={selectedClub} onChange={(e) => setSelectedClub(e.target.value)} style={{ padding: 4 }}>
          <option value="">Todos</option>
          {clubOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button onClick={() => setSelectedClub('')} disabled={!selectedClub} title="Limpar filtro de clube">
          Limpar clube
        </button>
      </div>

      {/* insights */}
      <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Insights do dia</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Base: {formatDateBR(effectiveDate)} {prevDateUsed ? `vs ${formatDateBR(prevDateUsed)}` : '(sem dia anterior)'}
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Skeleton width={120} height={16} />
              <Skeleton width={80} height={16} />
              <Skeleton width={80} height={16} />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Skeleton height={60} />
                <Skeleton height={60} />
                <Skeleton height={60} />
                <Skeleton height={60} />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* compute insights locally from rankingArr */}
            {(!rankingArr || rankingArr.length === 0) ? (
              <div style={{ fontSize: 12, opacity: 0.8 }}>Sem dados.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {/* Leader */}
                <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Líder do dia</div>
                  <div style={{ fontSize: 14 }}>
                    <Link href={`/club/${encodeURIComponent(getClubName(rankingArr[0]))}`} style={{ textDecoration: 'underline', fontWeight: 700 }}>
                      {getClubName(rankingArr[0])}
                    </Link>{' '}
                    {toNumber(rankingArr[0]?.score ?? rankingArr[0]?.iap) !== null ? (
                      <span style={{ opacity: 0.85 }}>({NF.format(toNumber(rankingArr[0]?.score ?? rankingArr[0]?.iap))})</span>
                    ) : null}
                  </div>
                </div>

                {/* placeholders: reuse code from earlier but simplified */}
                <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Maior alta de IAP (Δ)</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Consulte o dia anterior para calcular Δ.</div>
                </div>

                <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Maior volume do dia</div>
                  <div style={{ fontSize: 13 }}>
                    {(() => {
                      let maxVol = null;
                      let maxName = null;
                      for (let i = 0; i < rankingArr.length; i += 1) {
                        const it = rankingArr[i];
                        const v = toNumber(it?.volume_total);
                        const name = getClubName(it);
                        if (v !== null && (maxVol === null || v > maxVol)) {
                          maxVol = v;
                          maxName = name;
                        }
                      }
                      return maxName ? <><Link href={`/club/${encodeURIComponent(maxName)}`} style={{ textDecoration: 'underline', fontWeight: 700 }}>{maxName}</Link> <span style={{ opacity: 0.85 }}>({NF.format(maxVol)})</span></> : '—';
                    })()}
                  </div>
                </div>

                <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Sentimento do dia (melhor / pior)</div>
                  <div style={{ fontSize: 13 }}>
                    {/* compute best/worst sentiment quickly */}
                    {(() => {
                      let best = null, bestName = null, worst = null, worstName = null;
                      for (let i = 0; i < rankingArr.length; i += 1) {
                        const it = rankingArr[i];
                        const s = toNumber(it?.sentiment_score);
                        const name = getClubName(it);
                        if (s !== null) {
                          if (best === null || s > best) { best = s; bestName = name; }
                          if (worst === null || s < worst) { worst = s; worstName = name; }
                        }
                      }
                      return (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div>{bestName ? <><Link href={`/club/${encodeURIComponent(bestName)}`} style={{ textDecoration: 'underline', fontWeight: 700 }}>{bestName}</Link> <span style={{ color: '#16A34A', fontWeight: 700 }}>{best.toFixed(2)}</span></> : '—'}</div>
                          <div>{worstName ? <><Link href={`/club/${encodeURIComponent(worstName)}`} style={{ textDecoration: 'underline', fontWeight: 700 }}>{worstName}</Link> <span style={{ color: '#DC2626', fontWeight: 700 }}>{worst.toFixed(2)}</span></> : null}</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Top Movers (mantido) */}
      <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Top Movers (posição)</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Base: ranking exibido ({formatDateBR(effectiveDate)}) {prevDateUsed ? `vs ${formatDateBR(prevDateUsed)}` : ''}
          </div>
        </div>

        {prevLoading ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton width="32%" height={48} />
            <Skeleton width="32%" height={48} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {/* compute movers quickly */}
            {(() => {
              // compute simple movers: compare prevRankMap with current rankingArr
              if (!prevDateUsed || prevRankMap.size === 0) {
                return <div style={{ fontSize: 12, opacity: 0.8 }}>Sem comparação disponível (não há dados do dia anterior).</div>;
              }
              const all = [];
              for (let i = 0; i < rankingArr.length; i += 1) {
                const it = rankingArr[i];
                const name = getClubName(it);
                if (!name || name === '—') continue;
                const currRank = toNumber(it?.rank_position) !== null ? toNumber(it?.rank_position) : i + 1;
                const prevRank = prevRankMap.get(name);
                if (!prevRank || !currRank) continue;
                const delta = prevRank - currRank;
                if (delta === 0) continue;
                all.push({ name, currRank, prevRank, delta });
              }
              const up = all.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
              const down = all.filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);
              return (
                <>
                  <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>Mais subiram</div>
                    {up.length === 0 ? <div style={{ fontSize: 12, opacity: 0.8 }}>—</div> : (
                      <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                        {up.map((m) => (
                          <li key={m.name} style={{ marginBottom: 6, fontSize: 13 }}>
                            <Link href={`/club/${encodeURIComponent(m.name)}`} style={{ textDecoration: 'underline' }}>{m.name}</Link>{' '}
                            <span style={{ fontWeight: 700, color: '#16A34A' }}>↑ +{m.delta}</span>{' '}
                            <span style={{ opacity: 0.75 }}>({m.prevRank} → {m.currRank})</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>Mais caíram</div>
                    {down.length === 0 ? <div style={{ fontSize: 12, opacity: 0.8 }}>—</div> : (
                      <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                        {down.map((m) => (
                          <li key={m.name} style={{ marginBottom: 6, fontSize: 13 }}>
                            <Link href={`/club/${encodeURIComponent(m.name)}`} style={{ textDecoration: 'underline' }}>{m.name}</Link>{' '}
                            <span style={{ fontWeight: 700, color: '#DC2626' }}>↓ {m.delta}</span>{' '}
                            <span style={{ opacity: 0.75 }}>({m.prevRank} → {m.currRank})</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </section>

      {/* Chart */}
      <div style={{ height: 360, width: '100%' }}>
        {isLoading ? <LoadingChartPlaceholder height={360} /> : <Bar data={barData} options={barOptions} />}
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Skeleton width={40} height={16} />
              <Skeleton width={60} height={16} />
              <Skeleton width="40%" height={16} />
              <Skeleton width={80} height={16} />
              <Skeleton width={120} height={16} />
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Posição</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Tendência</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Clube</th>
              <th style={{ textAlign: 'left', padding: 8 }}>IAP</th>
              <th style={{ textAlign: 'left', padding: 8 }}>7d</th>
            </tr>
          </thead>
          <tbody>
            {(selectedClub ? rows.map((r) => r.rawItem) : rankingArr).map((item, idx) => {
              const clubName = getClubName(item);
              const href = `/club/${encodeURIComponent(clubName)}`;
              const rankPos = toNumber(item?.rank_position) ?? idx + 1;
              const key = item?.club_id ?? `${clubName}::${rankPos}::${idx}`;
              const series = Array.isArray(item?.series) ? item.series.map((s) => toNumber(s?.value)) : [];
              return (
                <tr key={key}>
                  <td style={{ padding: 8 }}>{rankPos}</td>
                  <td style={{ padding: 8 }}>{renderTrend(item, idx)}</td>
                  <td style={{ padding: 8 }}>
                    {clubName && clubName !== '—' ? (
                      <Link href={href} style={{ textDecoration: 'underline' }}>
                        {clubName}
                      </Link>
                    ) : clubName}
                  </td>
                  <td style={{ padding: 8 }}>{toNumber(item?.score ?? item?.iap) !== null ? NF.format(toNumber(item?.score ?? item?.iap)) : '—'}</td>
                  <td style={{ padding: 8, width: 140 }}>
                    <MiniSparkline data={series} width={120} height={28} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Comparação multi-clubes */}
      <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Comparar clubes — evolução do IAP</div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Top 5 vs Top 5: compara Top 5 da Data A com Top 5 da Data B.
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12 }}>
              Data A: <strong>{formatDateBR(effectiveDate)}</strong> (cor A: <span style={{ color: COLOR_A }}>azul</span>)
            </div>

            <label style={{ fontSize: 12 }}>Data B:</label>
            <input type="date" value={compareDateB} onChange={(e) => { setCompareDateB(e.target.value); setTop5BError(null); }} />

            <div style={{ fontSize: 12 }}>
              cor B: <span style={{ color: COLOR_B }}>laranja</span>
            </div>

            <button
              onClick={async () => {
                setTop5BError(null);
                setTop5BLoading(true);
                try {
                  if (!compareDateB) throw new Error('Selecione a Data B.');
                  const aItems = Array.isArray(rankingArr) ? rankingArr : [];
                  const resB = await fetch(`/api/daily_ranking?date=${encodeURIComponent(compareDateB)}`);
                  if (!resB.ok) throw new Error(`Falha ao buscar ranking da Data B (${resB.status})`);
                  const bJson = await resB.json();
                  const bItems = Array.isArray(bJson) ? bJson : Array.isArray(bJson?.data) ? bJson.data : [];
                  const topA = aItems.map((it) => getClubName(it)).filter((n) => n && n !== '—').slice(0, 5);
                  const topB = bItems.map((it) => getClubName(it)).filter((n) => n && n !== '—').slice(0, 5);
                  setAbSummary((() => {
                    const a20 = aItems.slice(0, 20);
                    const b20 = bItems.slice(0, 20);
                    // simple build
                    const entered = topB.filter((n) => !topA.includes(n));
                    const exited = topA.filter((n) => !topB.includes(n));
                    return { entered, exited };
                  })());
                  const merged = [...topA.map((n) => `${n} (A)`), ...topB.map((n) => `${n} (B)`)];

                  setCompareError(null);
                  setCompareMap({});
                  setCompareSelected(merged);
                } catch (e) {
                  setTop5BError(e);
                  setAbSummary(null);
                } finally {
                  setTop5BLoading(false);
                }
              }}
              disabled={top5BLoading}
            >
              Carregar Top 5 A + B
            </button>

            {top5BLoading ? <span style={{ fontSize: 12, opacity: 0.75 }}>Carregando…</span> : null}
          </div>

          {top5BError ? <div style={{ fontSize: 12 }}>Erro: {String(top5BError?.message ?? top5BError)}</div> : null}

          {abSummary ? (
            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Resumo A → B</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Entraram no Top 5 (B)</div>
                  <div style={{ fontSize: 13 }}>{abSummary.entered.length ? abSummary.entered.join(', ') : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Saíram do Top 5 (A)</div>
                  <div style={{ fontSize: 13 }}>{abSummary.exited.length ? abSummary.exited.join(', ') : '—'}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: 12, opacity: 0.8 }}>Modo manual: selecione até 5 clubes para sobrepor as linhas no mesmo gráfico.</div>

        {clubsLoading ? (
          <div>Carregando clubes…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            {clubsForCompareUI.map((name) => {
              const checked = compareSelected.includes(name);
              const disabled = !checked && compareSelected.length >= (compareSelected.some((x) => /\((A|B)\)\s*$/.test(String(x))) ? 10 : 5);
              return (
                <label key={name} style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: disabled ? 0.6 : 1 }}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => {
                    setCompareError(null);
                    setCompareSelected((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
                  }} />
                  <span>{name}</span>
                </label>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Selecionados: <strong>{compareSelected.length}</strong>/{compareSelected.some((x) => /\((A|B)\)\s*$/.test(String(x))) ? 10 : 5}</div>

          <button onClick={() => {
            const source = Array.isArray(rankingArr) ? rankingArr : [];
            const top = source.map((it) => getClubName(it)).filter((n) => n && n !== '—').slice(0, 5);
            setCompareMap({});
            setCompareSelected(top);
            setAbSummary(null);
            setCompareError(null);
          }} disabled={!Array.isArray(rankingArr) || rankingArr.length === 0}>Top 5 do dia</button>

          <button onClick={() => { setCompareSelected([]); setCompareMap({}); setCompareError(null); setAbSummary(null); }} disabled={compareSelected.length === 0}>Limpar seleção</button>

          {compareBusy ? <span style={{ fontSize: 12, opacity: 0.75 }}>Carregando séries…</span> : null}
        </div>

        {compareError ? <div style={{ fontSize: 13 }}>Erro ao carregar comparação: {String(compareError?.message ?? compareError)}</div> : null}

        {compareAligned.datasets.length >= 1 ? (
          <div style={{ height: 420, width: '100%' }}>
            <Line data={{ labels: compareAligned.labels, datasets: compareAligned.datasets }} options={lineOptions} />
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.8 }}>Selecione pelo menos 1 clube (modo manual) ou use “Carregar Top 5 A + B”.</div>
        )}
      </div>
    </div>
  );
}
