"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") || "").trim();
    const password = String(form.get("password") || "");

    if (!identifier || !password) {
      setError("Enter your LRN or email address and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to sign in.");
        return;
      }

      router.replace("/portal");
      router.refresh();
    } catch {
      setError("Unable to reach the sign-in service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <img
            src="/school-logo.png"
            alt="Asuncion National High School logo"
            className={styles.logo}
          />
          <div>
            <p className={styles.schoolLabel}>ASUNCION NATIONAL HIGH SCHOOL</p>
            <p className={styles.portalLabel}>Academic Portal</p>
          </div>
        </div>

        <div className={styles.brandMessage}>
          <span className={styles.badge}>
            <GraduationCap size={16} />
            School Year 2026–2027
          </span>
          <h1>Learning starts with being connected.</h1>
          <p>
            One secure place for students, teachers, and school administrators
            to access academic information and school resources.
          </p>
        </div>

        <div className={styles.brandFooter}>
          <ShieldCheck size={18} />
          <span>Designed for the Asuncion NHS school community</span>
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formWrap}>
          <div className={styles.mobileBrand}>
            <img src="/school-logo.png" alt="" />
            <div>
              <strong>ASUNCION NHS</strong>
              <span>Academic Portal</span>
            </div>
          </div>

          <div className={styles.intro}>
            <span className={styles.demoPill}>PORTAL ACCESS</span>
            <h2>Welcome back</h2>
            <p>
              Students sign in with their LRN. Teachers and staff sign in with
              their registered email address.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>LRN or email address</span>
              <div className={styles.inputWrap}>
                <UserRound size={18} aria-hidden="true" />
                <input
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Student LRN or staff email"
                  aria-label="LRN or email address"
                  disabled={loading}
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>Password</span>
              <div className={styles.inputWrap}>
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-label="Password"
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

            <div className={styles.formOptions}>
              <span />
              <button
                type="button"
                className={styles.textButton}
                onClick={() => router.push("/forgot-password")}
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.signInButton}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className={styles.accountPrompt}>
            <span>New to the portal?</span>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => router.push("/register")}
              disabled={loading}
            >
              Create an account
            </button>
          </div>

          <div className={styles.demoNote}>
            <ShieldCheck size={17} />
            <p>
              Accounts must use a registered email address and mobile number.
              Newly created accounts require school verification before they can
              access academic records.
            </p>
          </div>

          <footer className={styles.footer}>
            <span>Asuncion National High School</span>
            <span>Academic Portal · 2026</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
