import { CATEGORY_LABELS } from '@/lib/bubble';

export default function CategoryBars({ cats }: { cats: { category: string; kg: number; usd: number }[] }) {
  if (!cats.length) return <p>No spending this week yet.</p>;
  const max = Math.max(...cats.map((c) => c.kg), 0.01);
  return (
    <div className="bars">
      {cats.map((c) => (
        <div className="bar-row" key={c.category}>
          <span>{CATEGORY_LABELS[c.category] ?? c.category}</span>
          <div className="bar-track" role="img" aria-label={`${c.kg} kg CO2e`}>
            <div className="bar-fill" style={{ width: `${Math.max(4, (c.kg / max) * 100)}%` }} />
          </div>
          <span style={{ textAlign: 'right' }}>{c.kg.toFixed(1)} kg</span>
        </div>
      ))}
    </div>
  );
}
