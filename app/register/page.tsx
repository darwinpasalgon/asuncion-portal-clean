"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import styles from "../login.module.css";

type Role = "student" | "teacher";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirmPassword") || "");
    const lrn = String(data.get("lrn") || "").trim();

    if (role === "student" && !/^\d{12}$/.test(lrn)) {
      setMessage("Student LRN must contain exactly 12 digits.");
      return;
    }

    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setMessage("Registration form is ready. Secure account creation will be connected to Supabase Auth next.");
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
          </p>

          <div className={styles.roleTabs}>
            <button
              type="button"
              className={`${styles.roleTab} ${role === "student" ? styles.roleTabActive : ""}`}
              onClick={() => setRole("student")}
            >
              Student
            </button>
            <button
              type="button"
              className={`${styles.roleTab} ${role === "teacher" ? styles.roleTabActive : ""}`}
              onClick={() => setRole("teacher")}
            >
              Teacher
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <label className={`${styles.field} ${styles.spanTwo}`}>
                <span>Full name</span>
                <div className={styles.inputWrap}>
                  <UserRound size={18} />
                  <input name="fullName" required placeholder="Complete name" />
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
                    />
                  </div>
                  <small className={styles.helpText}>This will be your student login ID.</small>
                </label>
              )}

              <label className={styles.field}>
                <span>Email address</span>
                <div className={styles.inputWrap}>
                  <Mail size={18} />
                  <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
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
                    placeholder="+63 9XX XXX XXXX"
                  />
                </div>
                <small className={styles.helpText}>Used for account recovery by SMS.</small>
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
                  />
                </div>
              </label>
            </div>

            {message && <p className={styles.noticeBox}>{message}</p>}

            <button className={styles.signInButton} type="submit">
              Create account <ArrowRight size={18} />
            </button>
          </form>

          <div className={styles.noticeBox}>
            New accounts will start as <strong>pending</strong> until the school
            validates the student LRN or teacher record. Administrator accounts
            cannot be created through this form.
          </div>
        </section>
      </div>
    </main>
  );
}
