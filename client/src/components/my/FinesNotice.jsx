import { useSession } from '../../context/SessionContext';
import { money } from '../../utils/format';

export default function FinesNotice({ unpaid }) {
  const { config } = useSession();
  return (
    <div className="mb-4 rounded-[10px] border border-[#f1c9c5] bg-[#fdf1f0] px-4 py-3 leading-relaxed">
      ⚠️ У вас неоплаченные штрафы: <b>{money(unpaid)}</b>.
      {' '}Штраф — {money(config.finePerDay)} за каждый день просрочки. Оплатить можно в библиотеке.
    </div>
  );
}
