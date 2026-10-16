"use client";

import { FileText, LoaderCircle } from "lucide-react";
import styles from "./GeneratingProgress.module.css";

type GeneratingProgressProps = {
  form: "SF2" | "SF9" | "SF10";
  message: string;
  detail?: string;
};

export function GeneratingProgress({
  form,
  message,
  detail = "Preparing the latest saved school records.",
}: GeneratingProgressProps) {
  return (
    <section
      className={styles.panel}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`Generating ${form}`}
    >
      <div className={styles.iconBadge} aria-hidden="true">
        <FileText size={20} strokeWidth={1.8} />
      </div>
      <div className={styles.content}>
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>{form} · SCHOOL FORM</span>
            <strong>{message}</strong>
          </div>
          <span className={styles.working}>
            <LoaderCircle size={14} aria-hidden="true" />
            Processing
          </span>
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-label={`${form} generation in progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={message}
        >
          <div className={styles.movingBar} />
        </div>
        <p className={styles.detail}>{detail}</p>
      </div>
    </section>
  );
}
