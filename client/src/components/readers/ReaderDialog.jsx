import { api } from '../../api';
import { useDialogs } from '../../context/DialogContext';
import { useLoad } from '../../hooks/useLoad';
import { money } from '../../utils/format';
import LoansTable from '../loans/LoansTable';
import Dialog from '../ui/Dialog';
import { EmptyNote, Muted } from '../ui/Text';

// История выдач одного читателя
export default function ReaderDialog({ id }) {
  const { close } = useDialogs();
  const onClose = () => close('reader');
  const data = useLoad(
    () => Promise.all([api.get(`/api/readers/${id}/loans`), api.get('/api/readers')]),
    [id],
    onClose,
  );

  if (!data) return null;
  const [loans, readers] = data;
  const reader = readers.find((r) => r.id === id);
  if (!reader) return null;

  return (
    <Dialog wide showClose onClose={onClose}>
      <h2 className="mb-4 text-2xl">{reader.name} <Muted className="font-normal">@{reader.username}</Muted></h2>
      <p className="mb-4">
        На руках: <b>{reader.active_loans}</b> · Просрочено: <b>{reader.overdue}</b> ·
        {' '}Неоплаченные штрафы: <b>{money(reader.unpaid_fines)}</b> · Всего выдач: <b>{reader.total_loans}</b>
      </p>
      {loans.length
        ? <LoansTable loans={loans} />
        : <EmptyNote>Этот читатель ещё не брал книг</EmptyNote>}
    </Dialog>
  );
}
