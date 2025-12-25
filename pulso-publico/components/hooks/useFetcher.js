//pulso-publico/components/hooks/useFetcher.js
// utilitário fetcher para useSWR
export default async function fetcher(input, ...args) {
  // input: URL string (já com querystring se necessário)
  const res = await fetch(input, ...args);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Fetch error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
    err.status = res.status;
    throw err;
  }
  // tenta JSON, cai para texto vazio se falhar
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}
