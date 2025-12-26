import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

function Header() {
  return (
    <header className={styles.header} role="banner">
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brandLink}>
          <Image
            src="/Logo_Comentaram_337D26.png"
            alt="Comentaram — logotipo"
            width={160}
            height={40}
            className={styles.logoImage}
            priority
          />
        </Link>

        <nav aria-label="Main navigation" className={styles.nav}>
          <ul className={styles.navList}>
            <li><Link href="/" className={styles.navLink}>Home</Link></li>
            <li><Link href="/ranking" className={styles.navLink}>Rankings</Link></li>
            <li><Link href="/ranking/esporte" className={styles.navLink}>Esporte</Link></li>
            <li><Link href="/ranking/politica" className={styles.navLink}>Política</Link></li>
            <li><Link href="/metodologia" className={styles.navLink}>Metodologia</Link></li>
            <li><Link href="/fontes" className={styles.navLink}>Fontes</Link></li>
            <li><Link href="/sobre" className={styles.navLink}>Sobre</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <main className={styles.container}>
      <Header />

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroContent}>
          <h1 id="hero-title" className={styles.title}>Comentaram</h1>
          <p className={styles.subtitle}>
            Painel público que transforma conversas abertas em indicadores — esportes, política, cultura, tecnologia e mais.
          </p>

          <p className={styles.lead}>
            Usamos apenas dados públicos para gerar rankings, gráficos e sinais de atenção pública — sempre em formato agregado e sem expor comentários individuais ou dados pessoais.
          </p>

          <div className={styles.ctaRow}>
            <Link href="/ranking" className={styles.primaryButton}>Ver Rankings</Link>
            <Link href="/metodologia" className={styles.secondaryButton}>Metodologia</Link>
            <div className={styles.updateNote}>Última atualização: <strong>agora</strong></div>
          </div>

          <div className={styles.sourcesRow}>
            <span className={styles.sourceBadge}>YouTube</span>
            <span className={styles.sourceBadge}>Reddit</span>
            <span className={styles.sourceBadge}>Google Trends</span>
            <span className={styles.sourceBadge}>Outras fontes</span>
            <div className={styles.windowNote}>Janela padrão: 24h · Dados agregados · Multitemas</div>
          </div>
        </div>

        <aside className={styles.heroCard} aria-label="Resumo rápido">
          <div className={styles.smallLabel}>Hoje em foco</div>
          <div className={styles.bigLabel}>Esporte · Top 5</div>
          <div className={styles.cardText}>
            Ex.: Flamengo, Palmeiras, Corinthians...<br />
            Clique em "Ver Rankings" ou em qualquer tema abaixo para ver detalhes por plataforma e sentimento.
          </div>
        </aside>
      </section>

      <section className={styles.themesSection}>
        <h3 className={styles.sectionTitle}>Temas</h3>
        <div className={styles.topicsGrid}>
          <TopicCard title="Esporte" href="/ranking/esporte" description="Rankings diários de clubes e atletas — volume e sentimento." emoji="⚽" />
          <TopicCard title="Política" href="/ranking/politica" description="Tópicos e atores em evidência na esfera política." emoji="🏛️" />
          <TopicCard title="Cultura" href="/ranking/cultura" description="Assuntos culturais, lançamentos e discussões públicas." emoji="🎭" />
          <TopicCard title="Tecnologia" href="/ranking/tecnologia" description="Tendências e debates em tecnologia e inovação." emoji="💻" />
        </div>

        <div className={styles.features}>
          <h4>O que oferecemos</h4>
          <ul>
            <li>Rankings diários por tema (janela 24h)</li>
            <li>Quebra por plataforma (YouTube / Reddit / Trends)</li>
            <li>Sinais de sentimento e indicadores de possível manipulação</li>
            <li>Página pública com metodologia e fontes</li>
          </ul>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>© {new Date().getFullYear()} Comentaram — Dados públicos e agregados</div>
        <div className={styles.footerLinks}>
          <Link href="/metodologia" className={styles.footerLink}>Metodologia</Link>
          <Link href="/fontes" className={styles.footerLink}>Fontes</Link>
          <Link href="/sobre" className={styles.footerLink}>Sobre</Link>
        </div>
      </footer>
    </main>
  );
}

function TopicCard({ title, href, description, emoji }: { title: string; href: string; description: string; emoji?: string }) {
  return (
    <Link href={href} className={styles.topicCard}>
      <div className={styles.topicInner}>
        <div className={styles.topicEmoji}>{emoji}</div>
        <div>
          <div className={styles.topicTitle}>{title}</div>
          <div className={styles.topicDesc}>{description}</div>
        </div>
      </div>
    </Link>
  );
}
