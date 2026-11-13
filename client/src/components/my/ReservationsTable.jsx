import { useActions } from '../../hooks/useActions';
import { fmtDate } from '../../utils/format';
import BookLink from '../book/BookLink';
import Button from '../ui/Button';
import { ActionsTd, Table, Td, Th, Tr } from '../ui/Table';
import { Muted } from '../ui/Text';

function ReservationRow({ reservation: r }) {
  const { unreserve } = useActions();
  return (
    <Tr>
      <Td>
        <BookLink id={r.book_id} title={r.title} coverUrl={r.cover_url}>
          {r.title}<br /><Muted>{r.author}</Muted>
        </BookLink>
      </Td>
      <Td>{fmtDate(r.created_at)}</Td>
      <Td>
        {r.ready_at
          ? <b className="text-ok">Готова к выдаче — заберите до {fmtDate(r.hold_until)}</b>
          : <>Место в очереди: <b>{r.position}</b></>}
      </Td>
      <ActionsTd>
        <Button size="sm" onClick={() => unreserve(r.book_id)}>Отменить</Button>
      </ActionsTd>
    </Tr>
  );
}

export default function ReservationsTable({ reservations }) {
  return (
    <Table head={<><Th>Книга</Th><Th>Забронирована</Th><Th>Статус</Th><Th /></>}>
      {reservations.map((r) => <ReservationRow key={r.book_id} reservation={r} />)}
    </Table>
  );
}
