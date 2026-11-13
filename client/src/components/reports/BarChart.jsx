import { EmptyNote } from '../ui/Text';

export default function BarChart({ items, label }) {
  if (!items.length) return <EmptyNote>Нет данных</EmptyNote>;
  const max = Math.max(...items.map((i) => i.n));

  return items.map((item, index) => (
    <div key={index} className="my-2 grid grid-cols-[minmax(0,1.3fr)_1fr_auto] items-center gap-2 text-sm">
      <span className="truncate">{label(item)}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-[#f0ebe4]">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${(item.n / max) * 100}%` }} />
      </span>
      <b>{item.n}</b>
    </div>
  ));
}
