// pulso-publico/app/page.tsx

import Link from 'next/link';

export default function Home() {
  return (
    <main style={{
      maxWidth: "700px",
      margin: "0 auto",
      padding: "2rem",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{ color: "#0377fc" }}>Pulso Esportivo</h1>
      <h2 style={{ fontWeight: 400, color: "#333", marginBottom: "2rem" }}>Monitorando a Popularidade dos Clubes em Tempo Real</h2>

      <p style={{ marginBottom: "1.5rem" }}>
        O Pulso Esportivo é uma plataforma pública que analisa dados online para medir a popularidade de clubes de futebol brasileiros.
        Utilizando fontes como YouTube, Reddit e Google Trends, geramos diariamente um ranking atualizado dos clubes mais mencionados e comentados na web.
      </p>

      <ul style={{ marginBottom: "1.5rem", paddingLeft: "1.2rem" }}>
        <li>Ranking diário dos clubes mais populares</li>
        <li>Análise do volume e sentimento das interações</li>
        <li>Monitoramento de várias plataformas públicas</li>
        <li>Visualização interativa de dados</li>
      </ul>

      <div style={{ marginBottom: "1.5rem" }}>
        <strong>Fontes monitoradas:</strong> YouTube, Reddit, Google Trends
      </div>

      <Link href="/ranking" style={{ padding: "0.6rem 1.2rem", background: "#0377fc", color: "#fff", borderRadius: "5px", textDecoration: "none", fontWeight: "bold" }}>
        Ver Ranking Diário
      </Link>
    </main>
  );
}
