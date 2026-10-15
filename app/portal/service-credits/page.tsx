"use client";

import { ArrowLeft, ClipboardCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./service-credits.module.css";

type Transaction = {
  id: string;
  ledger_sequence?: number;
  credit_type: "service_credit" | "wellness_leave";
  posting_date: string;
  transaction_kind: string;
  previous_balance: number | null;
  service_credits_earned: number;
  particulars: string;
  absence_days: number;
  service_credits_used: number;
  balance_after: number;
  remarks: string | null;
  source: string;
  created_at: string;
};

type Summary = {
  service_credit_balance: number | null;
  wellness_leave_balance: number | null;
  wellness_allowance: number;
  wellness_used: number;
  wellness_year: number;
  total_service_credits_earned: number;
  total_service_credits_used: number;
  transaction_count: number;
  wellness_transaction_count: number;
};

type Personnel = {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  role: string;
};

function formatDays(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not Recorded";
  return Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function days(value: number | null | undefined) {
  const formatted = formatDays(value);
  return formatted === "Not Recorded" ? formatted : `${formatted} days`;
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default function ServiceCreditsPage() {
  const [personnel, setPersonnel] = useState<Personnel | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"service_credit" | "wellness_leave">("service_credit");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/service-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "self" }),
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Unable to load Service Credits.");
        if (!active) return;
        setPersonnel(result.personnel ?? null);
        setSummary(result.summary ?? null);
        setTransactions((result.transactions ?? []) as Transaction[]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load Service Credits.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () => transactions.filter((item) => item.credit_type === tab),
    [transactions, tab]
  );

  const wellnessRunningBalances = useMemo(() => {
    const sorted = transactions.filter((item) => item.credit_type === "wellness_leave")
      .slice().sort((a, b) =>
        a.posting_date.localeCompare(b.posting_date) ||
        Number(a.ledger_sequence ?? 0) - Number(b.ledger_sequence ?? 0)
      );
    const usedByYear = new Map<string, number>();
    const balances = new Map<string, number>();
    for (const item of sorted) {
      const year = item.posting_date.slice(0, 4);
      const used = (usedByYear.get(year) ?? 0) + Number(item.service_credits_used ?? 0);
      usedByYear.set(year, used);
      balances.set(item.id, Math.max(0, 5 - used));
    }
    return balances;
  }, [transactions]);

  const balance =
    tab === "service_credit"
      ? summary?.service_credit_balance ?? null
      : summary?.wellness_leave_balance ?? null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a className={styles.back} href="/portal">
          <ArrowLeft size={16} />
          Back to Portal
        </a>

        <header className={styles.header}>
          <div className={styles.headerIcon}><ClipboardCheck size={26} /></div>
          <div>
            <span>PERSONNEL BENEFITS</span>
            <h1>My Service Credits</h1>
            <p>View your current balance and complete posting history.</p>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <section className={styles.empty}>Loading Service Credits...</section>
        ) : (
          <>
            <section className={styles.balanceCard}>
              <div>
                <span>{tab === "service_credit" ? "CURRENT SERVICE CREDITS BALANCE" : "CURRENT WELLNESS LEAVE BALANCE"}</span>
                <strong>{days(balance)}</strong>
                <small>
                  {personnel?.full_name || "Personnel"}
                  {personnel?.position ? ` · ${personnel.position}` : ""}
                </small>
                {tab === "wellness_leave" && <small>{summary?.wellness_year}: {formatDays(summary?.wellness_used ?? 0)} of {formatDays(summary?.wellness_allowance ?? 0)} days used · Renews January 1 · Expires December 31</small>}
              </div>
              <UserRound size={34} />
            </section>

            <div className={styles.tabs}>
              <button className={tab === "service_credit" ? styles.active : ""} onClick={() => setTab("service_credit")}>
                Service Credits
                <span>{summary?.transaction_count ?? 0}</span>
              </button>
              <button className={tab === "wellness_leave" ? styles.active : ""} onClick={() => setTab("wellness_leave")}>
                Wellness Leave
                <span>{summary?.wellness_transaction_count ?? 0}</span>
              </button>
            </div>

            {tab === "service_credit" && (
              <section className={styles.metrics}>
                <div><span>Total Earned</span><strong>+{formatDays(summary?.total_service_credits_earned ?? 0)}</strong></div>
                <div><span>Total Used</span><strong>-{formatDays(summary?.total_service_credits_used ?? 0)}</strong></div>
                <div><span>Transactions</span><strong>{summary?.transaction_count ?? 0}</strong></div>
              </section>
            )}

            {tab === "wellness_leave" && <section className={styles.metrics}>
              <div><span>Annual Allowance</span><strong>{formatDays(summary?.wellness_allowance ?? 0)} days</strong></div>
              <div><span>Used This Year</span><strong>{formatDays(summary?.wellness_used ?? 0)} days</strong></div>
              <div><span>Renewal</span><strong>January 1</strong></div>
            </section>}

            <section className={styles.history}>
              <div className={styles.sectionHead}>
                <div>
                  <h2>Transaction History</h2>
                  <p>Every posting remains visible as part of your personnel record.</p>
                </div>
              </div>

              {visible.length === 0 ? (
                <div className={styles.empty}>No transactions recorded yet.</div>
              ) : (
                <div className={styles.transactionList}>
                  {visible.map((item) => (
                    <article key={item.id}>
                      <div className={styles.transactionDate}>
                        <strong>{formatDate(item.posting_date)}</strong>
                        <span>{item.source === "excel_import" ? "Imported Record" : "HR Posting"}</span>
                      </div>
                      <div className={styles.transactionCopy}>
                        <strong>{item.particulars}</strong>
                        <span>{item.remarks || (item.absence_days > 0 ? `${item.absence_days.toFixed(2)} absence day(s)` : "No remarks")}</span>
                      </div>
                      <div className={styles.amounts}>
                        {tab === "service_credit" && item.service_credits_earned > 0 && (
                          <span className={styles.credit}>+{formatDays(item.service_credits_earned)}</span>
                        )}
                        {tab === "wellness_leave" && item.service_credits_earned > 0 && <span>Legacy allocation</span>}
                        {item.service_credits_used > 0 && (
                          <span className={styles.debit}>-{formatDays(item.service_credits_used)}</span>
                        )}
                        {item.transaction_kind === "opening_balance" && (
                          <span className={styles.opening}>Opening</span>
                        )}
                      </div>
                      <div className={styles.runningBalance}>
                        <span>{item.particulars === "Balance Forwarded to Division Office" ? "Balance Forwarded" : tab === "wellness_leave" ? `${item.posting_date.slice(0,4)} Remaining` : "Balance"}</span>
                        <strong>{item.particulars === "Balance Forwarded to Division Office" ? formatDays(item.previous_balance) + " days" : formatDays(tab === "wellness_leave" ? wellnessRunningBalances.get(item.id) ?? 5 : item.balance_after)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
