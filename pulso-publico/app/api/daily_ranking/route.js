// app/api/daily_ranking/route.js

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

    // Se o frontend não passou select, fazemos um select que traz o clube relacionado:
    // Ajuste "clubs(name)" se a tabela/coluna do seu projeto for diferente.
    if (!params.has('select')) params.set('select', '*,club:clubs(name)');
    if (!params.has('order')) params.set('order', 'score.desc');
    if (!params.has('limit')) params.set('limit', '20');

    const target = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/daily_ranking?${params.toString()}`;

    const res = await fetch(target, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: 'application/json',
      },
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    const headersOut = { 'Content-Type': contentType.includes('application/json') ? 'application/json' : 'text/plain' };

    return new Response(text, { status: res.status, headers: headersOut });
  } catch (err) {
    console.error('Erro na rota /api/daily_ranking:', err);
    return new Response(JSON.stringify({ error: 'Erro interno na API' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
