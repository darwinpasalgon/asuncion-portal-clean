"use client";

import { ArrowLeft, FileSpreadsheet, ShieldCheck } from "lucide-react";
import styles from "./sf10.module.css";

export default function Sf10Page() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal">
            <ArrowLeft size={16} />
            Back to portal
          </a>
        </nav>
        <header className={styles.header}>
          <div>
            <span>REGISTRAR</span>
            <h1>SF10 Records</h1>
            <p>Restricted learner permanent-record workspace.</p>
          </div>
          <div className={styles.badge}>
            <ShieldCheck size={18} />
            Restricted record access
          </div>
        </header>
        <section className={styles.workspace}>
          <div className={styles.placeholder}>
            <FileSpreadsheet size={40} />
            <strong>SF10 workspace</strong>
            <span>Registrar access is connected.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
