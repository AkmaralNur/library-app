import { api } from '../../api';
import { useToast } from '../../context/ToastContext';
import FormDialog from '../ui/FormDialog';
import { Field, Input } from '../ui/Inputs';

export default function PasswordDialog({ onClose }) {
  const toast = useToast();

  const handleSubmit = async (values) => {
    await api.post('/api/password', values);
    onClose();
    toast('Пароль изменён');
  };

  return (
    <FormDialog title="Смена пароля" submitLabel="Сменить" onClose={onClose} onSubmit={handleSubmit}>
      <Field label="Текущий пароль">
        <Input name="oldPassword" type="password" required autoComplete="current-password" />
      </Field>
      <Field label="Новый пароль">
        <Input name="newPassword" type="password" required minLength={6} autoComplete="new-password" />
      </Field>
    </FormDialog>
  );
}
