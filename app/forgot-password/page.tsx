"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, MessageSquareText, UserRound } from "lucide-react";
import styles from "../login.module.css";

type Channel = "email" | "sms";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("email");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") || "").trim();

    if (!identifier) {
      setMessage("Enter your LRN or registered email address.");
      return;
    }

    setMessage(
      channel === "email"
        ? "Email recovery is ready for OTP integration."
        : "SMS recovery is ready once an SMS provider is connected."
    );
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
            Enter your account identifier, choose where you want to receive the
            verification code, then verify the code before choosing a new password.
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>LRN or registered email</span>
              <div className={styles.inputWrap}>
                <UserRound size={18} />
                <input
                  name="identifier"
                  required
                  autoComplete="username"
                  placeholder="Student LRN or staff email"
                />
              </div>
            </label>

            <div>
              <span className={styles.field}>Send verification code through</span>
              <div className={styles.channelGrid}>
                <button
                  type="button"
                  className={`${styles.channelCard} ${channel === "email" ? styles.channelCardActive : ""}`}
                  onClick={() => setChannel("email")}
                >
                  <Mail size={19} />
                  <strong>Email</strong>
                  <span>Send a one-time code to the registered email address.</span>
                </button>
                <button
                  type="button"
                  className={`${styles.channelCard} ${channel === "sms" ? styles.channelCardActive : ""}`}
                  onClick={() => setChannel("sms")}
                >
                  <MessageSquareText size={19} />
                  <strong>SMS</strong>
                  <span>Send a one-time code to the registered mobile number.</span>
                </button>
              </div>
            </div>

            {message && <p className={styles.noticeBox}>{message}</p>}

            <button className={styles.signInButton} type="submit">
              Send verification code <ArrowRight size={18} />
            </button>
          </form>

          <div className={styles.noticeBox}>
            For privacy, the live version will always return a neutral response
            whether or not an account exists. Recovery codes will expire and will
            never be stored in readable form.
          </div>
        </section>
      </div>
    </main>
  );
}
