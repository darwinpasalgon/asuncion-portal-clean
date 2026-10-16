export default function Loading() {
  return (
    <div
      className="portal-module-loading"
      role="status"
      aria-label="Loading Page"
    >
      <div className="portal-skeleton portal-skeleton-title" />
      <div className="portal-skeleton portal-skeleton-subtitle" />
      <div className="portal-skeleton-grid">
        {[0, 1, 2].map((item) => (
          <div className="portal-skeleton portal-skeleton-card" key={item} />
        ))}
      </div>
      <span className="sr-only">Opening your school tools…</span>
    </div>
  );
}
