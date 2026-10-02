"use client";

type ActionWaitOverlayProps = {
  visible: boolean;
  message?: string;
};

export default function ActionWaitOverlay({
  visible,
  message = "Please wait…",
}: ActionWaitOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="anhs-action-wait"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="anhs-action-wait-card">
        <div className="anhs-action-wait-spinner" aria-hidden="true" />
        <strong>{message}</strong>
        <span>Saving your changes securely.</span>
      </div>
    </div>
  );
}
