import React from "react";
import { useDailyRanking } from "../hooks/useDailyRanking";
import { RankingCard } from "../components/RankingCard";
import Head from "next/head";

export default function Home() {
  const { data, isLoading, isError } = useDailyRanking({ limit: 10 });

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Pulso Esportivo — Dashboard</title>
      </Head>
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto p-4">
          <h1 className="text-2xl font-bold">Pulso Esportivo</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {isLoading ? (
              <div className="p-6 bg-white rounded shadow">Carregando ranking...</div>
            ) : isError ? (
              <div className="p-6 bg-white rounded shadow text-red-600">Erro ao carregar ranking</div>
            ) : (
              <RankingCard items={data?.data ?? []} onClickClub={(id) => console.log("open club", id)} />
            )}
          </div>

          <div className="bg-white rounded shadow p-4">
            <h3 className="text-lg font-semibold mb-2">Visão rápida</h3>
            <p className="text-sm text-gray-600">Outros cards e gráficos serão implementados aqui.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
