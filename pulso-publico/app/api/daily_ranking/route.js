// app/api/daily_ranking/route.js
export async function GET(req) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const incoming = new URL(req.url).searchParams;
    const params = new URLSearchParams(incoming);

    if (!params.has('select')) params.set('select', '*');
    if (!params.has('order')) params.set('order', 'score.desc');
    if (!params.has('limit')) params.set('limit', '20');

    const base = supabaseUrl.replace(/\/$/, '') + '/rest/v1';

    // tenta nome de recurso singular primeiro, se falhar tenta plural
    const candidates = ['daily_ranking', 'daily_rankings'];
    let rankings = null;
    let lastErrorText = '';

    for (const resource of candidates) {
      const target = `${base}/${resource}?${params.toString()}`;
      const res = await fetch(target, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json',
        },
      });

      const text = await res.text();
      if (res.ok) {
        try {
          rankings = JSON.parse(text);
        } catch (e) {
          rankings = [];
        }
        break;
      } else {
        lastErrorText = text;
      }
    }

    if (!rankings) {
      return new Response(
        JSON.stringify({
          error: 'Erro ao buscar daily_ranking (tenteu singular/plural)',
          details: lastErrorText,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Se não há club_id, retorna direto
    const clubIds = Array.from(new Set(rankings.map((r) => r.club_id).filter(Boolean)));
    if (clubIds.length === 0) {
      return new Response(JSON.stringify(rankings), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Busca nomes dos clubes pela lista de ids — IMPORTANT: strings (UUIDs) devem estar entre aspas no filtro in.
    const clubsUrl = new URL(`${base}/clubs`);
    const clubParams = new URLSearchParams();
    clubParams.set('select', 'id,name');

    // coloca cada id entre aspas para o operador in do PostgREST, as aspas serão url-encoded automaticamente
    const quoted = clubIds.map((id) => `"${id}"`).join(',');
    clubParams.set('id', `in.(${quoted})`);
    clubsUrl.search = clubParams.toString();

    const clubsRes = await fetch(clubsUrl.toString(), {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: 'application/json',
      },
    });

    const clubsText = await clubsRes.text();
    let clubs = [];
    if (clubsRes.ok) {
      try {
        clubs = JSON.parse(clubsText);
      } catch (e) {
        clubs = [];
      }
    }

    const clubsMap = clubs.reduce((acc, c) => {
      if (c && c.id) acc[c.id] = c.name ?? null;
      return acc;
    }, {});

    // Anexa objeto club: { name } a cada item (se encontrado)
    const merged = rankings.map((item) => {
      const clubName = item.club_id ? clubsMap[item.club_id] ?? null : null;
      return { ...item, club: clubName ? { name: clubName } : item.club ?? null };
    });

    return new Response(JSON.stringify(merged), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Erro na rota /api/daily_ranking:', err);
    return new Response(JSON.stringify({ error: 'Erro interno na API' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
