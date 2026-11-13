export default function Tabs({ tabs, active, onSelect }) {
  return (
    <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={`cursor-pointer border-b-2 px-3 py-2 whitespace-nowrap ${
            t.id === active ? 'border-accent font-semibold text-accent' : 'border-transparent hover:border-accent'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
