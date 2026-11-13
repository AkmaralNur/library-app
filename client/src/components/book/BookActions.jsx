import { useDialogs } from '../../context/DialogContext';
import { useSession } from '../../context/SessionContext';
import { useActions } from '../../hooks/useActions';
import { fmtDate } from '../../utils/format';
import Button from '../ui/Button';
import { Muted } from '../ui/Text';

function LibrarianActions({ book }) {
  const { open } = useDialogs();
  const { returnBook } = useActions();
  return (
    <>
      {book.available
        ? <Button variant="primary" onClick={() => open('issue', book.id)}>Выдать</Button>
        : <Button variant="primary" onClick={() => returnBook(book.id)}>Принять возврат</Button>}
      <Button onClick={() => open('bookForm', { id: book.id })}>✏️ Изменить</Button>
    </>
  );
}

function ReaderActions({ book }) {
  const { config } = useSession();
  const { reserve, unreserve } = useActions();
  const cancel = <Button onClick={() => unreserve(book.id)}>Отменить бронь</Button>;

  if (book.mine) return <Muted>Книга у вас до {fmtDate(book.due_at)}.</Muted>;

  if (book.held_for_me) {
    return (
      <>
        <span className="text-ok"><b>Книга отложена для вас до {fmtDate(book.hold_until)}</b> — заберите её в библиотеке.</span>
        {cancel}
      </>
    );
  }

  if (book.my_position) {
    return (
      <>
        <span>Вы в очереди: <b>{book.my_position}</b>. Когда книга освободится, её отложат для вас.</span>
        {cancel}
      </>
    );
  }

  if (book.available && !book.held) {
    return (
      <>
        <Button variant="primary" onClick={() => reserve(book.id)}>📌 Забронировать</Button>
        <Muted>Книгу отложат для вас на {config.holdDays} дня — заберите её в библиотеке.</Muted>
      </>
    );
  }

  return (
    <>
      <Button variant="primary" onClick={() => reserve(book.id)}>📌 Встать в очередь</Button>
      <Muted>{book.queue ? `В очереди: ${book.queue}. ` : ''}Когда книга освободится, её отложат для вас.</Muted>
    </>
  );
}

function GuestActions({ book }) {
  const { reserve } = useActions();
  return (
    <>
      <Button variant="primary" onClick={() => reserve(book.id)}>📌 Забронировать</Button>
      <Muted>Нужно войти — это займёт минуту.</Muted>
    </>
  );
}

export default function BookActions({ book }) {
  const { me, isLibrarian } = useSession();
  if (isLibrarian) return <LibrarianActions book={book} />;
  return me ? <ReaderActions book={book} /> : <GuestActions book={book} />;
}
