import { useSession } from '../../context/SessionContext';
import { fmtDate, isOverdue } from '../../utils/format';
import StatusBadge from '../ui/StatusBadge';

export default function BookDialogStatus({ book }) {
  const { isLibrarian } = useSession();

  if (book.available && book.held) {
    const holder = book.held_for_me ? 'для вас ' : book.held_by ? `для ${book.held_by} ` : '';
    return (
      <>
        <StatusBadge tone="hold">{holder || isLibrarian ? 'Отложена' : 'Забронирована'}</StatusBadge>
        {holder && <span className="text-muted"> {holder}до {fmtDate(book.hold_until)}</span>}
      </>
    );
  }

  if (book.available) return <StatusBadge tone="in">В наличии</StatusBadge>;

  const who = book.mine ? 'у вас ' : book.borrower ? `${book.borrower} ` : '';
  return (
    <>
      <StatusBadge tone="out">Выдана</StatusBadge>{' '}
      <span className={isOverdue(book.due_at) ? 'font-semibold text-danger' : 'text-muted'}>
        {who}до {fmtDate(book.due_at)}
      </span>
    </>
  );
}
