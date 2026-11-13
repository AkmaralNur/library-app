import { useDialogs } from '../../context/DialogContext';
import { money } from '../../utils/format';
import { Table, Td, Th, Tr } from '../ui/Table';
import { TextLink } from '../ui/Text';

function ReaderRow({ reader: r }) {
  const { open } = useDialogs();
  return (
    <Tr highlight={r.overdue > 0}>
      <Td><TextLink onClick={() => open('reader', r.id)}>{r.name}</TextLink></Td>
      <Td className="text-muted">@{r.username}</Td>
      <Td>{r.active_loans}</Td>
      <Td>{r.overdue ? <span className="font-semibold text-danger">{r.overdue}</span> : '0'}</Td>
      <Td>{r.unpaid_fines ? <span className="font-semibold text-danger">{money(r.unpaid_fines)}</span> : '—'}</Td>
      <Td>{r.total_loans}</Td>
    </Tr>
  );
}

export default function ReadersTable({ readers }) {
  return (
    <Table
      head={
        <>
          <Th>Читатель</Th>
          <Th>Логин</Th>
          <Th>На руках</Th>
          <Th>Просрочено</Th>
          <Th>Штрафы</Th>
          <Th>Всего выдач</Th>
        </>
      }
    >
      {readers?.map((r) => <ReaderRow key={r.id} reader={r} />)}
      {readers?.length === 0 && (
        <Tr><Td colSpan={6} className="p-6 text-center text-muted">Читателей не найдено</Td></Tr>
      )}
    </Table>
  );
}
