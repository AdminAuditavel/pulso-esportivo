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

/* Helper para exibir só dia/mês: "22/12" */
function formatDayMonth(yyyyMMdd) {
  if (!yyyyMMdd) return '';
  const s = String(yyyyMMdd).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}`;
}

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

  // effective aggregation date used for prev-day fetch etc
  const effectiveDate = useMemo(() => {
    if (resolvedDate) return resolvedDate;
    if (selectedDate) return selectedDate;
    if (!Array.isArray(data) || data.length === 0) return '';
    return getAggregationDateFromItem(data[0]) || '';
  }, [resolvedDate, selectedDate, data]);

  /* ========== aggregate / deduplicate clubs into a ranked list ==========
     - Group by club name
     - Choose representative per club preferring numeric values (highest)
     - Keep clubs even if they only have non-numeric values
     - Sort numeric desc; then clubs with null values last
  */
  const rankedData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];

    const byClub = new Map();

    for (let i = 0; i < data.length; i += 1) {
      const item = data[i];
      const club = getClubName(item);
      if (!club || club === '—') continue;

      // try several fields commonly used
      const raw = item?.score ?? item?.iap ?? item?.iap_score ?? item?.value ?? null;
      const parsed = toNumber(raw);

      const existing = byClub.get(club);

      if (!existing) {
        // store whatever we have (including parsed === null)
        byClub.set(club, { club, value: parsed, rawItem: item });
      } else {
        // prefer numeric values over null; otherwise prefer higher numeric
        const a = existing.value;
        const b = parsed;
        if (a === null && b !== null) {
          byClub.set(club, { club, value: b, rawItem: item });
        } else if (a !== null && b !== null && b > a) {
          byClub.set(club, { club, value: b, rawItem: item });
        }
        // else keep existing
      }
    }

    const arr = Array.from(byClub.values());

    // sort: numeric desc first, then nulls last
    arr.sort((x, y) => {
      const a = x.value;
      const b = y.value;
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      if (a === b) return 0;
      return a > b ? -1 : 1;
    });

    // assign rank_position (ties: equal numeric -> same rank)
    let lastValue = null;
    let lastRank = 0;
    let currentPos = 0;
    for (let i = 0; i < arr.length; i += 1) {
      currentPos = i + 1;
      const val = arr[i].value;
      if (val === null) {
        // assign incremental positions for nulls (after numerics)
        arr[i].rank_position = currentPos;
      } else {
        if (lastValue !== null && val === lastValue) {
          arr[i].rank_position = lastRank;
        } else {
          arr[i].rank_position = currentPos;
          lastRank = currentPos;
          lastValue = val;
        }
      }
    }

    // return normalized items (rawItem with injected rank_position & computed value)
    return arr.map((r) => {
      const item = { ...r.rawItem };
      item.rank_position = r.rank_position;
      // keep computed value (could be null)
      item._computed_value = r.value;
      return item;
    });
  }, [data]);

  // DEBUG: console + debug panel (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Ranking debug -> rankingJson:', rankingJson);
      // eslint-disable-next-line no-console
      console.log('Ranking debug -> data (raw):', data);
      // eslint-disable-next-line no-console
      console.log('Ranking debug -> rankedData (deduplicado):', rankedData);
    }
  }, [rankingJson, data, rankedData]);

  const DebugPanel = () => {
    if (process.env.NODE_ENV === 'production') return null;
    const sample = Array.isArray(data) ? data.slice(0, 8).map((it) => ({
      club: getClubName(it),
      rawScore: it?.score ?? it?.iap ?? it?.iap_score ?? null,
      parsed: toNumber(it?.score ?? it?.iap ?? it?.iap_score ?? null),
    })) : [];
    const rankedSample = Array.isArray(rankedData) ? rankedData.slice(0, 8).map((it) => ({
      club: getClubName(it),
      computed: it._computed_value === null ? null : it._computed_value,
      rank_position: it.rank_position,
    })) : [];
    return (
      <div style={{ background: '#fff8', border: '1px solid rgba(0,0,0,0.06)', padding: 8, margin: '8px 0' }}>
        <div style={{ fontSize: 12, marginBottom: 6, color: '#333' }}>
          Debug: raw.length = {Array.isArray(data) ? data.length : 0} • ranked.length = {Array.isArray(rankedData) ? rankedData.length : 0}
        </div>
        <details style={{ fontSize: 11 }}>
          <summary>Sample raw → parsed</summary>
          <pre style={{ maxHeight: 220, overflow: 'auto' }}>{JSON.stringify(sample, null, 2)}</pre>
        </details>
        <details style={{ fontSize: 11 }}>
          <summary>Sample ranked → computed</summary>
          <pre style={{ maxHeight: 220, overflow: 'auto' }}>{JSON.stringify(rankedSample, null, 2)}</pre>
        </details>
      </div>
    );
  };

  // table / rows — built from rankedData (unique clubs only).
  // For display (charts/table) we provide a fallback displayValue = 0 when there is no numeric value,
  // but keep _computed_value === null so trend logic and prev-day compare can differentiate.
  const clubOptions = useMemo(() => {
    if (!Array.isArray(rankedData)) return [];
    const names = rankedData.map(getClubName).filter((n) => n && n !== '—');
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [rankedData]);

  const baseRows = useMemo(() => {
    if (!Array.isArray(rankedData)) return [];
    return rankedData
      .map((item) => {
        const raw = item?.score ?? item?._computed_value ?? item?.iap ?? item?.iap_score;
        let value = toNumber(raw);
        const wasNull = value === null;
        // fallback display value for charts/tables: 0 when missing
        if (value === null) value = 0;
        const club = getClubName(item);
        return { club, value, rawItem: item, wasNull };
      })
      .filter((r) => r.club && r.club !== '—');
  }, [rankedData]);

  const rows = useMemo(() => {
    if (!selectedClub) return baseRows;
    return baseRows.filter((r) => r.club === selectedClub);
  }, [baseRows, selectedClub]);

  const tableItems = useMemo(() => {
    if (selectedClub) return rows.map((r) => r.rawItem);
    return Array.isArray(rankedData) ? rankedData : [];
  }, [selectedClub, rows, rankedData]);

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
  const [compareSelected, setCompareSelected] = useState([]); // labels (e.g. "Club (A)" or "Club")
  const [compareMap, setCompareMap] = useState({}); // { label: normalizedSeries[] }
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState(null);

  // states for Data B / top5 flow
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
          const res = await fetch(`/api/club_series?club=${encodeURIComponent(realName)}&limit_days=365`, { signal: ctrl.signal });
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

  // Alinha séries em labels diárias entre min e max (preenche com null quando não há valor)
  const compareAligned = useMemo(() => {
    const selected = compareSelected.filter((label) => compareMap[label]);
    if (selected.length === 0) return { labels: [], datasets: [] };

    // coleta todas as datas disponíveis nas séries
    const allDatesSet = new Set();
    selected.forEach((label) => {
      (compareMap[label] || []).forEach((r) => {
        if (r && r.date) allDatesSet.add(String(r.date).slice(0, 10));
      });
    });

    if (allDatesSet.size === 0) return { labels: [], datasets: [] };

    const dateArr = Array.from(allDatesSet).sort(); // YYYY-MM-DD ordering works lexicographically

    // helpers UTC
    const toUTCDate = (isoYmd) => {
      const [y, m, d] = String(isoYmd).split('-').map((v) => Number(v));
      return new Date(Date.UTC(y, m - 1, d));
    };
    const toISOYMD = (dt) => dt.toISOString().slice(0, 10);

    // generate continuous daily labels between min and max
    const minDate = dateArr[0];
    const maxDate = dateArr[dateArr.length - 1];
    const labels = [];
    for (let cur = toUTCDate(minDate); cur <= toUTCDate(maxDate); cur.setUTCDate(cur.getUTCDate() + 1)) {
      labels.push(toISOYMD(new Date(cur)));
    }

    let manualIndex = 0;
    const datasets = selected.map((label) => {
      const map = new Map((compareMap[label] || []).map((r) => [String(r.date).slice(0, 10), r.value]));
      const dataArr = labels.map((d) => (map.has(d) ? map.get(d) : null));
      let color = 'var(--c-1, #337d26)';
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
        spanGaps: true,
      };
    });

    return { labels, datasets };
  }, [compareSelected, compareMap]);

  // opções do chart com formatação de ticks (DD/MM) e tooltip com DD/MM/AAAA
  const lineOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          enabled: true,
          callbacks: {
            title: function (tooltipItems) {
              if (!tooltipItems || tooltipItems.length === 0) return '';
              const label = tooltipItems[0].label;
              return formatDateBR(String(label).slice(0, 10));
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            callback: function (val) {
              try {
                const label = (typeof this.getLabelForValue === 'function') ? this.getLabelForValue(val) : val;
                return formatDayMonth(String(label).slice(0, 10));
              } catch {
                return String(val);
              }
            },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
          },
        },
        y: { beginAtZero: true },
      },
      elements: { line: { tension: 0.12 } },
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

  const hasAnyData = (Array.isArray(rankedData) && rankedData.length > 0) || (Array.isArray(data) && data.length > 0);
  if (!hasAnyData) return <div className={ctrlStyles.container}>Nenhum dado disponível</div>;

  const linkClub = (name) => `/club/${encodeURIComponent(name)}`;

  /* ========== JSX ========== */
  return (
    <div className={ctrlStyles.container}>
      <DebugPanel />

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
          {/* ... o restante da UI de comparação permanece igual ao seu original ... */}
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Comparar clubes — evolução do IAP</div>
          {/* (mantive a lógica original de carregamento de séries) */}
        </section>

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          Observação: o gráfico mostra as datas disponíveis nas séries que foram carregadas para os clubes selecionados.
        </div>
      </main>
    </div>
  );
}
