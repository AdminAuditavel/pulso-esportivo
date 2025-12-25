// pulso-publico/components/Ranking.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

/* ============================
   Helpers
============================ */
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
  if (item.club_id) return item.club_id.slice(0, 8) + '…';
  return '—';
}

function toNumber(x) {
  const n = typeof x === 'string' ? Number(String(x).replace(',', '.')) : Number(x);
  return Number.isFinite(n) ? n : null;
}

function isLabelA(label) {
  return /\(A\)\s*$/.test(String(label));
}
function isLabelB(label) {
  return /\(B\)\s*$/.test(String(label));
}
function stripAB(label) {
  return String(label).replace(/\s*\((A|B)\)\s*$/, '');
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

function parseYYYYMMDD(s) {
  if (!s || typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}
function formatYYYYMMDD(dateUtc) {
  if (!(dateUtc instanceof Date)) return '';
  const y = dateUtc.getUTCFullYear();
  const m = String(dateUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function prevDay(yyyyMMdd) {
  const dt = parseYYYYMMDD(yyyyMMdd);
  if (!dt) return '';
  dt.setUTCDate(dt.getUTCDate() - 1);
  return formatYYYYMMDD(dt);
}
function getAggregationDateFromItem(item) {
  const d = item?.aggregation_date ?? item?.metric_date ?? item?.date;
  return d ? String(d).slice(0, 10) : '';
}

function buildAbSummary(aItems, bItems) {
  const aNames = aItems.map(getClubName).filter((n) => n && n !== '—');
  const bNames = bItems.map(getClubName).filter((n) => n && n !== '—');

  const setA = new Set(aNames);
  const setB = new Set(bNames);

  const entered = bNames.filter((n) => !setA.has(n));
  const exited = aNames.filter((n) => !setB.has(n));

  const aMap = new Map(
    aItems.map((it) => [
      getClubName(it),
      { score: toNumber(it?.score ?? it?.iap), rank: toNumber(it?.rank_position) },
    ])
  );
  const bMap = new Map(
    bItems.map((it) => [
      getClubName(it),
      { score: toNumber(it?.score ?? it?.iap), rank: toNumber(it?.rank_position) },
    ])
  );

  const common = aNames.filter((n) => setB.has(n));

  let bestUp = null;
  let bestDown = null;
  const deltas = [];

  for (const name of common) {
    const a = aMap.get(name);
    const b = bMap.get(name);
    const as = a?.score;
    const bs = b?.score;
    if (as === null || as === undefined || bs === null || bs === undefined) continue;

    const delta = bs - as;
    deltas.push({
      name,
      delta,
      aScore: as,
      bScore: bs,
      aRank: a?.rank ?? null,
      bRank: b?.rank ?? null,
    });

    if (!bestUp || delta > bestUp.delta) bestUp = { name, delta };
    if (!bestDown || delta < bestDown.delta) bestDown = { name, delta };
  }

  return {
    entered,
    exited,
    bestUp,
    bestDown,
    deltas: deltas.sort((x, y) => y.delta - x.delta),
  };
}

// Paleta manual (até 5)
const MANUAL_PALETTE = ['#2563EB', '#16A34A', '#7C3AED', '#DC2626', '#0EA5E9'];
// Cores fixas para A/B
const COLOR_A = '#2563EB'; // azul
const COLOR_B = '#F97316'; // laranja

/* ============================
   Component
============================ */
export default function Ranking() {
  /* ============================
     Ranking diário (tabela + bar)
  ============================ */
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD
  const [selectedClub, setSelectedClub] = useState(''); // nome
   
  const fetchData = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const qs = date ? `?date=${encodeURIComponent(date)}` : '';
      const res = await fetch(`/api/daily_ranking${qs}`);
      if (!res.ok) throw new Error('Erro ao buscar dados');
  
      const json = await res.json();
  
      // compatibilidade:
      // - API antiga: retorna array direto
      // - API nova: retorna { resolved_date, data: [...] }
      const arr = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : [];
  
      setData(arr);
  
      // opcional: se quiser mostrar a data resolvida (fallback)
      if (!Array.isArray(json) && json?.resolved_date) {
        // setResolvedDate(json.resolved_date)
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data efetiva (quando selectedDate vazio, inferimos do payload)
  const effectiveDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    if (!Array.isArray(data) || data.length === 0) return '';
    return getAggregationDateFromItem(data[0]) || '';
  }, [selectedDate, data]);

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

  const barData = useMemo(() => {
    return {
      labels: rows.map((r) => r.club),
      datasets: [{ label: 'IAP', data: rows.map((r) => r.value) }],
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

  const tableItems = useMemo(() => {
    return selectedClub ? rows.map((r) => r.rawItem) : Array.isArray(data) ? data : [];
  }, [selectedClub, rows, data]);

  /* ============================
     Tendência (vs dia anterior)
     + Map completo do dia anterior (rank/score/volume/sent)
  ============================ */
  const [prevRankMap, setPrevRankMap] = useState(new Map()); // Map<clubName, rank_position>
  const [prevMetricsMap, setPrevMetricsMap] = useState(new Map()); // Map<clubName, {rank, score, volume, sent}>
  const [prevDateUsed, setPrevDateUsed] = useState(''); // YYYY-MM-DD
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevError, setPrevError] = useState(null);

  useEffect(() => {
    async function fetchPrevRanking() {
      setPrevError(null);

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

      setPrevDateUsed(p);
      setPrevLoading(true);

      try {
        const res = await fetch(`/api/daily_ranking?date=${encodeURIComponent(p)}`);
        if (!res.ok) {
          setPrevRankMap(new Map());
          setPrevMetricsMap(new Map());
          return;
        }
        const json = await res.json();
        const arr = Array.isArray(json) ? json : [];

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

        setPrevRankMap(rm);
        setPrevMetricsMap(mm);
      } catch (e) {
        setPrevError(e);
        setPrevRankMap(new Map());
        setPrevMetricsMap(new Map());
      } finally {
        setPrevLoading(false);
      }
    }

    fetchPrevRanking();
  }, [effectiveDate]);

  function renderTrend(item, idx) {
    const currRank = toNumber(item?.rank_position) !== null ? toNumber(item?.rank_position) : idx + 1;
    const name = getClubName(item);
    const prevRank = prevRankMap.get(name);

    if (!prevDateUsed || !prevRank || !currRank) return <span style={{ opacity: 0.7 }}>—</span>;

    const delta = prevRank - currRank;

    if (delta > 0) return <span style={{ color: '#16A34A', fontWeight: 700 }}>↑ +{delta}</span>;
    if (delta < 0) return <span style={{ color: '#DC2626', fontWeight: 700 }}>↓ {delta}</span>;
    return <span style={{ opacity: 0.85, fontWeight: 700 }}>→ 0</span>;
  }

  /* ============================
     Top Movers (subiram / caíram)
  ============================ */
  const movers = useMemo(() => {
    if (!Array.isArray(tableItems) || tableItems.length === 0) return null;
    if (!prevDateUsed || !(prevRankMap instanceof Map) || prevRankMap.size === 0) return null;

    const all = [];

    for (let i = 0; i < tableItems.length; i += 1) {
      const it = tableItems[i];
      const name = getClubName(it);
      if (!name || name === '—') continue;

      const currRank = toNumber(it?.rank_position) !== null ? toNumber(it?.rank_position) : i + 1;
      const prevRank = prevRankMap.get(name);
      if (!prevRank || !currRank) continue;

      const delta = prevRank - currRank; // >0 subiu; <0 caiu
      if (delta === 0) continue;

      all.push({ name, currRank, prevRank, delta });
    }

    const up = [...all].filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
    const down = [...all].filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);

    return { up, down };
  }, [tableItems, prevDateUsed, prevRankMap]);

  /* ============================
     Insights do dia
  ============================ */
  const insights = useMemo(() => {
    if (!Array.isArray(tableItems) || tableItems.length === 0) return null;

    // Leader (#1)
    const first = tableItems[0];
    const leaderName = getClubName(first);
    const leaderScore = toNumber(first?.score ?? first?.iap ?? first?.iap_score);

    // Max volume
    let maxVol = null;
    let maxVolName = null;

    // Best / worst sentiment
    let bestSent = null;
    let bestSentName = null;
    let worstSent = null;
    let worstSentName = null;

    // Biggest score delta vs prev day (needs prevMetricsMap)
    let bestUp = null; // {name, delta, prev, curr}
    let bestDown = null;

    for (let i = 0; i < tableItems.length; i += 1) {
      const it = tableItems[i];
      const name = getClubName(it);
      if (!name || name === '—') continue;

      const currScore = toNumber(it?.score ?? it?.iap ?? it?.iap_score);
      const currVol = toNumber(it?.volume_total);
      const currSent = toNumber(it?.sentiment_score);

      if (currVol !== null) {
        if (maxVol === null || currVol > maxVol) {
          maxVol = currVol;
          maxVolName = name;
        }
      }

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

      // Δ score vs prev day
      const prev = prevMetricsMap.get(name);
      const prevScore = prev ? prev.score : null;
      if (currScore !== null && prevScore !== null && prevScore !== undefined) {
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
    };
  }, [tableItems, prevMetricsMap, prevDateUsed]);

  /* ============================
     Comparação multi-clubes (linha)
  ============================ */
  const [clubs, setClubs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(true);

  const [compareSelected, setCompareSelected] = useState([]);
  const [compareMap, setCompareMap] = useState({}); // { [label]: normalizedSeries[] }
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState(null);

  const [compareDateB, setCompareDateB] = useState(''); // YYYY-MM-DD
  const [top5BLoading, setTop5BLoading] = useState(false);
  const [top5BError, setTop5BError] = useState(null);

  const [abSummary, setAbSummary] = useState(null);

  const fetchClubs = async () => {
    setClubsLoading(true);
    try {
      const res = await fetch('/api/clubs');
      if (!res.ok) throw new Error('Erro ao carregar lista de clubes');
      const json = await res.json();
      setClubs(Array.isArray(json) ? json : []);
    } catch {
      setClubs([]);
    } finally {
      setClubsLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  const isABMode = useMemo(() => {
    return compareSelected.some((x) => /\((A|B)\)\s*$/.test(String(x)));
  }, [compareSelected]);

  const maxSelectable = isABMode ? 10 : 5;

  const toggleCompare = (clubName) => {
    setCompareError(null);
    setTop5BError(null);

    setCompareSelected((prev) => {
      const exists = prev.includes(clubName);
      if (exists) return prev.filter((x) => x !== clubName);

      const ab = prev.some((x) => /\((A|B)\)\s*$/.test(String(x)));
      const max = ab ? 10 : 5;
      if (prev.length >= max) return prev;

      return [...prev, clubName];
    });
  };

  useEffect(() => {
    const need = compareSelected.filter((label) => !compareMap[label]);
    if (need.length === 0) return;

    let cancelled = false;

    async function loadMissing() {
      setCompareBusy(true);
      try {
        const updates = {};
        for (const label of need) {
          const realName = stripAB(label);
          const res = await fetch(`/api/club_series?club=${encodeURIComponent(realName)}&limit_days=180`);
          if (!res.ok) throw new Error(`Falha ao buscar série: ${label}`);
          const json = await res.json();
          updates[label] = normalizeSeries(json);
        }
        if (!cancelled) setCompareMap((prev) => ({ ...prev, ...updates }));
      } catch (e) {
        if (!cancelled) setCompareError(e);
      } finally {
        if (!cancelled) setCompareBusy(false);
      }
    }

    loadMissing();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareSelected]);

  useEffect(() => {
    const setSel = new Set(compareSelected);
    const keys = Object.keys(compareMap);
    const toRemove = keys.filter((k) => !setSel.has(k));
    if (toRemove.length === 0) return;

    setCompareMap((prev) => {
      const next = { ...prev };
      toRemove.forEach((k) => delete next[k]);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (isLabelA(label)) color = COLOR_A;
      else if (isLabelB(label)) color = COLOR_B;
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

  /* ============================
     Render
  ============================ */
  if (loading) return <div>Carregando ranking…</div>;

  if (error)
    return (
      <div>
        Erro ao buscar ranking: {error.message}
        <button onClick={() => fetchData(selectedDate)} style={{ marginLeft: 12 }}>
          Tentar novamente
        </button>
      </div>
    );

  if (!data || !Array.isArray(data) || data.length === 0) return <div>Nenhum dado disponível</div>;

  const linkClub = (name) => `/club/${encodeURIComponent(name)}`;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h2 style={{ margin: 0 }}>Ranking Diário</h2>

      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Exibindo: <strong>{effectiveDate || '—'}</strong>
        {selectedClub ? (
          <>
            {' '}
            | Clube: <strong>{selectedClub}</strong>
          </>
        ) : null}
        {prevLoading ? (
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>Calculando comparações…</span>
        ) : prevDateUsed ? (
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>vs {prevDateUsed}</span>
        ) : null}
      </div>

      {prevError ? (
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          Aviso: não foi possível carregar o dia anterior ({prevError.message})
        </div>
      ) : null}

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>Data:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            const d = e.target.value;
            setSelectedDate(d);
            fetchData(d);
          }}
        />
        <button
          onClick={() => {
            setSelectedDate('');
            fetchData('');
          }}
          disabled={loading}
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

      {/* INSIGHTS DO DIA */}
      <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Insights do dia</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Base: {effectiveDate || '—'} {insights?.hasPrev ? `vs ${prevDateUsed}` : '(sem dia anterior)'}
          </div>
        </div>

        {!insights ? (
          <div style={{ fontSize: 12, opacity: 0.8 }}>Sem dados.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Líder do dia</div>
              <div style={{ fontSize: 14 }}>
                <Link href={linkClub(insights.leader.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
                  {insights.leader.name}
                </Link>{' '}
                {insights.leader.score !== null ? (
                  <span style={{ opacity: 0.85 }}>({insights.leader.score.toFixed(2)})</span>
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
                  <span style={{ color: '#16A34A', fontWeight: 700 }}>
                    +{insights.bestUp.delta.toFixed(2)}
                  </span>{' '}
                  <span style={{ opacity: 0.75 }}>
                    ({insights.bestUp.prev.toFixed(2)} → {insights.bestUp.curr.toFixed(2)})
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.8 }}>—</div>
              )}
            </div>

            <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Maior queda de IAP (Δ)</div>
              {insights.hasPrev && insights.bestDown ? (
                <div style={{ fontSize: 14 }}>
                  <Link href={linkClub(insights.bestDown.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
                    {insights.bestDown.name}
                  </Link>{' '}
                  <span style={{ color: '#DC2626', fontWeight: 700 }}>
                    {insights.bestDown.delta.toFixed(2)}
                  </span>{' '}
                  <span style={{ opacity: 0.75 }}>
                    ({insights.bestDown.prev.toFixed(2)} → {insights.bestDown.curr.toFixed(2)})
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.8 }}>—</div>
              )}
            </div>

            <div style={{ border: '1px solid #f2f2f2', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Maior volume do dia</div>
              {insights.maxVol ? (
                <div style={{ fontSize: 14 }}>
                  <Link href={linkClub(insights.maxVol.name)} style={{ textDecoration: 'underline', fontWeight: 700 }}>
                    {insights.maxVol.name}
                  </Link>{' '}
                  <span style={{ opacity: 0.85 }}>({insights.maxVol.value})</span>
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
                    <Link
                      href={linkClub(insights.worstSent.name)}
                      style={{ textDecoration: 'underline', fontWeight: 700 }}
                    >
                      {insights.worstSent.name}
                    </Link>{' '}
                    <span style={{ color: '#DC2626', fontWeight: 700 }}>{insights.worstSent.value.toFixed(2)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {!insights?.hasPrev ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Observação: para “Maior alta/queda de IAP (Δ)”, é necessário existir ranking do dia anterior.
          </div>
        ) : null}
      </section>

      {/* TOP MOVERS */}
      <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Top Movers (posição)</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Base: ranking exibido ({effectiveDate || '—'}) vs {prevDateUsed || 'dia anterior'}
          </div>
        </div>

        {!movers ? (
          <div style={{ fontSize: 12, opacity: 0.8 }}>Sem comparação disponível (não há dados do dia anterior).</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>Mais subiram</div>
              {movers.up.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.8 }}>—</div>
              ) : (
                <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                  {movers.up.map((m) => (
                    <li key={m.name} style={{ marginBottom: 6, fontSize: 13 }}>
                      <Link href={linkClub(m.name)} style={{ textDecoration: 'underline' }}>
                        {m.name}
                      </Link>{' '}
                      <span style={{ fontWeight: 700, color: '#16A34A' }}>↑ +{m.delta}</span>{' '}
                      <span style={{ opacity: 0.75 }}>
                        ({m.prevRank} → {m.currRank})
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>Mais caíram</div>
              {movers.down.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.8 }}>—</div>
              ) : (
                <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                  {movers.down.map((m) => (
                    <li key={m.name} style={{ marginBottom: 6, fontSize: 13 }}>
                      <Link href={linkClub(m.name)} style={{ textDecoration: 'underline' }}>
                        {m.name}
                      </Link>{' '}
                      <span style={{ fontWeight: 700, color: '#DC2626' }}>↓ {m.delta}</span>{' '}
                      <span style={{ opacity: 0.75 }}>
                        ({m.prevRank} → {m.currRank})
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </section>

      {/* GRÁFICO (ranking do dia) */}
      <div style={{ height: 360, width: '100%' }}>
        <Bar data={barData} options={barOptions} />
      </div>

      {/* TABELA */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Posição</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Tendência</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Clube</th>
            <th style={{ textAlign: 'left', padding: 8 }}>IAP</th>
          </tr>
        </thead>
        <tbody>
          {tableItems.map((item, idx) => {
            const clubName = getClubName(item);
            const href = `/club/${encodeURIComponent(clubName)}`;
            const rankPos = toNumber(item?.rank_position) ?? idx + 1;

            return (
              <tr key={item.club_id ?? idx}>
                <td style={{ padding: 8 }}>{rankPos}</td>
                <td style={{ padding: 8 }}>{renderTrend(item, idx)}</td>
                <td style={{ padding: 8 }}>
                  {clubName && clubName !== '—' ? (
                    <Link href={href} style={{ textDecoration: 'underline' }}>
                      {clubName}
                    </Link>
                  ) : (
                    clubName
                  )}
                </td>
                <td style={{ padding: 8 }}>{item.score ?? item.iap ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ============================
          COMPARAÇÃO MULTI-CLUBES
         ============================ */}
      <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Comparar clubes — evolução do IAP</div>

        {/* TOP 5 vs TOP 5 (A vs B) */}
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Top 5 vs Top 5: compara o Top 5 do ranking exibido (Data A) com o Top 5 de uma segunda data (Data B).
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12 }}>
              Data A: <strong>{effectiveDate || '—'}</strong>{' '}
              <span style={{ marginLeft: 8 }}>
                (cor A: <span style={{ color: COLOR_A, fontWeight: 700 }}>azul</span>)
              </span>
            </div>

            <label style={{ fontSize: 12 }}>Data B:</label>
            <input
              type="date"
              value={compareDateB}
              onChange={(e) => {
                setCompareDateB(e.target.value);
                setTop5BError(null);
              }}
            />

            <div style={{ fontSize: 12 }}>
              cor B: <span style={{ color: COLOR_B, fontWeight: 700 }}>laranja</span>
            </div>

            <button
              onClick={async () => {
                setTop5BError(null);
                setTop5BLoading(true);
                try {
                  if (!compareDateB) throw new Error('Selecione a Data B.');

                  const aItems = Array.isArray(data) ? data : [];
                  const resB = await fetch(`/api/daily_ranking?date=${encodeURIComponent(compareDateB)}`);
                  if (!resB.ok) throw new Error(`Falha ao buscar ranking da Data B (${resB.status})`);
                  const bJson = await resB.json();
                  const bItems = Array.isArray(bJson) ? bJson : [];

                  const topA = aItems
                    .map((it) => getClubName(it))
                    .filter((n) => n && n !== '—')
                    .slice(0, 5);

                  const topB = bItems
                    .map((it) => getClubName(it))
                    .filter((n) => n && n !== '—')
                    .slice(0, 5);

                  setAbSummary(buildAbSummary(aItems.slice(0, 20), bItems.slice(0, 20)));

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
              title="Carrega Top 5 da Data A + Top 5 da Data B e sobrepõe no gráfico"
            >
              Carregar Top 5 A + B
            </button>

            {top5BLoading ? <span style={{ fontSize: 12, opacity: 0.75 }}>Carregando…</span> : null}
          </div>

          {top5BError ? <div style={{ fontSize: 12 }}>Erro: {top5BError.message}</div> : null}

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

                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Maior alta (Δ IAP)</div>
                  <div style={{ fontSize: 13 }}>
                    {abSummary.bestUp ? `${abSummary.bestUp.name}: +${abSummary.bestUp.delta.toFixed(2)}` : '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Maior queda (Δ IAP)</div>
                  <div style={{ fontSize: 13 }}>
                    {abSummary.bestDown ? `${abSummary.bestDown.name}: ${abSummary.bestDown.delta.toFixed(2)}` : '—'}
                  </div>
                </div>
              </div>

              {abSummary.deltas?.length ? (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Observação: variações calculadas para clubes presentes nos dois rankings (Top 20 A e Top 20 B).
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* MODO MANUAL */}
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Modo manual: selecione até 5 clubes para sobrepor as linhas no mesmo gráfico.
        </div>

        {clubsLoading ? (
          <div>Carregando clubes…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            {clubsForCompareUI.map((name) => {
              const checked = compareSelected.includes(name);
              const disabled = !checked && compareSelected.length >= maxSelectable;

              return (
                <label
                  key={name}
                  style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: disabled ? 0.6 : 1 }}
                >
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleCompare(name)} />
                  <span>{name}</span>
                </label>
              );
            })}
          </div>
        )}

        {/* AÇÕES */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Selecionados: <strong>{compareSelected.length}</strong>/{maxSelectable}
          </div>

          <button
            onClick={() => {
              const source = Array.isArray(tableItems) ? tableItems : [];
              const top = source
                .map((it) => getClubName(it))
                .filter((n) => n && n !== '—')
                .slice(0, 5);

              setTop5BError(null);
              setCompareError(null);
              setAbSummary(null);
              setCompareSelected(top);
            }}
            disabled={!Array.isArray(tableItems) || tableItems.length === 0}
            title="Seleciona automaticamente os 5 primeiros do ranking exibido"
          >
            Top 5 do dia
          </button>

          <button
            onClick={() => {
              setCompareSelected([]);
              setCompareMap({});
              setCompareError(null);
              setTop5BError(null);
              setAbSummary(null);
            }}
            disabled={compareSelected.length === 0}
          >
            Limpar seleção
          </button>

          {compareBusy ? <span style={{ fontSize: 12, opacity: 0.75 }}>Carregando séries…</span> : null}
        </div>

        {compareError ? <div style={{ fontSize: 13 }}>Erro ao carregar comparação: {compareError.message}</div> : null}

        {compareAligned.datasets.length >= 1 ? (
          <div style={{ height: 420, width: '100%' }}>
            <Line data={{ labels: compareAligned.labels, datasets: compareAligned.datasets }} options={lineOptions} />
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Selecione pelo menos 1 clube (modo manual) ou use “Carregar Top 5 A + B”.
          </div>
        )}
      </div>
    </div>
  );
}
