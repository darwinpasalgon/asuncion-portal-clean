export default function ApitongCredentialRecoveryPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f8fb", padding: "40px 20px" }}>
      <section
        style={{
          width: "min(620px, 100%)",
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #dfe8ed",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <a href="/portal/admin/learners" style={{ color: "#236b96", textDecoration: "none" }}>
          Back to Learner Management
        </a>
        <h1 style={{ color: "#153f66", marginTop: 24 }}>Grade 8 Apitong credentials</h1>
        <p style={{ color: "#71848f", lineHeight: 1.6 }}>
          This will issue new first-login credentials only to Grade 8 Apitong learners who
          are still marked to change their temporary password. The credentials file will be
          downloaded immediately and the previous temporary passwords will stop working.
        </p>
        <form action="/api/admin/reissue-section-credentials" method="post">
          <input type="hidden" name="grade_level" value="8" />
          <input type="hidden" name="section" value="Apitong" />
          <button
            type="submit"
            style={{
              marginTop: 12,
              minHeight: 44,
              border: 0,
              borderRadius: 9,
              background: "#287653",
              color: "#fff",
              padding: "0 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reissue Apitong credentials
          </button>
        </form>
      </section>
    </main>
  );
}
