import { useActions } from '../../hooks/useActions';
import Button from '../ui/Button';
import { Muted } from '../ui/Text';

// Кнопка брони для читателя и гостя (гостю она предложит войти)
export default function ReserveButton({ book }) {
  const { reserve, unreserve } = useActions();

  if (book.mine) return <Muted>у вас</Muted>;
  if (book.reserved_by_me) {
    return <Button size="sm" onClick={() => unreserve(book.id)}>Отменить бронь</Button>;
  }
  return <Button size="sm" variant="primary" onClick={() => reserve(book.id)}>📌 Забронировать</Button>;
}
