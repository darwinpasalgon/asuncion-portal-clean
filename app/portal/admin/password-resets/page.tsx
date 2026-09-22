"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Clock3,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import styles from "../accounts/accounts.module.css";

type ResetRequest = {
  id: string;
  user_id: string;
  requested_at: string;
  profile: {
    full_name: string;
    email: string;
    lrn: string | null;
    role: string | null;
    account_status: string;
  } | null;
};

type IssuedPassword = {
  name: string;
  password: string;
  expiresAt: string;
};

export default function PasswordResetRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/password-resets", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Could not load password reset requests.");
        return;
      }
      setRequests(result.requests ?? []);
    } catch {
      setError("Unable to reach the password reset service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function issueTemporaryPassword(request: ResetRequest) {
    const name = request.profile?.full_name ?? "this user";
    const confirmed = window.confirm(
      `Only continue after verifying the identity of ${name}. Generate a temporary password now?`
    );
    if (!confirmed) return;

    setWorkingId(request.id);
    setError("");
    try {
      const response = await fetch("/api/admin/password-resets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Could not create the temporary password.");
        return;
      }

      setIssued({
        name,
        password: String(result.temporary_password || ""),
        expiresAt: String(result.expires_at || ""),
      });
      setRequests((current) => current.filter((item) => item.id !== request.id));
    } catch {
      setError("Unable to reach the password reset service.");
    } finally {
      setWorkingId("");
    }
  }

  async function copyPassword() {
    if (!issued?.password) return;
    await navigator.clipboard.writeText(issued.password);
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
            <h1>Password reset requests</h1>
            <p>
              Verify the user against official school records before creating a
              temporary password. Temporary passwords expire after 24 hours and
              must be changed on first sign-in.
            </p>
          </div>
          <div className={styles.security}>
            <ShieldCheck size={16} /> Authorized administrators only
          </div>
        </header>

        {issued && (
          <section className={styles.panel}>
            <div className={styles.panelTop}>
              <div>
                <h2>Temporary password created</h2>
                <p>Copy it now. The portal will not display it again after this page is closed.</p>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.identity}>
                <span className={styles.avatar}><KeyRound size={22} /></span>
                <div>
                  <h3>{issued.name}</h3>
                  <span className={styles.role}>Identity verified</span>
                </div>
              </div>
              <div className={styles.tempPassword}>{issued.password}</div>
              <p className={styles.tempNote}>
                Expires {issued.expiresAt ? new Date(issued.expiresAt).toLocaleString() : "within 24 hours"}.
                Share this password only with the verified account owner.
              </p>
              <div className={styles.actions}>
                <button className={styles.approve} onClick={() => void copyPassword()}>
                  <Clipboard size={16} /> Copy temporary password
                </button>
              </div>
            </div>
          </section>
        )}

        <section className={styles.panel + " " + styles.panelSpacing}>
          <div className={styles.panelTop}>
            <div>
              <h2>Pending reset requests</h2>
              <p>{requests.length} request{requests.length === 1 ? "" : "s"} awaiting identity verification</p>
            </div>
            <button className={styles.refresh} onClick={() => void loadRequests()} disabled={loading}>
              <RefreshCw size={16} className={loading ? styles.spin : ""} />
              Refresh
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {loading ? (
            <div className={styles.empty}>
              <Clock3 size={28} />
              <strong>Loading reset requests…</strong>
            </div>
          ) : requests.length === 0 ? (
            <div className={styles.empty}>
              <Check size={30} />
              <strong>No pending password resets</strong>
              <span>New administrator-assisted requests will appear here.</span>
            </div>
          ) : (
            <div className={styles.list}>
              {requests.map((request) => (
                <article className={styles.card} key={request.id}>
                  <div className={styles.identity}>
                    <span className={styles.avatar}><UserRound size={22} /></span>
                    <div>
                      <h3>{request.profile?.full_name ?? "Unknown account"}</h3>
                      <span className={styles.role}>{request.profile?.role ?? "user"}</span>
                    </div>
                  </div>

                  <dl className={styles.details}>
                    {request.profile?.lrn && (
                      <div>
                        <dt>LRN</dt>
                        <dd>{request.profile.lrn}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Email</dt>
                      <dd>{request.profile?.email ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{request.profile?.account_status ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Requested</dt>
                      <dd>{new Date(request.requested_at).toLocaleString()}</dd>
                    </div>
                  </dl>

                  <div className={styles.actions}>
                    <button
                      className={styles.approve}
                      disabled={workingId === request.id}
                      onClick={() => void issueTemporaryPassword(request)}
                    >
                      <KeyRound size={16} />
                      {workingId === request.id ? "Creating…" : "Verify & create temporary password"}
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
