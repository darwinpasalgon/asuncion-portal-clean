"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import styles from "../login.module.css";

type Role = "student" | "teacher";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const data = new FormData(event.currentTarget);
    const lrn = String(data.get("lrn") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const activationCode = String(data.get("activationCode") || "").trim();
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirmPassword") || "");

    if (role === "student" && !/^\d{12}$/.test(lrn)) {
      setError("Student LRN must contain exactly 12 digits.");
      return;
    }

    if (
      role === "teacher" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError("Enter the email address registered in the school masterlist.");
      return;
    }

    if (!activationCode) {
      setError("Enter the activation code issued by the school.");
      return;
    }

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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          lrn: role === "student" ? lrn : null,
          email: role === "teacher" ? email : null,
          phone,
          activationCode,
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          result.error ??
            "We could not activate the account. Check the information and try again."
        );
        return;
      }

      setComplete(true);
      setMessage(
        result.message ??
          "Your ANHS portal account has been activated. You can now sign in."
      );
    } catch {
      setError("Unable to reach the activation service. Please try again.");
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
            <span>Academic Portal · Account Activation</span>
          </div>
        </div>

        <section className={styles.authCard}>
          <h1>Activate your ANHS account</h1>
          <p>
            Use the official activation code issued by the school. Your name,
            role, grade level, and section come directly from the school
            masterlist and cannot be selected during activation.
          </p>

          {!complete ? (
            <>
              <div className={styles.roleTabs}>
                <button
                  type="button"
                  className={
                    styles.roleTab +
                    (role === "student" ? " " + styles.roleTabActive : "")
                  }
                  onClick={() => setRole("student")}
                  disabled={loading}
                >
                  Student
                </button>
                <button
                  type="button"
                  className={
                    styles.roleTab +
                    (role === "teacher" ? " " + styles.roleTabActive : "")
                  }
                  onClick={() => setRole("teacher")}
                  disabled={loading}
                >
                  Teacher
                </button>
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                  {role === "student" ? (
                    <label className={styles.field + " " + styles.spanTwo}>
                      <span>LRN</span>
                      <div className={styles.inputWrap}>
                        <UserRound size={18} />
                        <input
                          name="lrn"
                          required
                          inputMode="numeric"
                          maxLength={12}
                          placeholder="12-digit LRN"
                          disabled={loading}
                          autoComplete="username"
                        />
                      </div>
                      <small className={styles.helpText}>
                        Use the LRN listed in the official school masterlist.
                      </small>
                    </label>
                  ) : (
                    <label className={styles.field + " " + styles.spanTwo}>
                      <span>Registered email address</span>
                      <div className={styles.inputWrap}>
                        <Mail size={18} />
                        <input
                          name="email"
                          type="email"
                          required
                          placeholder="teacher@deped.gov.ph"
                          disabled={loading}
                          autoComplete="email"
                        />
                      </div>
                      <small className={styles.helpText}>
                        Use the same email imported by the school Administrator.
                      </small>
                    </label>
                  )}

                  <label className={styles.field + " " + styles.spanTwo}>
                    <span>School activation code</span>
                    <div className={styles.inputWrap}>
                      <KeyRound size={18} />
                      <input
                        name="activationCode"
                        required
                        placeholder="ANHS-XXXX-XXXX"
                        disabled={loading}
                        autoCapitalize="characters"
                        autoComplete="one-time-code"
                      />
                    </div>
                    <small className={styles.helpText}>
                      Activation codes can be used only once.
                    </small>
                  </label>

                  <label className={styles.field + " " + styles.spanTwo}>
                    <span>Mobile number</span>
                    <div className={styles.inputWrap}>
                      <Phone size={18} />
                      <input
                        name="phone"
                        required
                        inputMode="tel"
                        placeholder="09XX XXX XXXX"
                        disabled={loading}
                        autoComplete="tel"
                      />
                    </div>
                    <small className={styles.helpText}>
                      Used as school contact information and for identity verification.
                    </small>
                  </label>

                  <label className={styles.field}>
                    <span>Create password</span>
                    <div className={styles.inputWrap}>
                      <LockKeyhole size={18} />
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        placeholder="At least 8 characters"
                        disabled={loading}
                        autoComplete="new-password"
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
                    <span>Confirm password</span>
                    <div className={styles.inputWrap}>
                      <LockKeyhole size={18} />
                      <input
                        name="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        required
                        minLength={8}
                        placeholder="Repeat your password"
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowConfirm((value) => !value)}
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                        disabled={loading}
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button
                  className={styles.signInButton}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Activating account..." : "Activate account"}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className={styles.noticeBox}>{message}</div>
              <button
                className={styles.signInButton}
                type="button"
                onClick={() => router.push("/")}
              >
                Continue to sign in <ArrowRight size={18} />
              </button>
            </>
          )}

          <div className={styles.noticeBox}>
            <ShieldCheck size={17} />
            <span>
              Only people included in the official ANHS activation masterlist can
              create a new portal account. Administrator accounts cannot be
              activated from this public page.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
