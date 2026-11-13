import Cover from '../ui/Cover';
import Stars from '../ui/Stars';
import { Muted } from '../ui/Text';
import BookActions from './BookActions';
import BookDialogStatus from './BookDialogStatus';

// Верхняя часть карточки: обложка, название, рейтинг, статус и кнопки
export default function BookHead({ book }) {
  return (
    <div className="flex items-start gap-5 max-md:flex-col">
      <Cover url={book.cover_url} title={book.title} size="big" />
      <div className="space-y-1.5">
        <h2 className="mr-8 text-2xl">{book.title}</h2>
        <p className="text-lg">{book.author}</p>
        <p className="text-muted">{[book.year, book.genre].filter(Boolean).join(' · ')}</p>
        <p>
          <Stars rating={book.rating} />
          {book.rating ? <> <b>{book.rating}</b> <Muted>({book.reviews_count} отз.)</Muted></> : null}
          <Muted> · выдавалась {book.times_borrowed} раз</Muted>
        </p>
        <p><BookDialogStatus book={book} /></p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BookActions book={book} />
        </div>
      </div>
    </div>
  );
}
