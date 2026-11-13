import { useDialogs } from '../../context/DialogContext';
import { useSession } from '../../context/SessionContext';
import { useActions } from '../../hooks/useActions';
import Button from '../ui/Button';
import { Muted } from '../ui/Text';

export default function UserBox() {
  const { me, isLibrarian } = useSession();
  const { open } = useDialogs();
  const { logout } = useActions();

  if (!me) return <Button variant="primary" onClick={() => open('auth')}>Войти</Button>;

  return (
    <div className="flex items-center gap-2">
      <span>{me.name} <Muted>({isLibrarian ? 'библиотекарь' : 'читатель'})</Muted></span>
      <Button title="Сменить пароль" onClick={() => open('password')}>🔑</Button>
      <Button onClick={logout}>Выйти</Button>
    </div>
  );
}
