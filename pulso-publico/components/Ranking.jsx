//pulso-publico/components/Ranking.jsx

'use client';

import { useEffect, useState } from 'react';

function getClubName(item) {
  // tenta várias chaves/estruturas comuns que o backend pode retornar
  if (!item) return '—';
  if (item.club_name) return item.club_name;
  if (item.name) return item.name;
  if (item.club) {
    if (typeof item.club === 'string') return item.club;
    if (typeof item.club === 'object') return item.club.name ?? item.club.club_name ?? JSON.stringify(item.club);
  }
  // tenta propriedades aninhadas comuns
  if (item.club?.name) return item.club.name;
  if (item.club?.club_name) return item.club.club_name;
  // fallback: mostra prefixo do id para identificar
  if (item.club_id) return item.club_id.slice(0, 8) + '…';
  return '—';
}

export default function Ranking() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/daily_ranking');
      if (!res.ok) throw new Error('Erro ao buscar dados');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div>Carregando ranking…</div>;
  if (error)
    return (
      <div>
        Erro ao buscar ranking: {error.message}
        <button onClick={fetchData}>Tentar novamente</button>
      </div>
    );
  if (!data || !Array.isArray(data) || data.length === 0) return <div>Nenhum dado disponível</div>;

  return (
    <div>
      <h2>Ranking Diário</h2>
      <table>
        <thead>
          <tr>
            <th>Posição</th>
            <th>Clube</th>
            <th>IAP</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={item.club_id ?? idx}>
              <td>{idx + 1}</td>
              <td>{getClubName(item)}</td>
              <td>{item.iap ?? item.score ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
