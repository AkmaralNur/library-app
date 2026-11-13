import { useDialogs } from '../../context/DialogContext';
import { useSession } from '../../context/SessionContext';
import { useActions } from '../../hooks/useActions';
import { fmtDate, isOverdue } from '../../utils/format';
import StatusBadge from '../ui/StatusBadge';

const Note = ({ late = false, children }) => (
  <small className={`mt-0.5 block ${late ? 'font-semibold text-danger' : 'text-muted'}`}>{children}</small>
);

// Статус книги в таблице. У библиотекаря метка работает как кнопка выдачи или возврата
export default function BookStatus({ book }) {
  const { isLibrarian } = useSession();
  const { open } = useDialogs();
  const { returnBook } = useActions();
  const issue = isLibrarian ? () => open('issue', book.id) : undefined;

  if (book.available && book.held) {
    const who = !book.held_for_me && book.held_by ? `для ${book.held_by}, ` : '';
    const info = <Note>{who}до {fmtDate(book.hold_until)}</Note>;
    if (isLibrarian) {
      return <><StatusBadge tone="hold" title="Выдать читателю" onClick={issue}>Отложена</StatusBadge>{info}</>;
    }
    return book.held_for_me
      ? <><StatusBadge tone="hold">Отложена для вас</StatusBadge>{info}</>
      : <StatusBadge tone="hold">Забронирована</StatusBadge>;
  }

  if (book.available) {
    return <StatusBadge tone="in" title="Выдать читателю" onClick={issue}>В наличии</StatusBadge>;
  }

  const who = book.mine ? 'у вас, ' : book.borrower ? `${book.borrower}, ` : '';
  const queue = book.queue ? ` · очередь: ${book.queue}` : '';
  return (
    <>
      <StatusBadge
        tone="out"
        title="Оформить возврат"
        onClick={isLibrarian ? () => returnBook(book.id) : undefined}
      >
        Выдана
      </StatusBadge>
      <Note late={isOverdue(book.due_at)}>{who}до {fmtDate(book.due_at)}{queue}</Note>
    </>
  );
}
