import { useDialogs } from '../../context/DialogContext';
import { useActions } from '../../hooks/useActions';
import { fmtDate } from '../../utils/format';
import BookLink from '../book/BookLink';
import Button from '../ui/Button';
import { ActionsTd, Table, Td, Th, Tr } from '../ui/Table';
import { Muted, TextLink } from '../ui/Text';

function HoldRow({ hold }) {
  const { open } = useDialogs();
  const { removeReservation } = useActions();
  return (
    <Tr>
      <Td>
        <BookLink id={hold.book_id} title={hold.title} coverUrl={hold.cover_url}>
          {hold.title}<br /><Muted>{hold.author}</Muted>
        </BookLink>
      </Td>
      <Td><TextLink className="font-normal text-accent" onClick={() => open('reader', hold.user_id)}>{hold.reader}</TextLink></Td>
      <Td>{fmtDate(hold.hold_until)}</Td>
      <ActionsTd>
        <Button size="sm" variant="primary" onClick={() => open('issue', hold.book_id)}>Выдать</Button>
        <Button size="sm" onClick={() => removeReservation(hold.id)}>Снять бронь</Button>
      </ActionsTd>
    </Tr>
  );
}

export default function HoldsTable({ holds }) {
  return (
    <Table head={<><Th>Книга</Th><Th>Читатель</Th><Th>Отложена до</Th><Th /></>}>
      {holds.map((h) => <HoldRow key={h.id} hold={h} />)}
    </Table>
  );
}
