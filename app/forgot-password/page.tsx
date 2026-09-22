"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import styles from "../login.module.css";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") || "").trim();

    if (!identifier) {
      setError("Enter your LRN or registered email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/recovery/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "We could not submit the reset request.");
        return;
      }

      setComplete(true);
      setMessage(
        result.message ??
          "If the account is active, the reset request has been submitted. Please contact the school administrator to verify your identity."
      );
    } catch {
      setError("Unable to reach the password reset service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.pageCompact}>
      <div className={styles.authShell}>
        <button className={styles.backLink} onClick={() => router.push("/")}>
          <ArrowLeft size={16} /> Back to sign in
        </button>

        <div className={styles.authHeader}>
          <img src="/school-logo.png" alt="Asuncion National High School logo" />
          <div>
            <strong>ASUNCION NATIONAL HIGH SCHOOL</strong>
            <span>Academic Portal · Administrator-Assisted Recovery</span>
          </div>
        </div>

        <section className={styles.authCard}>
          <h1>Forgot your password?</h1>
          <p>
            Submit a password reset request using your student LRN or registered
            staff email. An authorized school administrator must verify your
            identity before issuing a temporary password.
          </p>

          {!complete ? (
            <form className={styles.form} onSubmit={requestReset}>
              <label className={styles.field}>
                <span>LRN or registered email</span>
                <div className={styles.inputWrap}>
                  <UserRound size={18} />
                  <input
                    name="identifier"
                    required
                    autoComplete="username"
                    placeholder="Student LRN or staff email"
                    disabled={loading}
                  />
                </div>
              </label>

              <div className={styles.noticeBox}>
                <ShieldCheck size={17} />
                <span>
                  No recovery code will be sent by SMS or email. For security,
                  the school administrator will verify your identity before
                  providing a temporary password.
                </span>
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button className={styles.signInButton} type="submit" disabled={loading}>
                {loading ? "Submitting request..." : "Request password reset"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          ) : (
            <>
              <div className={styles.noticeBox}>{message}</div>
              <div className={styles.noticeBox}>
                After verification, the administrator will give you a temporary
                password. It expires after 24 hours and must be changed when you
                sign in.
              </div>
              <button
                className={styles.signInButton}
                type="button"
                onClick={() => router.push("/")}
              >
                Return to sign in <ArrowRight size={18} />
              </button>
            </>
          )}

          <div className={styles.noticeBox}>
            For privacy, this page does not reveal whether an LRN or email exists
            in the portal.
          </div>
        </section>
      </div>
    </main>
  );
}
