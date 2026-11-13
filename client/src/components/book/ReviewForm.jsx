import { useState } from 'react';
import { useActions } from '../../hooks/useActions';
import Button from '../ui/Button';
import { Textarea } from '../ui/Inputs';
import RatingInput from './RatingInput';

export default function ReviewForm({ bookId, myReview }) {
  const { saveReview } = useActions();
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [text, setText] = useState(myReview?.text ?? '');

  const handleSubmit = (e) => {
    e.preventDefault();
    saveReview(bookId, { rating, text });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-3 flex flex-col items-start gap-2">
      <RatingInput value={rating} onChange={setRating} />
      <Textarea
        rows={2}
        placeholder="Ваш отзыв (необязательно)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" variant="primary">{myReview ? 'Обновить отзыв' : 'Оставить отзыв'}</Button>
    </form>
  );
}
