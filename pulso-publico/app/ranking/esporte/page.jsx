//pulso-publico/app/ranking/esporte/page.jsx

'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import fetcher from '../../../components/hooks/useFetcher';
import RankCard from '../../../components/RankCard';
import Skeleton from '../../../components/Skeleton';
import styles from './page.module.css';

/**
 * Página: /ranking/esporte
 * - Busca: /api/daily_ranking?theme=esporte
 * - Toggle Top5/Top10
 * - Usa RankCard para exibir cada clube
 *
 * Se o backend usar outro param, ajuste a URL `rankingKey`.
 */

export default function EsporteRankingPage() {
  const [modeTop, setModeTop] = useState(5); // 5 ou 10
  const [selectedDate, setSelectedDate] = useState('');

  const rankingKey = selectedDate ? `/api/daily_ranking?theme=esporte&date=${encodeURIComponent(selectedDate)}` : '/api/daily_ranking?theme=esporte';
  const { data: rankingJson, error, isValidating, mutate } = useSWR(rankingKey, fetcher, { revalidateOnFocus: false });

  const rankingArr = Array.isArray(rankingJson) ? rankingJson : Array.isArray(rankingJson?.data) ? rankingJson.data : [];
  const resolvedDate = rankingJson && !Array.isArray(rankingJson) && rankingJson?.resolved_date ? String(rankingJson.resolved_date).slice(0, 10) : '';
  const effectiveDate = resolvedDate || selectedDate || (rankingArr?.[0] ? (rankingArr[0]?.aggregation_date ?? rankingArr[0]?.metric_date ?? rankingArr[0]?.date)?.slice(0,10) : '');

  // prev-day map simple (fetch once using SWR)
  const prevKey = effectiveDate ? `/api/daily_ranking?theme=esporte&date=${encodeURIComponent(new Date(new Date(effectiveDate).getTime() - 24*60*60*1000).toISOString().slice(0,10))}` : null;
  const { data: prevJson } = useSWR(prevKey, fetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  const prevArr = Array.isArray(prevJson) ? prevJson : Array.isArray(prevJson?.data) ? prevJson.data : [];
  const prevRankMap = useMemo(() => {
    const m = new Map();
    for (let i = 0; i < prevArr.length; i += 1) {
      const it = prevArr[i];
      const name = (it?.club && it.club.name) || it?.club_name || it?.name || it?.club || (`${it?.club_id ?? i}`);
      const rp = Number(it?.rank_position) || i + 1;
      m.set(name, rp);
    }
    return m;
  }, [prevArr]);

  const itemsToShow = useMemo(() => {
    if (!Array.isArray(rankingArr)) return [];
    return rankingArr.slice(0, modeTop);
  }, [rankingArr, modeTop]);

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Ranking — Esporte</h1>
        <div className={styles.subtitle}>Top {modeTop} — janela padrão 24h · fontes públicas</div>
      </header>

      <div className={styles.controls}>
        <div className={styles.leftControls}>
          <label className={styles.label}>Data:</label>
          <input className={styles.inputDate} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          <button className={styles.btn} onClick={() => { setSelectedDate(''); mutate(); }} disabled={isValidating}>Hoje/Último</button>
        </div>

        <div className={styles.rightControls}>
          <button className={modeTop === 5 ? styles.activeBtn : styles.btn} onClick={() => setModeTop(5)}>Top 5</button>
          <button className={modeTop === 10 ? styles.activeBtn : styles.btn} onClick={() => setModeTop(10)}>Top 10</button>
        </div>
      </div>

      <section className={styles.grid}>
        {isValidating ? (
          // skeletons
          Array.from({ length: modeTop }).map((_, i) => (
            <div key={i} className={styles.cardWrapper}>
              <Skeleton height={14} width={80} style={{ marginBottom: 10 }} />
              <Skeleton height={80} />
            </div>
          ))
        ) : error ? (
          <div className={styles.errorBox}>
            Erro ao carregar ranking: {String(error?.message ?? error)}
            <div style={{ marginTop: 8 }}>
              <button className={styles.btn} onClick={() => mutate()}>Tentar novamente</button>
            </div>
          </div>
        ) : itemsToShow.length === 0 ? (
          <div className={styles.empty}>Nenhum dado disponível</div>
        ) : (
          itemsToShow.map((item, idx) => (
            <div key={item?.club_id ?? `${idx}-${(item?.club_name ?? item?.name ?? item?.club)}`} className={styles.cardWrapper}>
              <RankCard rank={idx + 1} item={item} prevRankMap={prevRankMap} />
            </div>
          ))
        )}
      </section>

      <footer className={styles.footer}>
        <div>Dados públicos e agregados — Comentaram</div>
        <div className={styles.footerRight}>Última atualização: {effectiveDate ? effectiveDate : '—'}</div>
      </footer>
    </main>
  );
}
