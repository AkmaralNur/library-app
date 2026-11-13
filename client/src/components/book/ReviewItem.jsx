import { useSession } from '../../context/SessionContext';
import { useActions } from '../../hooks/useActions';
import { fmtDate } from '../../utils/format';
import Button from '../ui/Button';
import Stars from '../ui/Stars';
import { Muted } from '../ui/Text';

export default function ReviewItem({ review }) {
  const { me, isLibrarian } = useSession();
  const { deleteReview } = useActions();
  const canDelete = isLibrarian || (me && review.user_id === me.id);

  return (
    <div className="border-t border-line py-2.5">
      <div>
        <Stars rating={review.rating} /> <b>{review.name}</b> <Muted>{fmtDate(review.created_at)}</Muted>{' '}
        {canDelete && (
          <Button variant="link" size="link" onClick={() => deleteReview(review.id)}>удалить</Button>
        )}
      </div>
      {review.text && <p className="mt-1.5 leading-normal">{review.text}</p>}
    </div>
  );
}
