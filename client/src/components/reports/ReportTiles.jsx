import { money } from '../../utils/format';

export default function ReportTiles({ totals: t }) {
  const tiles = [
    ['Всего выдач', t.loans],
    ['На руках', t.active],
    ['Просрочено', t.overdue],
    ['Штрафы к оплате', money(t.fines_unpaid)],
    ['Штрафов оплачено', money(t.fines_paid)],
  ];
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-white p-4 shadow-sm">
          <span className="block text-[13px] text-muted">{label}</span>
          <b className="text-2xl">{value}</b>
        </div>
      ))}
    </div>
  );
}
