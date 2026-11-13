import { useActions } from '../../hooks/useActions';
import { fmtDate } from '../../utils/format';
import Button from '../ui/Button';
import { EmptyNote, Muted } from '../ui/Text';

export default function BookQueue({ queue }) {
  const { removeReservation } = useActions();

  if (!queue.length) return <EmptyNote>Никто не ждёт</EmptyNote>;

  return (
    <ol className="list-decimal pl-5">
      {queue.map((r) => (
        <li key={r.id}>
          {r.name}{' '}
          {r.ready_at ? <b className="text-ok">книга отложена</b> : <Muted>с {fmtDate(r.created_at)}</Muted>}{' '}
          <Button variant="link" size="link" onClick={() => removeReservation(r.id)}>снять бронь</Button>
        </li>
      ))}
    </ol>
  );
}
