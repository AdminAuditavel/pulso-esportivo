// app/api/club_series/route.js
export async function GET(req) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const clubName = url.searchParams.get('club');
    const limitDays = Number(url.searchParams.get('limit_days') || '90');

    if (!clubName || clubName.trim() === '') {
      return new Response(JSON.stringify({ error: 'Parâmetro club é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const base = supabaseUrl.replace(/\/$/, '') + '/rest/v1';
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: 'application/json',
    };

    const club = clubName.trim();

    // -----------------------------
    // 1) Resolve club -> club_id
    // -----------------------------
    async function resolveClubIdFromClubs(name) {
      const nameCols = ['name_official', 'name']; // seu cenário: name_official existe
      let lastText = '';

      for (const col of nameCols) {
        const p = new URLSearchParams();
        p.set('select', `id,${col}`);
        p.set(col, `eq.${name}`);
        p.set('limit', '1');

        const target = `${base}/clubs?${p.toString()}`;
        const res = await fetch(target, { headers });
        const text = await res.text();

        if (res.ok) {
          let rows = [];
          try {
            rows = JSON.parse(text);
          } catch {
            rows = [];
          }
          if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id) {
            return { clubId: rows[0].id, matchedBy: `clubs.${col}`, lastText: '' };
          }
        } else {
          lastText = text;
        }
      }

      return { clubId: null, matchedBy: null, lastText };
    }

    async function resolveClubIdFromRankingWithNames(name) {
      // fallback via view que tem club_name
      const p = new URLSearchParams();
      p.set('select', 'club_id,club_name');
      p.set('club_name', `eq.${name}`);
      p.set('limit', '1');

      const target = `${base}/daily_ranking_with_names?${p.toString()}`;
      const res = await fetch(target, { headers });
      const text = await res.text();

      if (!res.ok) return { clubId: null, matchedBy: null, lastText: text };

      let rows = [];
      try {
        rows = JSON.parse(text);
      } catch {
        rows = [];
      }

      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.club_id) {
        return {
          clubId: rows[0].club_id,
          matchedBy: 'daily_ranking_with_names.club_name',
          lastText: '',
        };
      }

      return { clubId: null, matchedBy: null, lastText: '' };
    }

    let resolved = await resolveClubIdFromClubs(club);
    if (!resolved.clubId) {
      const fb = await resolveClubIdFromRankingWithNames(club);
      if (fb.clubId) resolved = fb;
    }

    if (!resolved.clubId) {
      return new Response(
        JSON.stringify({
          error: 'Clube não encontrado (clubs.name_official/name e fallback na daily_ranking_with_names.club_name falharam)',
          club,
          details: resolved.lastText || '',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const clubId = resolved.clubId;

    // -----------------------------
    // 2) Descobrir colunas reais via probe
    // -----------------------------
    const resources = ['daily_ranking_with_names', 'daily_ranking', 'daily_rankings'];

    const dateCandidates = ['bucket_date', 'day', 'date', 'ranking_date', 'created_at', 'updated_at'];
    const scoreCandidates = ['score', 'iap'];

    async function probeResource(resource) {
      // Probe: select=* limit=1 com filtro por club_id
      const p = new URLSearchParams();
      p.set('select', '*');
      p.set('club_id', `eq.${clubId}`);
      p.set('limit', '1');

      const target = `${base}/${resource}?${p.toString()}`;
      const res = await fetch(target, { headers });
      const text = await res.text();

      if (!res.ok) return { ok: false, text, sample: null, keys: [] };

      let rows = [];
      try {
        rows = JSON.parse(text);
      } catch {
        rows = [];
      }

      const sample = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      const keys = sample && typeof sample === 'object' ? Object.keys(sample) : [];
      return { ok: true, text, sample, keys };
    }

    function pickFirstExisting(candidates, keys) {
      for (const c of candidates) if (keys.includes(c)) return c;
      return null;
    }

    let chosen = null;
    let lastProbeError = '';

    for (const resource of resources) {
      const probed = await probeResource(resource);
      if (!probed.ok) {
        lastProbeError = probed.text;
        continue;
      }
      if (!probed.sample) {
        // recurso existe, mas não tem linha para esse club_id
        continue;
      }

      const dateCol = pickFirstExisting(dateCandidates, probed.keys);
      const scoreCol = pickFirstExisting(scoreCandidates, probed.keys);

      if (dateCol && scoreCol) {
        chosen = { resource, dateCol, scoreCol, keys: probed.keys };
        break;
      }

      // Se achou score mas não achou date, ainda assim guardamos para debug
      lastProbeError = JSON.stringify({
        resource,
        missing: { dateCol: !dateCol, scoreCol: !scoreCol },
        keys: probed.keys,
      });
    }

    if (!chosen) {
      return new Response(
        JSON.stringify({
          error: 'Não foi possível montar a série temporal (não encontrei colunas de data/score compatíveis em nenhum recurso)',
          club,
          club_id: clubId,
          details: lastProbeError,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // -----------------------------
    // 3) Buscar série com colunas certas
    // -----------------------------
    const p = new URLSearchParams();
    p.set('select', `${chosen.dateCol},${chosen.scoreCol},club_id`);
    p.set('club_id', `eq.${clubId}`);
    p.set('order', `${chosen.dateCol}.asc`);
    p.set('limit', String(limitDays));

    const target = `${base}/${chosen.resource}?${p.toString()}`;
    const res = await fetch(target, { headers });
    const text = await res.text();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: 'Falha ao buscar série após identificar colunas',
          club,
          club_id: clubId,
          resource: chosen.resource,
          dateCol: chosen.dateCol,
          scoreCol: chosen.scoreCol,
          details: text,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let rows = [];
    try {
      rows = JSON.parse(text);
    } catch {
      rows = [];
    }

    const series = (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        date: r?.[chosen.dateCol],
        value: r?.[chosen.scoreCol],
        club_id: r?.club_id ?? clubId,
        club_name: club,
      }))
      .filter((r) => r.date != null && r.value != null);

    return new Response(JSON.stringify(series), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Club-Id': clubId,
        'X-Club-Matched-By': resolved.matchedBy || '',
        'X-Source-Resource': chosen.resource,
        'X-Date-Col': chosen.dateCol,
        'X-Score-Col': chosen.scoreCol,
      },
    });
  } catch (err) {
    console.error('Erro na rota /api/club_series:', err);
    return new Response(JSON.stringify({ error: 'Erro interno na API' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
