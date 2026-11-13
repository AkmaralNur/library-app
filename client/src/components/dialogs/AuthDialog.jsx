import { useState } from 'react';
import { api } from '../../api';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import FormDialog from '../ui/FormDialog';
import { Field, Input } from '../ui/Inputs';

// Вход и регистрация
export default function AuthDialog({ onClose }) {
  const { setMe, refresh } = useSession();
  const toast = useToast();
  const [registering, setRegistering] = useState(false);

  const handleSubmit = async (values) => {
    const user = await api.post(registering ? '/api/register' : '/api/login', values);
    setMe(user);
    onClose();
    toast(`Здравствуйте, ${user.name}!`);
    refresh();
  };

  return (
    <FormDialog
      title={registering ? 'Регистрация' : 'Вход'}
      submitLabel={registering ? 'Зарегистрироваться' : 'Войти'}
      onClose={onClose}
      onSubmit={handleSubmit}
      resetKey={registering}
    >
      <Field label="Логин"><Input name="username" required autoComplete="username" /></Field>
      {registering && (
        <Field label="Имя и фамилия"><Input name="name" required autoComplete="name" /></Field>
      )}
      <Field label="Пароль">
        <Input
          name="password"
          type="password"
          required
          autoComplete={registering ? 'new-password' : 'current-password'}
        />
      </Field>
      <p className="mb-3 text-sm">
        <button
          type="button"
          className="cursor-pointer text-accent underline"
          onClick={() => setRegistering(!registering)}
        >
          {registering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </p>
    </FormDialog>
  );
}
