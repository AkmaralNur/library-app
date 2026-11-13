import { Table, Th } from '../ui/Table';
import { EmptyState } from '../ui/Text';
import BookRow from './BookRow';

export default function BooksTable({ books }) {
  return (
    <>
      <Table
        head={
          <>
            <Th>Название</Th>
            <Th>Автор</Th>
            <Th className="max-md:hidden">Год</Th>
            <Th className="max-md:hidden">Жанр</Th>
            <Th>Рейтинг</Th>
            <Th>Статус</Th>
            <Th />
          </>
        }
      >
        {books?.map((book) => <BookRow key={book.id} book={book} />)}
      </Table>
      {books?.length === 0 && <EmptyState>Ничего не найдено</EmptyState>}
    </>
  );
}
