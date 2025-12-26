//pulso-publico/lib/rankingUtils.js

export const NF = new Intl.NumberFormat('pt-BR');

// Palette / cores exportadas para uso em componentes
export const MANUAL_PALETTE = ['#337d26', '#549d45', '#74be63', '#95de82', '#b6ffa0'];
export const COLOR_A = '#337d26'; // cor A (Data A)
export const COLOR_B = '#B6FFA0'; // cor B (Data B)

export function getClubName(item) {
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

export function toNumber(input) {
  if (input === null || input === undefined) return null;

  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }

  let s = String(input).trim();
  if (!s) return null;

  // negativo no formato (123,45)
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  // remove espaços e símbolos irrelevantes
  s = s.replace(/\s+/g, '');
  s = s.replace(/[%]/g, '');

  // mantém apenas dígitos, separadores e sinal
  s = s.replace(/[^\d.,+-]/g, '');
  if (!s) return null;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    // pt-BR: 1.234,56 → 1234.56
    s = s.replace(/\./g, '').replace(/,/g, '.');
  } else if (hasComma) {
    // decimal pt-BR: 12,34 → 12.34
    s = s.replace(/,/g, '.');
  } else {
    // remove separadores de milhar
    s = s.replace(/,/g, '');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function isLabelA(label) {
  return /\(A\)\s*$/.test(String(label));
}
export function isLabelB(label) {
  return /\(B\)\s*$/.test(String(label));
}
export function stripAB(label) {
  return String(label).replace(/\s*\((A|B)\)\s*$/, '');
}

export function normalizeSeries(series) {
  const arr = (Array.isArray(series) ? series : [])
    .map((r) => ({
      date: r?.date ? String(r.date).slice(0, 10) : null,
      value: toNumber(r?.value),
    }))
    .filter((r) => r.date && r.value !== null);

  arr.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return arr;
}

export function parseYYYYMMDD(s) {
  if (!s || typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

export function formatYYYYMMDD(dateUtc) {
  if (!(dateUtc instanceof Date)) return '';
  const y = dateUtc.getUTCFullYear();
  const m = String(dateUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function prevDay(yyyyMMdd) {
  const dt = parseYYYYMMDD(yyyyMMdd);
  if (!dt) return '';
  dt.setUTCDate(dt.getUTCDate() - 1);
  return formatYYYYMMDD(dt);
}

export function getAggregationDateFromItem(item) {
  const d = item?.aggregation_date ?? item?.metric_date ?? item?.date;
  return d ? String(d).slice(0, 10) : '';
}

export function formatDateBR(yyyyMMdd) {
  if (!yyyyMMdd) return '—';
  const s = String(yyyyMMdd).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function pickIapFromItem(it) {
  // ordem: tenta todos os campos mais prováveis
  return (
    toNumber(it?._computed_value) ??
    toNumber(it?.iap_score) ??
    toNumber(it?.score) ??
    toNumber(it?.iap) ??
    toNumber(it?.value) ??
    // extras comuns em APIs
    toNumber(it?.iap_total) ??
    toNumber(it?.iapScore) ??
    toNumber(it?.iapValue) ??
    null
  );
}

export function buildAbSummary(aItems, bItems) {
  const aNames = aItems.map(getClubName).filter((n) => n && n !== '—');
  const bNames = bItems.map(getClubName).filter((n) => n && n !== '—');

  const setA = new Set(aNames);
  const setB = new Set(bNames);

  const entered = bNames.filter((n) => !setA.has(n));
  const exited = aNames.filter((n) => !setB.has(n));

  const aMap = new Map(
    aItems.map((it) => [
      getClubName(it),
      { score: pickIapFromItem(it), rank: toNumber(it?.rank_position) },
    ])
  );
  
  const bMap = new Map(
    bItems.map((it) => [
      getClubName(it),
      { score: pickIapFromItem(it), rank: toNumber(it?.rank_position) },
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
