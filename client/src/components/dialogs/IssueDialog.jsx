import { api } from '../../api';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import { useLoad } from '../../hooks/useLoad';
import { money } from '../../utils/format';
import FormDialog from '../ui/FormDialog';
import { Field, Input, Select } from '../ui/Inputs';

function readerLabel(reader, firstInQueue) {
  const notes = [];
  if (reader.id === firstInQueue) notes.push('первый в очереди');
  if (reader.overdue) notes.push(`просрочек: ${reader.overdue}`);
  if (reader.unpaid_fines) notes.push(`штраф ${money(reader.unpaid_fines)}`);
  return `${reader.name} (@${reader.username})${notes.length ? ` — ${notes.join(', ')}` : ''}`;
}

// Выдача книги читателю
export default function IssueDialog({ id, onClose }) {
  const { refresh } = useSession();
  const toast = useToast();
  const data = useLoad(
    () => Promise.all([api.get(`/api/books/${id}`), api.get('/api/readers')]),
    [id],
    onClose,
  );

  if (!data) return null;
  const [book, readers] = data;
  const firstInQueue = book.queue_list[0]?.user_id;

  const handleSubmit = async (values) => {
    await api.post(`/api/books/${id}/issue`, { userId: Number(values.userId), days: Number(values.days) });
    onClose();
    toast('Книга выдана');
    refresh();
  };

  return (
    <FormDialog title="Выдать книгу" submitLabel="Выдать" onClose={onClose} onSubmit={handleSubmit}>
      <p className="mb-3 text-muted">«{book.title}» — {book.author}</p>
      {readers.length === 0 && <p className="mb-3 text-danger">Нет зарегистрированных читателей</p>}
      <Field label="Читатель">
        <Select name="userId" required defaultValue={firstInQueue}>
          {readers.map((r) => <option key={r.id} value={r.id}>{readerLabel(r, firstInQueue)}</option>)}
        </Select>
      </Field>
      <Field label="Срок, дней">
        <Input name="days" type="number" min="1" max="365" defaultValue="14" required />
      </Field>
    </FormDialog>
  );
}
