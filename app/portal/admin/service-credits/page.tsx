"use client";

import { ArrowLeft, ClipboardCheck, MinusCircle, PlusCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./service-credits.module.css";

type Personnel = {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  role: string;
  service_credit_balance?: number | null;
};

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
  created_by_name?: string;
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

function today() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatDays(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not Recorded";
  return Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function moneyStyle(value: number | null | undefined) {
  const formatted = formatDays(value);
  return formatted === "Not Recorded" ? formatted : `${formatted} days`;
}

function surnameSortKey(fullName: string) {
  const name = fullName.trim().replace(/\s+/g, " ");
  if (name.includes(",")) return name.split(",")[0].toLocaleLowerCase("en-PH");
  const parts = name.replace(/\s+(JR\.?|SR\.?|II|III|IV)$/i, "").split(" ");
  const last = parts.pop() ?? "";
  if (parts.at(-1)?.toUpperCase() === "DE" || parts.at(-1)?.toUpperCase() === "DEL" || parts.at(-1)?.toUpperCase() === "DELA") return (parts.pop() + " " + last).toLocaleLowerCase("en-PH");
  if (parts.at(-1)?.toUpperCase() === "LA" && parts.at(-2)?.toUpperCase() === "DE") return (parts.slice(-2).join(" ") + " " + last).toLocaleLowerCase("en-PH");
  return last.toLocaleLowerCase("en-PH");
}

export default function AdminServiceCreditsPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<Personnel | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [postingDate, setPostingDate] = useState(today());
  const [particulars, setParticulars] = useState("");
  const [remarks, setRemarks] = useState("");
  const [tab, setTab] = useState<"service_credit" | "wellness_leave">("service_credit");
  const [loading, setLoading] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPersonnel() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/service-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_personnel" }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to load personnel.");
      const rows = (result.personnel ?? []) as Personnel[];
      const sortedRows = [...rows].sort((a, b) =>
        surnameSortKey(a.full_name).localeCompare(surnameSortKey(b.full_name), "en-PH") ||
        a.full_name.localeCompare(b.full_name, "en-PH")
      );
      setPersonnel(sortedRows);
      if (!selectedId && sortedRows[0]?.id) setSelectedId(sortedRows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load personnel.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecord(id: string) {
    setLoadingRecord(true);
    setError("");
    try {
      const response = await fetch("/api/service-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_personnel", personnel_id: id }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to load Service Credits.");
      setSelected(result.personnel ?? null);
      setSummary(result.summary ?? null);
      setTransactions((result.transactions ?? []) as Transaction[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Service Credits.");
    } finally {
      setLoadingRecord(false);
    }
  }

  useEffect(() => {
    void loadPersonnel();
  }, []);

  useEffect(() => {
    if (selectedId) void loadRecord(selectedId);
  }, [selectedId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return personnel;
    return personnel.filter((item) =>
      [item.full_name, item.email, item.position ?? ""].join(" ").toLowerCase().includes(needle)
    );
  }, [personnel, query]);

  const visibleTransactions = useMemo(
    () => transactions.filter((item) => item.credit_type === tab),
    [transactions, tab]
  );

  const wellnessRunningBalances = useMemo(() => {
    const sorted = transactions
      .filter((item) => item.credit_type === "wellness_leave")
      .slice()
      .sort((a, b) =>
        a.posting_date.localeCompare(b.posting_date) ||
        Number(a.ledger_sequence ?? 0) - Number(b.ledger_sequence ?? 0)
      );
    const usedByYear = new Map<string, number>();
    const result = new Map<string, number>();
    for (const item of sorted) {
      const year = item.posting_date.slice(0, 4);
      const used = (usedByYear.get(year) ?? 0) + Number(item.service_credits_used ?? 0);
      usedByYear.set(year, used);
      result.set(item.id, Math.max(0, 5 - used));
    }
    return result;
  }, [transactions]);

  async function postTransaction() {
    if (!selectedId) return;
    setPosting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/service-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "post_transaction",
          personnel_id: selectedId,
          transaction_kind: tab === "wellness_leave" ? "debit" : mode,
          credit_type: tab,
          amount,
          posting_date: postingDate,
          particulars,
          remarks,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to post transaction.");
      setAmount("");
      setParticulars("");
      setRemarks("");
      setMessage(tab === "wellness_leave" ? "Wellness Leave deducted from this calendar year only. Service Credits are unchanged." : mode === "credit" ? "Service Credits added successfully." : "Service Credits deducted successfully.");
      await Promise.all([loadRecord(selectedId), loadPersonnel()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post transaction.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a href="/portal" className={styles.back}><ArrowLeft size={16} />Back to Portal</a>

        <header className={styles.header}>
          <div>
            <span>HUMAN RESOURCES</span>
            <h1>Service Credits</h1>
            <p>Manage personnel Service Credits with a complete running transaction ledger.</p>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <div className={styles.workspace}>
          <aside className={styles.directory}>
            <label className={styles.search}>
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search personnel..." />
            </label>
            <div className={styles.personList}>
              {loading ? <p>Loading personnel...</p> : filtered.map((item) => (
                <button key={item.id} className={selectedId === item.id ? styles.selected : ""} onClick={() => setSelectedId(item.id)}>
                  <span>
                    <strong>{item.full_name}</strong>
                    <small>{item.position || "Personnel"}</small>
                  </span>
                  <b>{item.service_credit_balance === null || item.service_credit_balance === undefined ? "—" : formatDays(item.service_credit_balance)}</b>
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.account}>
            {!selectedId || loadingRecord || !selected ? (
              <div className={styles.empty}>{loadingRecord ? "Loading Service Credits..." : "Select a personnel account."}</div>
            ) : (
              <>
                <div className={styles.tabs}>
                  <button className={tab === "service_credit" ? styles.active : ""} onClick={() => { setTab("service_credit"); setAmount(""); }}>Service Credits</button>
                  <button className={tab === "wellness_leave" ? styles.active : ""} onClick={() => { setTab("wellness_leave"); setAmount(""); }}>Wellness Leave</button>
                </div>

                <div className={styles.accountHead}>
                  <div>
                    <span>{tab === "wellness_leave" ? `WELLNESS LEAVE · CALENDAR YEAR ${summary?.wellness_year ?? ""}` : "PERSONNEL SERVICE CREDIT ACCOUNT"}</span>
                    <h2>{selected.full_name}</h2>
                    <p>{selected.position || "Personnel"} · {selected.email}</p>
                  </div>
                  <div className={styles.balance}>
                    <span>{tab === "wellness_leave" ? "Annual Wellness Leave Remaining" : "Available Balance"}</span>
                    <strong>{moneyStyle(tab === "wellness_leave" ? summary?.wellness_leave_balance : summary?.service_credit_balance)}</strong>
                  </div>
                </div>

                <div className={styles.metrics}>
                  {tab === "wellness_leave" ? (
                    <>
                      <div><span>Annual Allowance</span><strong>{formatDays(summary?.wellness_allowance ?? 0)} days</strong></div>
                      <div><span>Used in {summary?.wellness_year}</span><strong>{formatDays(summary?.wellness_used ?? 0)} days</strong></div>
                      <div><span>Renews</span><strong>January 1</strong></div>
                    </>
                  ) : (
                    <>
                      <div><span>Total Earned</span><strong>+{formatDays(summary?.total_service_credits_earned ?? 0)}</strong></div>
                      <div><span>Total Used</span><strong>-{formatDays(summary?.total_service_credits_used ?? 0)}</strong></div>
                      <div><span>Transactions</span><strong>{summary?.transaction_count ?? 0}</strong></div>
                    </>
                  )}
                </div>

                <section className={styles.postingCard}>
                  {tab === "wellness_leave" ? (
                    <p>Deduct from the 5-day Wellness Leave allowance for the selected calendar year. Unused days expire December 31 and do not carry over. Earned Service Credits will not be affected.</p>
                  ) : (
                  <div className={styles.modeButtons}>
                    <button className={mode === "credit" ? styles.creditActive : ""} onClick={() => setMode("credit")}><PlusCircle size={16} />Add Service Credits</button>
                    <button className={mode === "debit" ? styles.debitActive : ""} onClick={() => setMode("debit")}><MinusCircle size={16} />Deduct Service Credits</button>
                  </div>
                  )}
                  <div className={styles.formGrid}>
                    <label><span>Posting Date</span><input type="date" max={tab === "wellness_leave" ? today() : undefined} value={postingDate} onChange={(event) => setPostingDate(event.target.value)} /></label>
                    <label><span>Amount (Days)</span><input type="number" min="0.01" max={tab === "wellness_leave" ? 5 : 999.99} step="0.5" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Example: 1.00" /></label>
                    <label className={styles.wide}><span>Particulars</span><input value={particulars} onChange={(event) => setParticulars(event.target.value)} placeholder="Reason, activity, leave date, or reference" /></label>
                    <label className={styles.wide}><span>Remarks</span><input value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional" /></label>
                  </div>
                  <button className={tab === "wellness_leave" || mode === "debit" ? styles.postDebit : styles.postCredit} onClick={() => void postTransaction()} disabled={posting || (tab === "wellness_leave" && !summary?.wellness_allowance)}>
                    {tab === "service_credit" && mode === "credit" ? <PlusCircle size={16} /> : <MinusCircle size={16} />}
                    {posting ? "Posting..." : tab === "wellness_leave" ? "Deduct Wellness Leave Only" : mode === "credit" ? "Post Credit" : "Post Deduction"}
                  </button>
                </section>



                <section className={styles.history}>
                  <div className={styles.historyHead}><ClipboardCheck size={18} /><div><h3>Transaction History</h3><p>Imported and HR-posted entries are retained as an audit trail.</p></div></div>
                  {visibleTransactions.length === 0 ? <div className={styles.empty}>No transactions recorded.</div> : (
                    <div className={styles.rows}>
                      {visibleTransactions.map((item) => (
                        <article key={item.id}>
                          <div><strong>{formatDate(item.posting_date)}</strong><span>{item.source === "excel_import" ? "Imported Excel" : item.created_by_name || "HR"}</span></div>
                          <div><strong>{item.particulars}</strong><span>{item.remarks || (item.absence_days > 0 ? `${item.absence_days.toFixed(2)} absence day(s)` : "No remarks")}</span></div>
                          <div className={styles.change}>
                            {tab === "service_credit" && item.service_credits_earned > 0 && <b className={styles.credit}>+{formatDays(item.service_credits_earned)}</b>}
                            {tab === "wellness_leave" && item.service_credits_earned > 0 && <span>Legacy allocation (not additional days)</span>}
                            {item.service_credits_used > 0 && <b className={styles.debit}>-{formatDays(item.service_credits_used)}</b>}
                            {item.transaction_kind === "opening_balance" && <b className={styles.opening}>Opening</b>}
                          </div>
                          <div className={styles.rowBalance}><span>{item.particulars === "Balance Forwarded to Division Office" ? "Balance Forwarded" : tab === "wellness_leave" ? `${item.posting_date.slice(0,4)} Remaining` : "Balance"}</span><strong>{item.particulars === "Balance Forwarded to Division Office" ? formatDays(item.previous_balance) + " days" : formatDays(tab === "wellness_leave" ? wellnessRunningBalances.get(item.id) ?? 5 : item.balance_after)}</strong></div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
