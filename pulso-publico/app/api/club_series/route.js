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

    // 1) Resolver clubName -> club_id via tabela clubs (coluna "name")
    async function resolveClubIdFromClubsByName(name) {
      const p = new URLSearchParams();
      p.set('select', 'id,name');
      p.set('name', `eq.${name}`);

      const target = `${base}/clubs?${p.toString()}`;
      const res = await fetch(target, { headers });
      const text = await res.text();

      if (!res.ok) {
        return { clubId: null, matchedBy: null, lastText: text };
      }

      let rows = [];
      try {
        rows = JSON.parse(text);
      } catch {
        rows = [];
      }

      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id) {
        return { clubId: rows[0].id, matchedBy: 'clubs.name', lastText: '' };
      }

      return { clubId: null, matchedBy: null, lastText: '' };
    }

    // 2) Fallback: resolver clubName -> club_id via view daily_ranking_with_names (coluna club_name)
    async function resolveClubIdFromRankingView(name) {
      const p = new URLSearchParams();
      p.set('select', 'club_id,club_name');
      p.set('club_name', `eq.${name}`);
      p.set('limit', '1');

      const target = `${base}/daily_ranking_with_names?${p.toString()}`;
      const res = await fetch(target, { headers });
      const text = await res.text();

      if (!res.ok) {
        return { clubId: null, matchedBy: null, lastText: text };
      }

      let rows = [];
      try {
        rows = JSON.parse(text);
      } catch {
        rows = [];
      }

      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.club_id) {
        return { clubId: rows[0].club_id, matchedBy: 'daily_ranking_with_names.club_name', lastText: '' };
      }

      return { clubId: null, matchedBy: null, lastText: '' };
    }

    // tenta clubs.name
    let resolved = await resolveClubIdFromClubsByName(club);

    // se não achou, tenta view com nomes
    if (!resolved.clubId) {
      const fallback = await resolveClubIdFromRankingView(club);
      if (fallback.clubId) resolved = fallback;
    }

    if (!resolved.clubId) {
      return new Response(
        JSON.stringify({
          error: 'Clube não encontrado nem em clubs.name nem na view daily_ranking_with_names.club_name',
          club,
          details: resolved.lastText || '',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const clubId = resolved.clubId;

    // 3) Buscar série temporal filtrando por club_id
    //    (as colunas de data/score podem variar; mantemos tentativa heurística)
    const resources = ['daily_ranking', 'daily_rankings', 'daily_ranking_with_names'];
    const dateCols = ['bucket_date', 'day', 'date', 'ranking_date', 'metric_date'];
    const scoreCols = ['score', 'iap'];

    let series = null;
    let meta = { resource: '', dateCol: '', scoreCol: '' };
    let lastErrorText = '';

    for (const resource of resources) {
      for (const dateCol of dateCols) {
        for (const scoreCol of scoreCols) {
          const p = new URLSearchParams();
          p.set('select', `${dateCol},${scoreCol},club_id`);
          p.set('club_id', `eq.${clubId}`);
          p.set('order', `${dateCol}.asc`);
          p.set('limit', String(limitDays));

          const target = `${base}/${resource}?${p.toString()}`;
          const res = await fetch(target, { headers });
          const text = await res.text();

          if (res.ok) {
            let rows = [];
            try {
              rows = JSON.parse(text);
            } catch {
              rows = [];
            }

            series = (Array.isArray(rows) ? rows : [])
              .map((r) => ({
                date: r?.[dateCol],
                value: r?.[scoreCol],
                club_id: r?.club_id ?? clubId,
                club_name: club,
              }))
              .filter((r) => r.date != null && r.value != null);

            meta = { resource, dateCol, scoreCol };
            break;
          } else {
            lastErrorText = text;
          }
        }
        if (series) break;
      }
      if (series) break;
    }

    if (!series) {
      return new Response(
        JSON.stringify({
          error: 'Não foi possível montar a série temporal (view/colunas incompatíveis)',
          club,
          club_id: clubId,
          details: lastErrorText,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(series), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Club-Id': clubId,
        'X-Club-Matched-By': resolved.matchedBy || '',
        'X-Source-Resource': meta.resource,
        'X-Date-Col': meta.dateCol,
        'X-Score-Col': meta.scoreCol,
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
