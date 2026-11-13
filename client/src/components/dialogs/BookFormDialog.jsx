import { api } from '../../api';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import { useLoad } from '../../hooks/useLoad';
import FormDialog from '../ui/FormDialog';
import { Field, Input, Textarea } from '../ui/Inputs';
import CoverField from './CoverField';

// Добавление новой книги (id = null) и редактирование существующей
export default function BookFormDialog({ id, onClose }) {
  const { refresh } = useSession();
  const toast = useToast();
  const genres = useLoad(() => api.get('/api/genres')) ?? [];
  const book = useLoad(() => (id ? api.get(`/api/books/${id}`) : Promise.resolve(null)), [id], onClose);

  if (id && !book) return null;

  const handleSubmit = async (values) => {
    if (id) await api.put(`/api/books/${id}`, values);
    else await api.post('/api/books', values);
    onClose();
    toast(id ? 'Книга сохранена' : 'Книга добавлена');
    refresh();
  };

  return (
    <FormDialog
      title={id ? 'Редактировать книгу' : 'Новая книга'}
      submitLabel="Сохранить"
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Название"><Input name="title" required defaultValue={book?.title} /></Field>
      <Field label="Автор"><Input name="author" required defaultValue={book?.author} /></Field>
      <div className="flex gap-3">
        <Field label="Год"><Input name="year" type="number" min="0" defaultValue={book?.year ?? ''} /></Field>
        <Field label="Жанр"><Input name="genre" list="genre-list" defaultValue={book?.genre ?? ''} /></Field>
      </div>
      <datalist id="genre-list">
        {genres.map((g) => <option key={g} value={g} />)}
      </datalist>
      <CoverField initialUrl={book?.cover_url ?? ''} />
      <Field label="Описание"><Textarea name="description" rows={3} defaultValue={book?.description ?? ''} /></Field>
    </FormDialog>
  );
}
