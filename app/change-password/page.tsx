"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import styles from "../login.module.css";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const data = new FormData(event.currentTarget);
    const password = String(data.get("newPassword") || "");
    const confirm = String(data.get("confirmPassword") || "");

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Could not update your password.");
        return;
      }

      await fetch("/api/auth/logout", { method: "POST" });
      setComplete(true);
    } catch {
      setError("Unable to reach the password service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.pageCompact}>
      <div className={styles.authShell}>
        <div className={styles.authHeader}>
          <img src="/school-logo.png" alt="Asuncion National High School logo" />
          <div>
            <strong>ASUNCION NATIONAL HIGH SCHOOL</strong>
            <span>Academic Portal · Required Password Change</span>
          </div>
        </div>

        <section className={styles.authCard}>
          <h1>Create your new password</h1>
          <p>
            You signed in using a temporary password issued by the school.
            Create a private password before accessing the portal.
          </p>

          {!complete ? (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.noticeBox}>
                <ShieldCheck size={17} />
                <span>
                  Your administrator cannot see the password you create here.
                  Do not reuse the temporary password.
                </span>
              </div>

              <label className={styles.field}>
                <span>New password</span>
                <div className={styles.inputWrap}>
                  <LockKeyhole size={18} />
                  <input
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className={styles.field}>
                <span>Confirm new password</span>
                <div className={styles.inputWrap}>
                  <KeyRound size={18} />
                  <input
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    disabled={loading}
                  />
                </div>
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button className={styles.signInButton} type="submit" disabled={loading}>
                {loading ? "Updating password..." : "Save new password"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          ) : (
            <>
              <div className={styles.noticeBox}>
                Your password has been changed successfully. Sign in again using
                your new password.
              </div>
              <button className={styles.signInButton} onClick={() => router.replace("/")}>
                Return to sign in <ArrowRight size={18} />
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
