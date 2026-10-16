"use client";

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <div className="portal-error-state" role="alert">
      <h1>This Page Couldn’t Load</h1>
      <p>Your workspace is still available. Try opening this page again.</p>
      <button onClick={reset}>Try Again</button>
      <a href="/portal">Return to Overview</a>
    </div>
  );
}
