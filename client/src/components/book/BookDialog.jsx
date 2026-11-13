import { api } from '../../api';
import { useDialogs } from '../../context/DialogContext';
import { useSession } from '../../context/SessionContext';
import { useLoad } from '../../hooks/useLoad';
import LoansTable from '../loans/LoansTable';
import Dialog from '../ui/Dialog';
import { DialogSubtitle, EmptyNote } from '../ui/Text';
import BookHead from './BookHead';
import BookQueue from './BookQueue';
import BookReviews from './BookReviews';

export default function BookDialog({ id }) {
  const { isLibrarian } = useSession();
  const { close } = useDialogs();
  const onClose = () => close('book');
  const book = useLoad(() => api.get(`/api/books/${id}`), [id], onClose);

  if (!book) return null;

  return (
    <Dialog wide showClose onClose={onClose}>
      <BookHead book={book} />
      {book.description && <p className="mt-4 leading-relaxed">{book.description}</p>}
      {/* Сразу после входа здесь ещё данные, загруженные для гостя: без очереди и истории */}
      {isLibrarian && book.queue_list && (
        <>
          <DialogSubtitle>Очередь</DialogSubtitle>
          <BookQueue queue={book.queue_list} />
          <DialogSubtitle>История выдач</DialogSubtitle>
          {book.history.length
            ? <LoansTable loans={book.history} showReader />
            : <EmptyNote>Книгу ещё не выдавали</EmptyNote>}
        </>
      )}
      <DialogSubtitle>Отзывы</DialogSubtitle>
      <BookReviews book={book} />
    </Dialog>
  );
}
