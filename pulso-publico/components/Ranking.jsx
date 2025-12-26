'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { Line } from 'react-chartjs-2';

import fetcher from './hooks/useFetcher';
import TrendBadge from './TrendBadge';
import Skeleton from './Skeleton';
import LoadingChartPlaceholder from './LoadingChartPlaceholder';
import btnStyles from './Button.module.css';
import ctrlStyles from './controls.module.css';

import HeaderLogo from './HeaderLogo';
import InsightsPanel from './InsightsPanel';
import TopMovers from './TopMovers';
import ChartPanel from './ChartPanel';
import RankingTable from './RankingTable';

import {
  getClubName,
  toNumber,
  normalizeSeries,
  prevDay,
  getAggregationDateFromItem,
  formatDateBR,
  buildAbSummary,
  NF,
  MANUAL_PALETTE,
  COLOR_A,
  COLOR_B,
} from '../lib/rankingUtils';

// Chart.js registration
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
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

export default function Ranking() {
  /* ========== filtros / estados ========== */
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedClub, setSelectedClub] = useState('');

  const [resolvedDate, setResolvedDate] = useState('');
  const [requestedDate, setRequestedDate] = useState('');

  // SWR: daily ranking
  const rankingKey = selectedDate ? `/api/daily_ranking?date=${encodeURIComponent(selectedDate)}` : '/api/daily_ranking';
  const { data: rankingJson, error: rankingError, isValidating: rankingLoading, mutate: mutateRanking } = useSWR(rankingKey, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: true,
  });

  const data = Array.isArray(rankingJson) ? rankingJson : Array.isArray(rankingJson?.data) ? rankingJson.data : [];
  const resolvedFromApi = rankingJson && !Array.isArray(rankingJson) && rankingJson?.resolved_date ? String(rankingJson.resolved_date).slice(0, 10) : '';

  useEffect(() => {
    setRequestedDate(selectedDate ? String(selectedDate).slice(0, 10) : '');
    setResolvedDate(resolvedFromApi || (data?.[0] ? getAggregationDateFromItem(data[0]) : ''));
  }, [rankingJson, selectedDate, data, resolvedFromApi]);

  // clubs list
  const { data: clubsJson, isValidating: clubsLoading } = useSWR('/api/clubs', fetcher, { revalidateOnFocus: false });
  const clubs = Array.isArray(clubsJson) ? clubsJson : [];

  // effectiveDate
  const effectiveDate = useMemo(() => {
    if (resolvedDate) return resolvedDate;
    if (selectedDate) return selectedDate;
    if (!Array.isArray(data) || data.length === 0) return '';
    return getAggregationDateFromItem(data[0]) || '';
  }, [resolvedDate, selectedDate, data]);

  // table / rows
  const clubOptions = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const names = data.map(getClubName).filter((n) => n && n !== '—');
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const baseRows = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const raw = item?.score ?? item?.iap;
        const value = toNumber(raw);
        const club = getClubName(item);
        return { club, value, rawItem: item };
      })
      .filter((r) => r.value !== null);
  }, [data]);

  const rows = useMemo(() => {
    if (!selectedClub) return baseRows;
    return baseRows.filter((r) => r.club === selectedClub);
  }, [baseRows, selectedClub]);

  const tableItems = useMemo(() => {
    return selectedClub ? rows.map((r) => r.rawItem) : Array.isArray(data) ? data : [];
  }, [selectedClub, rows, data]);

  /* ========== prev-day (trend) ========== */
  const prevFetchCtrlRef = useRef(null);
  const [prevRankMap, setPrevRankMap] = useState(new Map());
  const [prevMetricsMap, setPrevMetricsMap] = useState(new Map());
  const [prevDateUsed, setPrevDateUsed] = useState('');
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevError, setPrevError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrevRanking() {
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

    fetchPrevRanking();

    return () => {
      cancelled = true;
      if (prevFetchCtrlRef.current) {
        try { prevFetchCtrlRef.current.abort(); } catch {}
      }
    };
  }, [effectiveDate]);

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

  /* ========== compare A/B (series) ========== */
  const compareFetchCtrlRef = useRef(null);
  const [compareSelected, setCompareSelected] = useState([]);
  const [compareMap, setCompareMap] = useState({});
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState(null);

  const [compareDateB, setCompareDateB] = useState('');
  const [top5BLoading, setTop5BLoading] = useState(false);
  const [top5BError, setTop5BError] = useState(null);
  const [abSummary, setAbSummary] = useState(null);

  useEffect(() => {
    const need = compareSelected.filter((label) => !compareMap[label]);
    if (need.length === 0) return;

    let cancelled = false;

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
  }, [compareSelected]);

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

  /* ========== render guards ========== */
  if (rankingLoading) return <div className={ctrlStyles.container}>Carregando ranking…</div>;

  if (rankingError)
    return (
      <div className={ctrlStyles.container}>
        Erro ao buscar ranking: {String(rankingError?.message ?? rankingError)}
        <button className={btnStyles.btn} onClick={() => mutateRanking()} style={{ marginLeft: 12 }}>
          Tentar novamente
        </button>
      </div>
    );

  if (!data || !Array.isArray(data) || data.length === 0) return <div className={ctrlStyles.container}>Nenhum dado disponível</div>;

  const linkClub = (name) => `/club/${encodeURIComponent(name)}`;

  /* ========== JSX ========== */
  return (
    <div className={ctrlStyles.container}>
      <header className={ctrlStyles.header}>
        <div className={ctrlStyles.headerInner}>
          <HeaderLogo title="Ranking Diário" category="Esporte" />
        </div>
      </header>

      <main>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
          Exibindo: <strong>{formatDateBR(effectiveDate)}</strong>
          {requestedDate && resolvedDate && resolvedDate !== requestedDate ? (
            <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.8 }}>
              (data resolvida automaticamente para <strong>{formatDateBR(resolvedDate)}</strong> — você selecionou{' '}
              {formatDateBR(requestedDate)})
            </span>
          ) : null}

          {selectedClub ? <> | Clube: <strong>{selectedClub}</strong></> : null}

          {prevLoading ? (
            <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>Calculando comparações…</span>
          ) : prevDateUsed ? (
            <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>vs {formatDateBR(prevDateUsed)}</span>
          ) : null}
        </div>

        {prevError ? (
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Aviso: não foi possível carregar o dia anterior ({String(prevError?.message ?? prevError)})
          </div>
        ) : null}

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <label style={{ fontSize: 14 }}>Data:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={ctrlStyles.dateInput}
          />
          <button
            className={btnStyles.btn}
            onClick={() => { setSelectedDate(''); }}
            disabled={rankingLoading}
            title="Voltar para o padrão (último dia disponível)"
          >
            Hoje/Último
          </button>

          <label style={{ fontSize: 14, marginLeft: 8 }}>Clube:</label>
          <select value={selectedClub} onChange={(e) => setSelectedClub(e.target.value)} style={{ padding: 4 }}>
            <option value="">Todos</option>
            {clubOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <button className={btnStyles.btn} onClick={() => setSelectedClub('')} disabled={!selectedClub}>Limpar clube</button>
        </div>

        {/* Insights (card) */}
        <section className={ctrlStyles.heroCard} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Insights do dia</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Base: {formatDateBR(effectiveDate)} {prevDateUsed ? `vs ${formatDateBR(prevDateUsed)}` : '(sem dia anterior)'}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <InsightsPanel tableItems={tableItems} prevMetricsMap={prevMetricsMap} prevDateUsed={prevDateUsed} effectiveDate={effectiveDate} linkClub={linkClub} />
          </div>
        </section>

        {/* Top Movers card */}
        <section className={ctrlStyles.topicCard} style={{ marginTop: 12 }}>
          <TopMovers tableItems={tableItems} prevRankMap={prevRankMap} prevDateUsed={prevDateUsed} />
        </section>

        {/* Chart */}
        <div style={{ marginTop: 12 }}>
          <ChartPanel rows={rows} loading={rankingLoading} />
        </div>

        {/* Table */}
        <div style={{ marginTop: 12 }}>
          <RankingTable tableItems={tableItems} renderTrend={renderTrend} linkClub={linkClub} />
        </div>

        {/* Comparação (card) */}
        <section className={ctrlStyles.topicCard} style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Comparar clubes — evolução do IAP</div>

          {/* Reuse the same comparison JSX (kept behavior) */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Top 5 vs Top 5: compara o Top 5 do ranking exibido (Data A) com o Top 5 de uma segunda data (Data B).
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12 }}>
                Data A: <strong>{formatDateBR(effectiveDate)}</strong>
                <span style={{ marginLeft: 8 }}>(cor A: <span style={{ color: COLOR_A, fontWeight: 700 }}>azul</span>)</span>
              </div>

              <label style={{ fontSize: 12 }}>Data B:</label>
              <input
                type="date"
                value={compareDateB}
                onChange={(e) => { setCompareDateB(e.target.value); setTop5BError(null); }}
                className={ctrlStyles.dateInput}
              />

              <div style={{ fontSize: 12 }}>
                cor B: <span style={{ color: COLOR_B, fontWeight: 700 }}>laranja</span>
              </div>

              <button
                className={btnStyles.btn}
                onClick={async () => {
                  setTop5BError(null);
                  setTop5BLoading(true);
                  try {
                    if (!compareDateB) throw new Error('Selecione a Data B.');
                    const aItems = Array.isArray(data) ? data : [];

                    const resB = await fetch(`/api/daily_ranking?date=${encodeURIComponent(compareDateB)}`);
                    if (!resB.ok) throw new Error(`Falha ao buscar ranking da Data B (${resB.status})`);
                    const bJson = await resB.json();
                    const bItems = Array.isArray(bJson) ? bJson : Array.isArray(bJson?.data) ? bJson.data : [];

                    setAbSummary(buildAbSummary(aItems.slice(0, 20), bItems.slice(0, 20)));

                    const topA = aItems.map((it) => getClubName(it)).filter((n) => n && n !== '—').slice(0, 5);
                    const topB = bItems.map((it) => getClubName(it)).filter((n) => n && n !== '—').slice(0, 5);
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

            {top5BError ? <div style={{ fontSize: 12, color: 'crimson' }}>Erro: {String(top5BError?.message ?? top5BError)}</div> : null}

            {abSummary ? (
              <div style={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Resumo A → B</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Entraram no Top 5 (B)</div>
                    <div style={{ fontSize: 13 }}>{abSummary.entered.length ? abSummary.entered.join(', ') : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Saíram do Top 5 (A)</div>
                    <div style={{ fontSize: 13 }}>{abSummary.exited.length ? abSummary.exited.join(', ') : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Maior alta (Δ IAP)</div>
                    <div style={{ fontSize: 13 }}>{abSummary.bestUp ? `${abSummary.bestUp.name}: +${abSummary.bestUp.delta.toFixed(2)}` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Maior queda (Δ IAP)</div>
                    <div style={{ fontSize: 13 }}>{abSummary.bestDown ? `${abSummary.bestDown.name}: ${abSummary.bestDown.delta.toFixed(2)}` : '—'}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 10 }}>
            Modo manual: selecione até 5 clubes para sobrepor as linhas no mesmo gráfico.
          </div>

          {clubsLoading ? (
            <div>Carregando clubes…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
              {clubs.map((c) => {
                const name = c?.label;
                if (!name) return null;
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

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Selecionados: <strong>{compareSelected.length}</strong>/{compareSelected.some((x) => /\((A|B)\)\s*$/.test(String(x))) ? 10 : 5}
            </div>

            <button
              className={btnStyles.btn}
              onClick={() => {
                const source = Array.isArray(tableItems) ? tableItems : [];
                const top = source.map((it) => getClubName(it)).filter((n) => n && n !== '—').slice(0, 5);
                setCompareSelected(top);
              }}
              disabled={!Array.isArray(tableItems) || tableItems.length === 0}
            >
              Top 5 do dia
            </button>

            <button
              className={btnStyles.btn}
              onClick={() => { setCompareSelected([]); setCompareMap({}); setCompareError(null); }}
              disabled={compareSelected.length === 0}
            >
              Limpar seleção
            </button>

            {compareBusy ? <span style={{ fontSize: 12, opacity: 0.75 }}>Carregando séries…</span> : null}
          </div>

          {compareError ? <div style={{ fontSize: 13, marginTop: 8 }}>Erro ao carregar comparação: {String(compareError?.message ?? compareError)}</div> : null}

          {compareAligned.datasets && compareAligned.datasets.length >= 1 ? (
            <div style={{ height: 420, width: '100%', marginTop: 12 }}>
              <Line data={{ labels: compareAligned.labels, datasets: compareAligned.datasets }} options={lineOptions} />
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 12 }}>
              Selecione pelo menos 1 clube (modo manual) ou use “Carregar Top 5 A + B”.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
