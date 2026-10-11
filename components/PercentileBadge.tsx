export default function PercentileBadge({ percentile }: { percentile: number }) {
  return (
    <div className="pct-badge" role="status" aria-live="polite">
      <span className="txt">Cleaner than</span>
      <span className="num">{percentile}%</span>
      <span className="txt">of students like you</span>
    </div>
  );
}
