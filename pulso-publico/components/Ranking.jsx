// pulso-publico/components/Ranking.jsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function getClubName(item) {
  if (!item) return '—';
  // prioridade: club.name -> club_name -> name -> club -> club_id truncated
  if (item.club && typeof item.club === 'object' && (item.club.name || item.club.club_name)) {
    return item.club.name ?? item.club.club_name;
  }
  if (item.club_name) return item.club_name;
  if (item.name) return item.name;
  if (item.club) {
    if (typeof item.club === 'string') return item.club;
    try {
      return JSON.stringify(item.club);
    } catch (e) {
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

export default function Ranking() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD

  const fetchData = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const qs = date ? `?date=${encodeURIComponent(date)}` : '';
      const res = await fetch(`/api/daily_ranking${qs}`);
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
    fetchData(''); // carrega "último"/padrão
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (!Array.isArray(data)) return [];
    // Mantém somente linhas com valor numérico (score ou iap)
    return data
      .map((item) => {
        const raw = item?.score ?? item?.iap;
        const value = toNumber(raw);
        return {
          key: item?.club_id ?? `${getClubName(item)}-${Math.random()}`,
          club: getClubName(item),
          value,
        };
      })
      .filter((r) => r.value !== null);
  }, [data]);

  const chartData = useMemo(() => {
    return {
      labels: rows.map((r) => r.club),
      datasets: [
        {
          label: 'IAP',
          data: rows.map((r) => r.value),
        },
      ],
    };
  }, [rows]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        y: { beginAtZero: true },
      },
    };
  }, []);

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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Ranking Diário</h2>

      {/* FILTRO DE DATA */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>Data:</label>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        <button
          onClick={() => fetchData(selectedDate)}
          disabled={!selectedDate || loading}
          title={!selectedDate ? 'Selecione uma data' : 'Aplicar filtro'}
        >
          Aplicar
        </button>

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
      </div>

      {/* GRÁFICO */}
      <div style={{ height: 360, width: '100%' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* TABELA */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Posição</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Clube</th>
            <th style={{ textAlign: 'left', padding: 8 }}>IAP</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={item.club_id ?? idx}>
              <td style={{ padding: 8 }}>{idx + 1}</td>
              <td style={{ padding: 8 }}>{getClubName(item)}</td>
              <td style={{ padding: 8 }}>{item.score ?? item.iap ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* NOTA */}
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Observação: nenhuma linha tinha valor numérico em <code>score</code> ou <code>iap</code>.
        </div>
      ) : null}
    </div>
  );
}
