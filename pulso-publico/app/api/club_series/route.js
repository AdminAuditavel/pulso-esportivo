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
    const clubName = (url.searchParams.get('club') || '').trim();
    const limitDays = Number(url.searchParams.get('limit_days') || '90');

    if (!clubName) {
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

    // 1) Resolver clubName -> club_id
    // Tentamos name_short primeiro (porque seu ranking mostra "Vasco", "SPFC", "Remo", etc.)
    async function resolveClubId(name) {
      const attempts = [
        { col: 'name_short', value: name },
        { col: 'name_official', value: name },
      ];

      // também tenta versões "ilike" para caso de variação de caixa/acentos (quando funcionar)
      const attemptsIlike = [
        { col: 'name_short', value: `ilike.${name}` },
        { col: 'name_official', value: `ilike.${name}` },
      ];

      // eq
      for (const a of attempts) {
        const p = new URLSearchParams();
        p.set('select', 'id,name_official,name_short');
        p.set(a.col, `eq.${a.value}`);
        p.set('limit', '1');

        const res = await fetch(`${base}/clubs?${p.toString()}`, { headers });
        const text = await res.text();
        if (!res.ok) continue;

        let rows = [];
        try {
          rows = JSON.parse(text);
        } catch {
          rows = [];
        }
        if (Array.isArray(rows) && rows[0]?.id) {
          return { id: rows[0].id, matchedBy: `clubs.${a.col}=eq`, club: rows[0] };
        }
      }

      // ilike (se PostgREST aceitar; se não aceitar, simplesmente não vai retornar ok/linha)
      for (const a of attemptsIlike) {
        const p = new URLSearchParams();
        p.set('select', 'id,name_official,name_short');
        p.set(a.col, a.value);
        p.set('limit', '1');

        const res = await fetch(`${base}/clubs?${p.toString()}`, { headers });
        const text = await res.text();
        if (!res.ok) continue;

        let rows = [];
        try {
          rows = JSON.parse(text);
        } catch {
          rows = [];
        }
        if (Array.isArray(rows) && rows[0]?.id) {
          return { id: rows[0].id, matchedBy: `clubs.${a.col}=ilike`, club: rows[0] };
        }
      }

      return null;
    }

    const resolved = await resolveClubId(clubName);

    if (!resolved?.id) {
      // fallback: tentar via view com nomes (caso o nome clicado seja diferente do cadastro em clubs)
      const p = new URLSearchParams();
      p.set('select', 'club_id,club_name');
      p.set('club_name', `eq.${clubName}`);
      p.set('limit', '1');

      const res = await fetch(`${base}/daily_ranking_with_names?${p.toString()}`, { headers });
      const text = await res.text();

      if (res.ok) {
        let rows = [];
        try {
          rows = JSON.parse(text);
        } catch {
          rows = [];
        }
        if (Array.isArray(rows) && rows[0]?.club_id) {
          // segue com esse club_id mesmo sem bater em clubs
          return await fetchSeriesAndReturn({
            clubId: rows[0].club_id,
            clubName,
            matchedBy: 'daily_ranking_with_names.club_name',
            base,
            headers,
            limitDays,
          });
        }
      }

      return new Response(
        JSON.stringify({
          error: 'Clube não encontrado em clubs (name_short/name_official) e nem na daily_ranking_with_names',
          club: clubName,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return await fetchSeriesAndReturn({
      clubId: resolved.id,
      clubName,
      matchedBy: resolved.matchedBy,
      base,
      headers,
      limitDays,
      clubOfficial: resolved.club?.name_official,
      clubShort: resolved.club?.name_short,
    });
  } catch (err) {
    console.error('Erro na rota /api/club_series:', err);
    return new Response(JSON.stringify({ error: 'Erro interno na API' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function fetchSeriesAndReturn({ clubId, clubName, matchedBy, base, headers, limitDays, clubOfficial, clubShort }) {
  const p = new URLSearchParams();
  p.set('select', 'aggregation_date,score,volume_total,sentiment_score,rank_position,club_id');
  p.set('club_id', `eq.${clubId}`);
  p.set('order', 'aggregation_date.asc');
  p.set('limit', String(limitDays));

  const res = await fetch(`${base}/daily_ranking?${p.toString()}`, { headers });
  const text = await res.text();

  if (!res.ok) {
    return new Response(
      JSON.stringify({
        error: 'Falha ao buscar série em daily_ranking',
        club: clubName,
        club_id: clubId,
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

  const series = (Array.isArray(rows) ? rows : []).map((r) => ({
    date: r.aggregation_date, // coluna correta
    value: r.score,           // coluna correta
    volume_total: r.volume_total,
    sentiment_score: r.sentiment_score,
    rank_position: r.rank_position,
    club_id: r.club_id ?? clubId,
    club_name: clubName,
    club_name_official: clubOfficial || null,
    club_name_short: clubShort || null,
  }));

  return new Response(JSON.stringify(series), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Club-Id': clubId,
      'X-Club-Matched-By': matchedBy,
    },
  });
}
