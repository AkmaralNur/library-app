import { api } from '../../api';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import FormDialog from '../ui/FormDialog';
import { Field, Input } from '../ui/Inputs';

export default function NewReaderDialog({ onClose }) {
  const { refresh } = useSession();
  const toast = useToast();

  const handleSubmit = async (values) => {
    const user = await api.post('/api/readers', values);
    onClose();
    toast(`Читатель ${user.name} создан`);
    refresh();
  };

  return (
    <FormDialog title="Новый читатель" submitLabel="Создать" onClose={onClose} onSubmit={handleSubmit}>
      <Field label="Имя и фамилия"><Input name="name" required /></Field>
      <Field label="Логин"><Input name="username" required /></Field>
      <Field label="Пароль"><Input name="password" required minLength={6} /></Field>
    </FormDialog>
  );
}
