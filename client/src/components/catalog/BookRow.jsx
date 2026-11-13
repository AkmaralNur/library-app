import { useDialogs } from '../../context/DialogContext';
import { useSession } from '../../context/SessionContext';
import { useActions } from '../../hooks/useActions';
import BookLink from '../book/BookLink';
import Button from '../ui/Button';
import Stars from '../ui/Stars';
import { ActionsTd, Td, Tr } from '../ui/Table';
import { Muted } from '../ui/Text';
import BookStatus from './BookStatus';
import ReserveButton from './ReserveButton';

export default function BookRow({ book }) {
  const { isLibrarian } = useSession();
  const { open } = useDialogs();
  const { deleteBook } = useActions();

  return (
    <Tr>
      <Td><BookLink id={book.id} title={book.title} coverUrl={book.cover_url} /></Td>
      <Td>{book.author}</Td>
      <Td className="max-md:hidden">{book.year}</Td>
      <Td className="max-md:hidden">{book.genre}</Td>
      <Td className="whitespace-nowrap">
        <Stars rating={book.rating} />
        {book.reviews_count ? <Muted> ({book.reviews_count})</Muted> : null}
      </Td>
      <Td><BookStatus book={book} /></Td>
      <ActionsTd>
        {isLibrarian ? (
          <>
            <Button variant="icon" size="sm" title="Изменить" onClick={() => open('bookForm', { id: book.id })}>✏️</Button>
            <Button variant="icon" size="sm" title="Удалить" onClick={() => deleteBook(book.id)}>🗑️</Button>
          </>
        ) : (
          <ReserveButton book={book} />
        )}
      </ActionsTd>
    </Tr>
  );
}
