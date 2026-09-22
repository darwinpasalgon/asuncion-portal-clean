"use client";

import { FormEvent, useEffect, useState } from "react";
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
  const [gradeLevel, setGradeLevel] = useState("");
  const [section, setSection] = useState("");
  const [gradeOptions, setGradeOptions] = useState<number[]>([7, 8, 9, 10, 11, 12]);
  const [sectionOptions, setSectionOptions] = useState<Record<string, string[]>>({});
  const [optionsReady, setOptionsReady] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      try {
        const response = await fetch("/api/academic/registration-options", {
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load grade and section choices.");
        }

        const grades = (result.grades ?? [])
          .map((item: { grade_level?: number }) => Number(item.grade_level))
          .filter((value: number) => Number.isInteger(value));

        const map: Record<string, string[]> = {};
        for (const item of result.sections ?? []) {
          const key = String(item.grade_level ?? "");
          const name = String(item.name ?? "");
          if (!key || !name) continue;
          if (!map[key]) map[key] = [];
          map[key].push(name);
        }

        if (active) {
          if (grades.length) setGradeOptions(grades);
          setSectionOptions(map);
          setOptionsReady(true);
        }
      } catch {
        if (active) {
          setOptionsError("Unable to load the current grade and section choices. Refresh the page and try again.");
          setOptionsReady(false);
        }
      }
    }

    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

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
    const sectionsForGrade = sectionOptions[gradeLevel] ?? [];

    if (role === "student" && !/^\d{12}$/.test(lrn)) {
      setError("Student LRN must contain exactly 12 digits.");
      return;
    }

    if (role === "student" && !optionsReady) {
      setError("Grade and section choices are still loading. Please wait a moment.");
      return;
    }

    if (role === "student" && !gradeLevel) {
      setError("Select your current grade level.");
      return;
    }

    if (
      role === "student" &&
      sectionsForGrade.length > 0 &&
      !sectionsForGrade.includes(section)
    ) {
      setError("Select your section.");
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
          gradeLevel: role === "student" ? Number(gradeLevel) : null,
          section: role === "student" && section ? section : null,
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
            Your mobile number is collected as school contact information.
          </p>

          {!complete ? (
            <>
              <div className={styles.roleTabs}>
                <button
                  type="button"
                  className={styles.roleTab + (role === "student" ? " " + styles.roleTabActive : "")}
                  onClick={() => {
                    setRole("student");
                  }}
                  disabled={loading}
                >
                  Student
                </button>
                <button
                  type="button"
                  className={styles.roleTab + (role === "teacher" ? " " + styles.roleTabActive : "")}
                  onClick={() => {
                    setRole("teacher");
                    setGradeLevel("");
                    setSection("");
                  }}
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

                  {role === "student" && (
                    <>
                      <label className={styles.field}>
                        <span>Grade level</span>
                        <div className={styles.inputWrap}>
                          <select
                            name="gradeLevel"
                            required
                            value={gradeLevel}
                            onChange={(event) => {
                              setGradeLevel(event.target.value);
                              setSection("");
                            }}
                            disabled={loading || !optionsReady}
                            aria-label="Grade level"
                          >
                            <option value="">
                              {optionsReady ? "Select grade level" : "Loading grade levels..."}
                            </option>
                            {gradeOptions.map((grade) => (
                              <option key={grade} value={grade}>
                                Grade {grade}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>

                      <label className={styles.field}>
                        <span>Section</span>
                        <div className={styles.inputWrap}>
                          <select
                            name="section"
                            value={section}
                            required={(sectionOptions[gradeLevel] ?? []).length > 0}
                            onChange={(event) => setSection(event.target.value)}
                            disabled={loading || !optionsReady || !gradeLevel}
                            aria-label="Section"
                          >
                            {!optionsReady ? (
                              <option value="">Loading sections...</option>
                            ) : !gradeLevel ? (
                              <option value="">Select grade level first</option>
                            ) : (sectionOptions[gradeLevel] ?? []).length === 0 ? (
                              <option value="">Sections will be added soon</option>
                            ) : (
                              <>
                                <option value="">Select section</option>
                                {(sectionOptions[gradeLevel] ?? []).map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                        </div>
                        {gradeLevel && optionsReady && (sectionOptions[gradeLevel] ?? []).length === 0 && (
                          <small className={styles.helpText}>
                            Grade {gradeLevel} sections will be added soon.
                          </small>
                        )}
                      </label>
                    </>
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
                      Saved as school contact information.
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

                {optionsError && <p className={styles.error}>{optionsError}</p>}
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
            validates the student LRN or teacher record. Forgotten passwords are
            handled through administrator-assisted identity verification.
            Administrator accounts cannot be created through public registration.
          </div>
          <p className={styles.helpText}>Registration build: 2026-09-22.5</p>
        </section>
      </div>
    </main>
  );
}
