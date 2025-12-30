//pulso-publico/components/Ranking.jsx
'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Line } from 'react-chartjs-2';

import fetcher from './hooks/useFetcher';
import TrendBadge from './TrendBadge';
import btnStyles from './Button.module.css';
import ctrlStyles from './controls.module.css';

import HeaderLogo from './HeaderLogo';
import InsightsPanel from './InsightsPanel';
import TopMovers from './TopMovers';
import ChartPanel from './ChartPanel';
// RankingTable removido — não é mais utilizado

import {
  getClubName,
  toNumber,
  normalizeSeries,
  prevDay,
  getAggregationDateFromItem,
  formatDateBR,
  buildAbSummary,
  MANUAL_PALETTE,
  COLOR_A,
  COLOR_B,
} from '../lib/rankingUtils';

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

/* ========= Normalização forte de nome (para maps e joins) ========= */
function normalizeClubKey(name) {
  const s = String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  // remove diacríticos (Flamengo ≠ Flámengo etc.)
  // segura para PT-BR
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function clubKeyFromItem(item) {
  const name = getClubName(item);
  if (!name || name === '—') return '';
  return normalizeClubKey(name);
}

/* ========= Extração numérica coerente ========= */
function pickIapNumber(item) {
  // Seu ranking diário usa "value" como IAP
  const raw =
    item?.value ??
    item?._computed_value ??
    item?.iap_score ??
    item?.score ??
    item?.iap ??
    null;

  return toNumber(raw);
}

/* ========= Força compatibilidade: nome e métricas em campos comuns =========
   CORREÇÃO: chave canônica = club_id (quando existir), senão nome normalizado.
*/
function withCompatFields(item, computedValueOrNull) {
  const displayName = getClubName(item);
  const key = item?.club_id ? String(item.club_id) : normalizeClubKey(displayName);

  const computed =
    computedValueOrNull !== undefined ? computedValueOrNull : pickIapNumber(item);

  const n = computed === null ? null : toNumber(computed);

  // injeta vários aliases para “pegar” qualquer componente legado
  return {
    ...item,
    __club_key: key,

    // nomes (para getClubName() conseguir achar em qualquer estratégia interna)
    club: displayName ?? item?.club ?? item?.label ?? item?.name,
    label: displayName ?? item?.label ?? item?.club ?? item?.name,
    name: displayName ?? item?.name ?? item?.label ?? item?.club,

    // métricas (numéricas quando possível)
    _computed_value: n,
    iap_score: n ?? item?.iap_score ?? null,
    score: n ?? item?.score ?? null,
    iap: n ?? item?.iap ?? null,
    value: n ?? item?.value ?? null,
  };
}

function stripAB(label) {
  return String(label || '').replace(/\s*\((A|B)\)\s*$/, '').trim();
}

export default function Ranking() {
  /* ========== filtros / estados ========== */
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedClub, setSelectedClub] = useState('');

  const [resolvedDate, setResolvedDate] = useState('');
  const [requestedDate, setRequestedDate] = useState('');

  // SWR: daily ranking
  const rankingKey = selectedDate
    ? `/api/daily_ranking?date=${encodeURIComponent(selectedDate)}`
    : '/api/daily_ranking';

  const {
    data: rankingJson,
    error: rankingError,
    isValidating: rankingLoading,
    mutate: mutateRanking,
  } = useSWR(rankingKey, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: true,
  });

  const data = Array.isArray(rankingJson)
    ? rankingJson
    : Array.isArray(rankingJson?.data)
      ? rankingJson.data
      : [];

  const resolvedFromApi =
    rankingJson &&
    !Array.isArray(rankingJson) &&
    rankingJson?.resolved_date
      ? String(rankingJson.resolved_date).slice(0, 10)
      : '';

  useEffect(() => {
    setRequestedDate(selectedDate ? String(selectedDate).slice(0, 10) : '');
    setResolvedDate(resolvedFromApi || (data?.[0] ? getAggregationDateFromItem(data[0]) : ''));
  }, [rankingJson, selectedDate, data, resolvedFromApi]);

  // clubs list
  const { data: clubsJson, isValidating: clubsLoading } = useSWR('/api/clubs', fetcher, {
    revalidateOnFocus: false,
  });
  const clubs = Array.isArray(clubsJson) ? clubsJson : [];

  // effective aggregation date used for prev-day fetch etc
  const effectiveDate = useMemo(() => {
    if (resolvedDate) return resolvedDate;
    if (selectedDate) return selectedDate;
    if (!Array.isArray(data) || data.length === 0) return '';
    return getAggregationDateFromItem(data[0]) || '';
  }, [resolvedDate, selectedDate, data]);

  /* ========== aggregate / deduplicate clubs into a ranked list ==========
     CORREÇÃO: dedupe por chave canônica:
       - club_id quando existir
       - senão nome normalizado
  */
  const rankedData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];

    const byClubKey = new Map();
    const displayByKey = new Map();

    for (let i = 0; i < data.length; i += 1) {
      const item = data[i];
      const display = getClubName(item);

      const key = item?.club_id ? String(item.club_id) : normalizeClubKey(display);

      if (!display || display === '—' || !key) continue;

      if (!displayByKey.has(key)) displayByKey.set(key, display);

      const parsed = pickIapNumber(item);

      const existing = byClubKey.get(key);
      if (!existing) {
        byClubKey.set(key, { key, display, value: parsed, rawItem: item });
      } else {
        const a = existing.value;
        const b = parsed;
        if (a === null && b !== null) {
          byClubKey.set(key, { key, display: existing.display, value: b, rawItem: item });
        } else if (a !== null && b !== null && b > a) {
          byClubKey.set(key, { key, display: existing.display, value: b, rawItem: item });
        }
      }
    }

    const arr = Array.from(byClubKey.values());

    // sort: numeric desc first, nulls last
    arr.sort((x, y) => {
      const a = x.value;
      const b = y.value;
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      if (a === b) return 0;
      return a > b ? -1 : 1;
    });

    // assign rank_position (ties equal numeric -> same rank)
    let lastValue = null;
    let lastRank = 0;
    for (let i = 0; i < arr.length; i += 1) {
      const val = arr[i].value;
      const pos = i + 1;
      if (val === null) {
        arr[i].rank_position = pos;
      } else {
        if (lastValue !== null && val === lastValue) {
          arr[i].rank_position = lastRank;
        } else {
          arr[i].rank_position = pos;
          lastRank = pos;
          lastValue = val;
        }
      }
    }

    return arr.map((r) => {
      const item = { ...r.rawItem };

      // garante rank_position numérico
      item.rank_position = r.rank_position;

      const computed = r.value === undefined ? null : r.value;

      // injeta compat + chave para join
      const out = withCompatFields(item, computed);

      // chave canônica para JOIN:
      // - se existe club_id no item, use ele
      // - senão, usa a key do agregador (já normalizada)
      out.__club_key = item?.club_id ? String(item.club_id) : r.key;

      // reforça display “original”
      out.club = r.display;
      out.label = r.display;
      out.name = r.display;

      // ========= NORMALIZAÇÃO CRÍTICA =========
      if (computed !== null && computed !== undefined) {
        out._computed_value = computed;
        out.value = computed;
        out.score = computed;
        out.iap = computed;
        out.iap_score = computed;
      }
      // =======================================

      return out;
    });
  }, [data]);

  // DEBUG (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Ranking debug -> effectiveDate:', effectiveDate);
      // eslint-disable-next-line no-console
      console.log('Ranking debug -> data (raw)[0..3]:', Array.isArray(data) ? data.slice(0, 4) : data);
      // eslint-disable-next-line no-console
      console.log('Ranking debug -> rankedData[0..3]:', Array.isArray(rankedData) ? rankedData.slice(0, 4) : rankedData);
    }
  }, [effectiveDate, data, rankedData]);

  const DebugPanel = () => {
    if (process.env.NODE_ENV === 'production') return null;
    const sample = Array.isArray(data)
      ? data.slice(0, 6).map((it) => ({
          club: getClubName(it),
          key: clubKeyFromItem(it),
          raw: it?.iap_score ?? it?.score ?? it?.iap ?? it?.value ?? null,
          parsed: pickIapNumber(it),
          club_id: it?.club_id ?? null,
        }))
      : [];
    const rankedSample = Array.isArray(rankedData)
      ? rankedData.slice(0, 6).map((it) => ({
          club: getClubName(it),
          key: it.__club_key,
          club_id: it?.club_id ?? null,
          iap_score: it.iap_score,
          score: it.score,
          _computed_value: it._computed_value,
          rank_position: it.rank_position,
        }))
      : [];
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

  // opções de clubes (por display)
  const clubOptions = useMemo(() => {
    if (!Array.isArray(rankedData)) return [];
    const names = rankedData.map(getClubName).filter((n) => n && n !== '—');
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [rankedData]);

  // rows para ChartPanel (coloca aliases para maximizar compatibilidade)
  // CORREÇÃO: __club_key canônica (club_id quando existir)
  const baseRows = useMemo(() => {
    if (!Array.isArray(rankedData)) return [];
    return rankedData
      .map((item) => {
        const club = getClubName(item);

        const key =
          (item?.club_id ? String(item.club_id) : null) ||
          item.__club_key ||
          normalizeClubKey(club);

        let value = toNumber(item?._computed_value);
        if (value === null) value = pickIapNumber(item);

        const wasNull = value === null;
        if (value === null) value = 0;

        return {
          club,
          __club_key: key,
          value,
          score: value,
          iap_score: value,
          iap: value,
          rawItem: item,
          wasNull,
        };
      })
      .filter((r) => r.club && r.club !== '—');
  }, [rankedData]);

  const rows = useMemo(() => {
    if (!selectedClub) return baseRows;
    return baseRows.filter((r) => r.club === selectedClub);
  }, [baseRows, selectedClub]);

  // tableItems para Insights/TopMovers (antes também usado pela tabela)
  const tableItems = useMemo(() => {
    if (selectedClub) return rows.map((r) => r.rawItem);
    return Array.isArray(rankedData) ? rankedData : [];
  }, [selectedClub, rows, rankedData]);

  /* ========== prev-day (trend + deltas) ==========
     CORREÇÃO: indexa prevRankMap/prevMetricsMap também por club_id (além do nome).
  */
  const prevFetchCtrlRef = useRef(null);
  const [prevRankMap, setPrevRankMap] = useState(new Map()); // key -> rank
  const [prevMetricsMap, setPrevMetricsMap] = useState(new Map()); // key -> {rank, score, volume, sent}
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
        const res = await fetch(`/api/daily_ranking?date=${encodeURIComponent(p)}`, {
          signal: ctrl.signal,
        });

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

          const display = getClubName(it);
          const norm = normalizeClubKey(display);
          const cid = it?.club_id ? String(it.club_id) : '';

          const key = cid || norm;

          if (!display || display === '—' || !key) continue;

          const rp = toNumber(it?.rank_position);
          const rankPos = rp !== null ? rp : i + 1;

          const score = pickIapNumber(it);
          const volume = toNumber(it?.volume_total);
          const sent = toNumber(it?.sentiment_score);

          const payload = {
            rank: rankPos,
            score,
            iap: score,
            iap_score: score,
            value: score,
            volume,
            sent,
          };

          // rank: 3 chaves
          rm.set(display, rankPos);
          rm.set(norm, rankPos);
          if (cid) rm.set(cid, rankPos);

          // metrics: 3 chaves
          mm.set(display, payload);
          mm.set(norm, payload);
          if (cid) mm.set(cid, payload);
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

    const display = getClubName(item);

    const key =
      (item?.club_id ? String(item.club_id) : null) ||
      item?.__club_key ||
      normalizeClubKey(display);

    const prevRank =
      prevRankMap.get(key) ??
      prevRankMap.get(display) ??
      prevRankMap.get(normalizeClubKey(display));

    if (!prevDateUsed || prevRank === undefined || prevRank === null || !currRank) {
      return <span style={{ opacity: 0.7 }}>—</span>;
    }

    const delta = prevRank - currRank;

    if (delta > 0) return <TrendBadge direction="up" value={delta} />;
    if (delta < 0) return <TrendBadge direction="down" value={Math.abs(delta)} />;
    return <TrendBadge direction="flat" value={0} />;
  }

  /* ========== compare A/B (series) — dedupe por clube ==========
     Resumo A->B: normaliza itens A e B para buildAbSummary conseguir achar nomes + iap.
  */
  const compareFetchCtrlRef = useRef(null);

  const [compareSelected, setCompareSelected] = useState([]); // labels: "Clube", "Clube (A)", "Clube (B)"
  const [compareByClub, setCompareByClub] = useState({}); // cache: { realName: series[] }

  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState(null);

  const [compareDateB, setCompareDateB] = useState('');
  const [top5BLoading, setTop5BLoading] = useState(false);
  const [top5BError, setTop5BError] = useState(null);
  const [abSummary, setAbSummary] = useState(null);

  useEffect(() => {
    const selectedRealNames = Array.from(new Set(compareSelected.map((label) => stripAB(label)).filter(Boolean)));
    const need = selectedRealNames.filter((realName) => !compareByClub[realName]);
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

        for (const realName of need) {
          if (ctrl.signal.aborted) throw new Error('Abortado');

          const res = await fetch(`/api/club_series?club=${encodeURIComponent(realName)}&limit_days=365`, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`Falha ao buscar série: ${realName}`);

          const json = await res.json();
          updates[realName] = normalizeSeries(json);
        }

        if (!cancelled) setCompareByClub((prev) => ({ ...prev, ...updates }));
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
  }, [compareSelected, compareByClub]);

  const compareAligned = useMemo(() => {
    const selected = compareSelected.filter((label) => !!compareByClub[stripAB(label)]);
    if (selected.length === 0) return { labels: [], datasets: [] };

    const allDatesSet = new Set();
    selected.forEach((label) => {
      const realName = stripAB(label);
      (compareByClub[realName] || []).forEach((r) => {
        if (r && r.date) allDatesSet.add(String(r.date).slice(0, 10));
      });
    });

    if (allDatesSet.size === 0) return { labels: [], datasets: [] };

    const dateArr = Array.from(allDatesSet).sort();

    const toUTCDate = (isoYmd) => {
      const [y, m, d] = String(isoYmd).split('-').map((v) => Number(v));
      return new Date(Date.UTC(y, m - 1, d));
    };
    const toISOYMD = (dt) => dt.toISOString().slice(0, 10);

    const minDate = dateArr[0];
    const maxDate = dateArr[dateArr.length - 1];

    const labels = [];
    for (let cur = toUTCDate(minDate); cur <= toUTCDate(maxDate); cur.setUTCDate(cur.getUTCDate() + 1)) {
      labels.push(toISOYMD(new Date(cur)));
    }

    let manualIndex = 0;
    const datasets = selected.map((label) => {
      const realName = stripAB(label);
      const map = new Map((compareByClub[realName] || []).map((r) => [String(r.date).slice(0, 10), r.value]));
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
  }, [compareSelected, compareByClub]);

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
                const label = typeof this.getLabelForValue === 'function' ? this.getLabelForValue(val) : val;
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

  if (rankingError) {
    return (
      <div className={ctrlStyles.container}>
        Erro ao buscar ranking: {String(rankingError?.message ?? rankingError)}
        <button className={btnStyles.btn} onClick={() => mutateRanking()} style={{ marginLeft: 12 }}>
          Tentar novamente
        </button>
      </div>
    );
  }

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
              (data resolvida automaticamente para <strong>{formatDateBR(resolvedDate)}</strong> — você selecionou {formatDateBR(requestedDate)})
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
            onClick={() => setSelectedDate('')}
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

          <button className={btnStyles.btn} onClick={() => setSelectedClub('')} disabled={!selectedClub}>
            Limpar clube
          </button>
        </div>

        {/* Insights */}
        <section className={ctrlStyles.heroCard} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Insights do dia</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Base: {formatDateBR(effectiveDate)} {prevDateUsed ? `vs ${formatDateBR(prevDateUsed)}` : '(sem dia anterior)'}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <InsightsPanel
              tableItems={tableItems}
              prevMetricsMap={prevMetricsMap}
              prevDateUsed={prevDateUsed}
              effectiveDate={effectiveDate}
              linkClub={linkClub}
            />
          </div>
        </section>

        {/* Top Movers */}
        <section className={ctrlStyles.topicCard} style={{ marginTop: 12 }}>
          <TopMovers
            tableItems={tableItems}
            prevRankMap={prevRankMap}
            prevDateUsed={prevDateUsed}
          />
        </section>

        {/* Chart */}
        <div style={{ marginTop: 12 }}>
          <ChartPanel
            rows={rows}
            loading={rankingLoading}
            prevMetricsMap={prevMetricsMap}
            prevRankMap={prevRankMap}
            prevDateUsed={prevDateUsed}
            effectiveDate={effectiveDate}
          />
        </div>

        {/* tabela removida */}

        {/* Comparação (card) */}
        <section className={ctrlStyles.topicCard} style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Comparar clubes — evolução do IAP
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Top 5 vs Top 5: compara o Top 5 do ranking exibido (Data A) com o Top 5 de uma segunda data (Data B).
            </div>

            {/* Linha única: Data A / Data B / seletor / botão */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Data A */}
              <div style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  style={{
                    width: 14,
                    height: 12,
                    display: 'inline-block',
                    background: COLOR_A,
                    borderRadius: 2,
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}
                />
                <strong>Data A {effectiveDate ? formatDateBR(effectiveDate) : '—'}</strong>
              </div>

              {/* Data B */}
              <div style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  style={{
                    width: 14,
                    height: 12,
                    display: 'inline-block',
                    background: COLOR_B,
                    borderRadius: 2,
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}
                />
                <strong>Data B {compareDateB ? formatDateBR(compareDateB) : '—'}</strong>
              </div>

              {/* Seletor Data B */}
              <label style={{ fontSize: 12, marginLeft: 6 }}>Selecionar Data B:</label>
              <input
                type="date"
                value={compareDateB}
                onChange={(e) => {
                  setCompareDateB(e.target.value);
                  setTop5BError(null);
                }}
                className={ctrlStyles.dateInput}
              />

              {/* Botão */}
              <button
                className={btnStyles.btn}
                onClick={async () => {
                  setTop5BError(null);
                  setTop5BLoading(true);

                  try {
                    if (!compareDateB) throw new Error('Selecione a Data B.');

                    // Normaliza A (tableItems) e B (API) para garantir rank_position + ordenação + iap
                    const normalizeForAB = (arrRaw) => {
                      const arr = Array.isArray(arrRaw) ? arrRaw : [];
                    
                      const normalized = arr.map((it, i) => {
                        const out = withCompatFields(it, pickIapNumber(it));
                    
                        // garante rank_position numérico (fallback i+1)
                        const rp = toNumber(out?.rank_position);
                        out.rank_position = rp !== null ? rp : (i + 1);
                    
                        return out;
                      });
                    
                      // ordena por rank_position asc (Top 1 primeiro)
                      normalized.sort((a, b) => {
                        const ra = toNumber(a?.rank_position) ?? 999999;
                        const rb = toNumber(b?.rank_position) ?? 999999;
                        return ra - rb;
                      });
                    
                      return normalized;
                    };
                    
                    const aItemsRaw = Array.isArray(tableItems) ? tableItems : [];
                    const aItems = normalizeForAB(aItemsRaw);
                    
                    const resB = await fetch(`/api/daily_ranking?date=${encodeURIComponent(compareDateB)}`);
                    if (!resB.ok) throw new Error(`Falha ao buscar ranking da Data B (${resB.status})`);
                    
                    const bJson = await resB.json();
                    const bRaw = Array.isArray(bJson) ? bJson : Array.isArray(bJson?.data) ? bJson.data : [];
                    const bItems = normalizeForAB(bRaw);
                    
                    // Top 5 real (por rank)
                    const aTop5Items = aItems.slice(0, 5);
                    const bTop5Items = bItems.slice(0, 5);
                    
                    // Resumo A → B baseado no Top 5
                    setAbSummary(buildAbSummary(aTop5Items, bTop5Items));
                    
                    // labels para linhas (A) e (B)
                    const topA = aTop5Items.map((it) => getClubName(it)).filter((n) => n && n !== '—');
                    const topB = bTop5Items.map((it) => getClubName(it)).filter((n) => n && n !== '—');

                    const merged = [...topA.map((n) => `${n} (A)`), ...topB.map((n) => `${n} (B)`)];

                    setCompareError(null);
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

            {top5BError ? (
              <div style={{ fontSize: 12, color: 'crimson' }}>
                Erro: {String(top5BError?.message ?? top5BError)}
              </div>
            ) : null}

            {abSummary ? (
              <div style={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Resumo A → B</div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Entraram no Top 5 (B)</div>
                    <div style={{ fontSize: 13 }}>
                      {abSummary.entered?.length ? abSummary.entered.join(', ') : 'Nenhuma mudança'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Saíram do Top 5 (A)</div>
                    <div style={{ fontSize: 13 }}>
                      {abSummary.exited?.length ? abSummary.exited.join(', ') : 'Nenhuma mudança'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Maior alta (Δ IAP)</div>
                    <div style={{ fontSize: 13 }}>
                      {abSummary.bestUp
                        ? `${abSummary.bestUp.name}: +${Math.abs(Number(abSummary.bestUp.delta) || 0).toFixed(2)}`
                        : '—'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Maior queda (Δ IAP)</div>
                    <div style={{ fontSize: 13 }}>
                      {abSummary.bestDown
                        ? `${abSummary.bestDown.name}: -${Math.abs(Number(abSummary.bestDown.delta) || 0).toFixed(2)}`
                        : '—'}
                    </div>
                  </div>
                </div>
                
                {/* DEBUG TEMPORÁRIO — remover depois */}
                {abSummary?.deltas?.length ? (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Debug deltas (A → B)
                    </div>
                    <pre style={{ maxHeight: 180, overflow: 'auto', margin: 0 }}>
                      {JSON.stringify(abSummary.deltas.slice(0, 10), null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              Modo manual: selecione até 5 clubes para sobrepor as linhas no mesmo gráfico.
            </div>

            {clubsLoading ? (
              <div>Carregando clubes…</div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {clubs.map((c) => {
                  const name = c?.label;
                  if (!name) return null;

                  const checked = compareSelected.includes(name);
                  const hasAB = compareSelected.some((x) => /\((A|B)\)\s*$/.test(String(x)));
                  const limit = hasAB ? 10 : 5;
                  const disabled = !checked && compareSelected.length >= limit;

                  return (
                    <label key={name} style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: disabled ? 0.6 : 1 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => {
                          setCompareError(null);
                          setCompareSelected((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
                        }}
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Selecionados:{' '}
                <strong>{compareSelected.length}</strong>/
                {compareSelected.some((x) => /\((A|B)\)\s*$/.test(String(x))) ? 10 : 5}
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
                onClick={() => {
                  setCompareSelected([]);
                  setCompareError(null);
                }}
                disabled={compareSelected.length === 0}
              >
                Limpar seleção
              </button>

              {compareBusy ? <span style={{ fontSize: 12, opacity: 0.75 }}>Carregando séries…</span> : null}
            </div>

            {compareError ? (
              <div style={{ fontSize: 13, marginTop: 8 }}>
                Erro ao carregar comparação: {String(compareError?.message ?? compareError)}
              </div>
            ) : null}

            {compareAligned.datasets && compareAligned.datasets.length >= 1 ? (
              <div style={{ height: 420, width: '100%', marginTop: 12 }}>
                <Line data={{ labels: compareAligned.labels, datasets: compareAligned.datasets }} options={lineOptions} />
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 12 }}>
                Selecione pelo menos 1 clube (modo manual) ou use “Carregar Top 5 A + B”.
              </div>
            )}
          </div>
        </section>

        {/* Nota explicativa sobre datas */}
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          Observação: o gráfico mostra as datas disponíveis nas séries que foram carregadas para os clubes selecionados.
          Se não aparecem pontos após 23/12, significa que as séries retornadas pela API não têm valores depois dessa data.
          Para exibir mais histórico, aumente o parâmetro de busca das séries (por exemplo <code>?limit_days=365</code>) ou confirme que a API/DB contém dados posteriores.
        </div>
      </main>
    </div>
  );
}
