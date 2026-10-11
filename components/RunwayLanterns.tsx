const MAX = 14;

/** One glowing lantern per day of runway (capped at 14), dimming from the right. Never fully dark. */
export default function RunwayLanterns({ days }: { days: number | null }) {
  const lit = days === null ? MAX : Math.max(1, Math.min(MAX, days));
  return (
    <div className="lanterns" role="img" aria-label={days === null ? 'Runway unavailable' : `${days} days of runway`}>
      {Array.from({ length: MAX }, (_, i) => (
        <span key={i} className={`lantern ${i < lit ? '' : 'dim'}`} />
      ))}
    </div>
  );
}
