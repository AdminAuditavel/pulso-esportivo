//pulso-frontend/app/page.tsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Registrar os componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface RankingData {
  club_id: string;
  score: number;
}

export default function Home() {
  const [rankingData, setRankingData] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Função para buscar dados do ranking diário
    const fetchRankingData = async () => {
      try {
        const response = await axios.get('https://jubilant-halibut-pj4w5gr4q7g6f647g-8000.app.github.dev/daily_ranking');
        setRankingData(response.data.data);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao buscar dados do ranking:', error);
      }
    };

    fetchRankingData();
  }, []);

  // Preparar os dados para o gráfico
  const chartData = {
    labels: rankingData.map(item => item.club_id), // Usando o ID do clube como rótulo (pode ser ajustado)
    datasets: [
      {
        label: 'Ranking Diário',
        data: rankingData.map(item => item.score), // Usando a pontuação do ranking
        fill: false,
        borderColor: 'rgba(75, 192, 192, 1)',
        tension: 0.1,
      },
    ],
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-semibold text-center text-black dark:text-zinc-50">
          Pulso Esportivo - Ranking Diário
        </h1>

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-6">
              <h2 className="text-xl text-black dark:text-zinc-50">Ranking dos Clubes</h2>
              <Line data={chartData} />
            </div>
            <ul className="mt-6 text-black dark:text-zinc-50">
              {rankingData.map(item => (
                <li key={item.club_id}>
                  {item.club_id}: {item.score} pontos
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
