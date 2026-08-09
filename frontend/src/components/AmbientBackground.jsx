export default function AmbientBackground({ focus = 'center' }) {
  return (
    <div className="nx-ambient pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="nx-ambient__base" />
      <div className={`nx-ambient__wash nx-ambient__wash--${focus}`} />
      <div className="nx-ambient__grid" />
      <div className="nx-ambient__vignette" />
    </div>
  );
}
