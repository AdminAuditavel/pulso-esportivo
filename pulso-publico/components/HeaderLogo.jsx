'use client';

import Link from 'next/link';
import Image from 'next/image';
import React from 'react';
import styles from './controls.module.css';

/**
 * HeaderLogo - simples header com logo link para home e título opcional
 * Props:
 *  - title (string) optional
 */
export default function HeaderLogo({ title = 'Ranking Diário' }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Link href="/" className={styles.logoAnchor} aria-label="Comentaram — voltar para a página inicial">
        <Image src="/Logotipo_Comentaram.png" alt="Comentaram" width={160} height={40} priority />
      </Link>
      {title ? <h1 style={{ margin: 0, fontSize: 20, color: '#243a69' }}>{title}</h1> : null}
    </header>
  );
}
