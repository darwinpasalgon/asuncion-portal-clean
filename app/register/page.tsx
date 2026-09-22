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
  Phone,
  UserRound,
} from "lucide-react";
import styles from "../login.module.css";

type Role = "student" | "teacher";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("fullName") || "").trim();
    const lrn = String(data.get("lrn") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirmPassword") || "");

    if (role === "student" && !/^\d{12}$/.test(lrn)) {
      setError("Student LRN must contain exactly 12 digits.");
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
          fullName,
          lrn: role === "student" ? lrn : null,
          email,
          phone,
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const baseError = result.error ?? "We could not create the account.";
        setError(result.authStatus ? `${baseError} (Auth ${result.authStatus})` : baseError);
        return;
      }

      setComplete(true);
      setMessage(
        result.message ??
          "Account created. Your account is pending school verification."
      );
    } catch {
      setError("Unable to reach the registration service. Please try again.");
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
            <span>Academic Portal · Account Registration</span>
          </div>
        </div>

        <section className={styles.authCard}>
          <h1>Create your account</h1>
          <p>
            Register your official contact information. Students will use their
            LRN to sign in; teachers will use their registered email address.
            Your mobile number will be used for password recovery by SMS.
          </p>

          {!complete ? (
            <>
              <div className={styles.roleTabs}>
                <button
                  type="button"
                  className={styles.roleTab + (role === "student" ? " " + styles.roleTabActive : "")}
                  onClick={() => setRole("student")}
                  disabled={loading}
                >
                  Student
                </button>
                <button
                  type="button"
                  className={styles.roleTab + (role === "teacher" ? " " + styles.roleTabActive : "")}
                  onClick={() => setRole("teacher")}
                  disabled={loading}
                >
                  Teacher
                </button>
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                  <label className={styles.field + " " + styles.spanTwo}>
                    <span>Full name</span>
                    <div className={styles.inputWrap}>
                      <UserRound size={18} />
                      <input
                        name="fullName"
                        required
                        placeholder="Complete name"
                        disabled={loading}
                      />
                    </div>
                  </label>

                  {role === "student" && (
                    <label className={styles.field}>
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
                        />
                      </div>
                      <small className={styles.helpText}>
                        This will be your student login ID.
                      </small>
                    </label>
                  )}

                  <label className={styles.field}>
                    <span>Email address</span>
                    <div className={styles.inputWrap}>
                      <Mail size={18} />
                      <input
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                        disabled={loading}
                      />
                    </div>
                  </label>

                  <label className={styles.field}>
                    <span>Mobile number</span>
                    <div className={styles.inputWrap}>
                      <Phone size={18} />
                      <input
                        name="phone"
                        type="tel"
                        required
                        autoComplete="tel"
                        placeholder="09XX XXX XXXX"
                        disabled={loading}
                      />
                    </div>
                    <small className={styles.helpText}>
                      Used for password recovery by SMS.
                    </small>
                  </label>

                  <label className={styles.field}>
                    <span>Password</span>
                    <div className={styles.inputWrap}>
                      <LockKeyhole size={18} />
                      <input
                        name="password"
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
                    <span>Confirm password</span>
                    <div className={styles.inputWrap}>
                      <LockKeyhole size={18} />
                      <input
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        placeholder="Repeat your password"
                        disabled={loading}
                      />
                    </div>
                  </label>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button
                  className={styles.signInButton}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Create account"}
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
                Return to sign in <ArrowRight size={18} />
              </button>
            </>
          )}

          <div className={styles.noticeBox}>
            New accounts start as <strong>pending</strong> until the school
            validates the student LRN or teacher record. The registered mobile
            number will be used for password recovery. Administrator accounts
            cannot be created through public registration.
          </div>
          <p className={styles.helpText}>Registration build: 2026-09-22.3</p>
        </section>
      </div>
    </main>
  );
}
