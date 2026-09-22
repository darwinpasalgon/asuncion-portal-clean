"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") || "").trim();
    const password = String(form.get("password") || "");

    if (!email || !password) {
      setError("Enter your email address and password.");
      return;
    }

    setError("");
    router.push("/portal");
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
            <p>Sign in using your school account to continue.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Email address</span>
              <div className={styles.inputWrap}>
                <Mail size={18} aria-hidden="true" />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@school.edu.ph"
                  aria-label="Email address"
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
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <div className={styles.formOptions}>
              <label className={styles.remember}>
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <button type="button" className={styles.textButton}>
                Forgot password?
              </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.signInButton}>
              Sign in
              <ArrowRight size={18} />
            </button>
          </form>

          <div className={styles.accountPrompt}>\n            <span>New to the portal?</span>\n            <button type="button" className={styles.textButton} onClick={() => router.push("/register")}>Create an account</button>\n          </div>\n\n          <div className={styles.demoNote}>
            <ShieldCheck size={17} />
            <p>
              <strong>Demo mode:</strong> authentication is not connected yet.
              Enter any LRN/email and password to preview the existing portal while secure authentication is being connected.
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
