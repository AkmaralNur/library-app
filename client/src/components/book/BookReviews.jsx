import { useSession } from '../../context/SessionContext';
import { EmptyNote } from '../ui/Text';
import ReviewForm from './ReviewForm';
import ReviewItem from './ReviewItem';

export default function BookReviews({ book }) {
  const { me, isReader } = useSession();
  const myReview = me ? book.reviews.find((r) => r.user_id === me.id) : null;

  return (
    <>
      {isReader && <ReviewForm key={myReview?.id ?? 'new'} bookId={book.id} myReview={myReview} />}
      {book.reviews.length
        ? book.reviews.map((r) => <ReviewItem key={r.id} review={r} />)
        : <EmptyNote>Отзывов пока нет</EmptyNote>}
    </>
  );
}
