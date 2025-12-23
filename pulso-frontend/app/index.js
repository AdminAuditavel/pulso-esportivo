//pulso-frontend/app/index.js
import { useEffect, useState } from 'react';
import { Chart } from 'chart.js/auto';

export default function Home() {
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const fetchRanking = async () => {
      const response = await fetch('/api/daily_ranking');
      const data = await response.json();
      setRanking(data);
      renderChart(data);
    };
    fetchRanking();
  }, []);

  // Função para renderizar o gráfico
  const renderChart = (data) => {
    const sentimentData = data.map(item => item.points);
    const sentimentLabels = data.map(item => item.club);

    const ctx = document.getElementById('sentiment-chart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sentimentLabels,
        datasets: [{
          label: 'Pontos de Sentimento',
          data: sentimentData,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
    });
  };

  return (
    <div>
      <h1>Ranking Diário dos Clubes</h1>
      <table>
        <thead>
          <tr>
            <th>Clube</th>
            <th>Pontos</th>
            <th>Sentimento</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((item, index) => (
            <tr key={index}>
              <td>{item.club}</td>
              <td>{item.points}</td>
              <td>{item.sentiment}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <h2>Gráfico de Sentimentos</h2>
      <canvas id="sentiment-chart"></canvas>
    </div>
  );
}
