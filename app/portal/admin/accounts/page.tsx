"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock3, RefreshCw, ShieldCheck, UserRound, X } from "lucide-react";
import styles from "./accounts.module.css";

type PendingAccount = {
  id: string;
  full_name: string;
  email: string;
  recovery_phone: string;
  lrn: string | null;
  requested_role: "student" | "teacher";
  account_status: "pending";
  created_at: string;
};

export default function AccountApprovalsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  async function loadAccounts() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/accounts", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load pending accounts.");
        return;
      }
      setAccounts(result.accounts ?? []);
    } catch {
      setError("Unable to reach the account service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function decide(id: string, action: "approve" | "reject") {
    setWorkingId(id);
    setError("");
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to update the account.");
        return;
      }
      setAccounts((current) => current.filter((account) => account.id !== id));
    } catch {
      setError("Unable to reach the account service.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <button className={styles.back} onClick={() => router.push("/portal")}>
          <ArrowLeft size={16} /> Back to portal
        </button>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ADMINISTRATION</span>
            <h1>Account approvals</h1>
            <p>
              Review new student and teacher registrations before giving them
              access to school records.
            </p>
          </div>
          <div className={styles.security}>
            <ShieldCheck size={20} />
            Active administrators only
          </div>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelTop}>
            <div>
              <h2>Pending registrations</h2>
              <p>{accounts.length} account{accounts.length === 1 ? "" : "s"} awaiting review</p>
            </div>
            <button className={styles.refresh} onClick={() => void loadAccounts()} disabled={loading}>
              <RefreshCw size={16} className={loading ? styles.spin : ""} />
              Refresh
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {loading ? (
            <div className={styles.empty}>
              <Clock3 size={28} />
              <strong>Loading registrations…</strong>
            </div>
          ) : accounts.length === 0 ? (
            <div className={styles.empty}>
              <Check size={30} />
              <strong>No pending accounts</strong>
              <span>New registrations will appear here for review.</span>
            </div>
          ) : (
            <div className={styles.list}>
              {accounts.map((account) => (
                <article className={styles.card} key={account.id}>
                  <div className={styles.identity}>
                    <span className={styles.avatar}><UserRound size={22} /></span>
                    <div>
                      <h3>{account.full_name}</h3>
                      <span className={styles.role}>{account.requested_role}</span>
                    </div>
                  </div>

                  <dl className={styles.details}>
                    {account.lrn && (
                      <div>
                        <dt>LRN</dt>
                        <dd>{account.lrn}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Email</dt>
                      <dd>{account.email}</dd>
                    </div>
                    <div>
                      <dt>Mobile</dt>
                      <dd>{account.recovery_phone}</dd>
                    </div>
                    <div>
                      <dt>Registered</dt>
                      <dd>{new Date(account.created_at).toLocaleString()}</dd>
                    </div>
                  </dl>

                  <div className={styles.actions}>
                    <button
                      className={styles.reject}
                      disabled={workingId === account.id}
                      onClick={() => void decide(account.id, "reject")}
                    >
                      <X size={16} />
                      Reject
                    </button>
                    <button
                      className={styles.approve}
                      disabled={workingId === account.id}
                      onClick={() => void decide(account.id, "approve")}
                    >
                      <Check size={16} />
                      {workingId === account.id ? "Updating…" : "Approve"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
