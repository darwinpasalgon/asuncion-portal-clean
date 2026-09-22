"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MessageSquareText,
  UserRound,
} from "lucide-react";
import styles from "../login.module.css";

type Channel = "email" | "sms";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("email");
  const [identifier, setIdentifier] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [stage, setStage] = useState<"request" | "verify" | "complete">("request");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);
    const value = String(data.get("identifier") || "").trim();

    if (!value) {
      setError("Enter your LRN or registered email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/recovery/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: value, channel }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "We could not send the verification code.");
        return;
      }

      setIdentifier(value);
      setChallengeId(String(result.challenge_id || ""));
      setMessage(
        "If the account exists, a 6-digit verification code has been sent to the selected recovery method."
      );
      setStage("verify");
    } catch {
      setError("Unable to reach the recovery service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const data = new FormData(event.currentTarget);
    const code = String(data.get("code") || "").trim();
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code,
          newPassword,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "The code is invalid or has expired.");
        return;
      }

      setMessage("Your password has been updated. You can now sign in.");
      setStage("complete");
    } catch {
      setError("Unable to verify the recovery code. Please try again.");
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
            <span>Academic Portal · Account Recovery</span>
          </div>
        </div>

        <section className={styles.authCard}>
          <h1>Reset your password</h1>
          <p>
            Choose email or SMS, enter the one-time verification code, then set
            your new password.
          </p>

          {stage === "request" && (
            <form className={styles.form} onSubmit={requestCode}>
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

              <div>
                <span className={styles.field}>Send verification code through</span>
                <div className={styles.channelGrid}>
                  <button
                    type="button"
                    className={styles.channelCard + (channel === "email" ? " " + styles.channelCardActive : "")}
                    onClick={() => setChannel("email")}
                    disabled={loading}
                  >
                    <Mail size={19} />
                    <strong>Email</strong>
                    <span>Send a one-time code to the registered email address.</span>
                  </button>
                  <button
                    type="button"
                    className={styles.channelCard + (channel === "sms" ? " " + styles.channelCardActive : "")}
                    onClick={() => setChannel("sms")}
                    disabled={loading}
                  >
                    <MessageSquareText size={19} />
                    <strong>SMS</strong>
                    <span>Send a one-time code to the registered mobile number.</span>
                  </button>
                </div>
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button className={styles.signInButton} type="submit" disabled={loading}>
                {loading ? "Sending code..." : "Send verification code"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {stage === "verify" && (
            <form className={styles.form} onSubmit={verifyCode}>
              <div className={styles.noticeBox}>{message}</div>

              <label className={styles.field}>
                <span>Verification code</span>
                <div className={styles.inputWrap}>
                  <MessageSquareText size={18} />
                  <input
                    name="code"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="6-digit code"
                    disabled={loading}
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span>New password</span>
                <div className={styles.inputWrap}>
                  <LockKeyhole size={18} />
                  <input
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
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
                  <LockKeyhole size={18} />
                  <input
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Repeat your new password"
                    disabled={loading}
                  />
                </div>
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button className={styles.signInButton} type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Reset password"}
                {!loading && <ArrowRight size={18} />}
              </button>

              <button
                type="button"
                className={styles.backLink}
                onClick={() => {
                  setStage("request");
                  setChallengeId("");
                  setMessage("");
                  setError("");
                }}
                disabled={loading}
              >
                Use a different recovery method
              </button>
            </form>
          )}

          {stage === "complete" && (
            <>
              <div className={styles.noticeBox}>{message}</div>
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
            Recovery codes expire after 10 minutes and are stored only as
            one-way hashes. For privacy, recovery does not reveal whether an
            LRN or email exists in the portal.
          </div>

          {stage === "verify" && (
            <p className={styles.helpText}>
              Recovery requested for {identifier}. If no code arrives, return
              and try the other registered recovery method.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
