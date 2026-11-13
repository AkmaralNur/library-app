import { api } from '../../api';
import { useSession } from '../../context/SessionContext';
import { useLoad } from '../../hooks/useLoad';

export default function Stats() {
  const { isLibrarian } = useSession();
  const s = useLoad(() => api.get('/api/stats'));
  if (!s) return <div className="mt-1 min-h-6" />;

  let text = `Книг: ${s.total} · В наличии: ${s.available} · Авторов: ${s.authors}`;
  if (isLibrarian) text += ` · Читателей: ${s.readers}${s.overdue ? ` · Просрочено: ${s.overdue}` : ''}`;
  return <div className="mt-1 min-h-6 text-muted">{text}</div>;
}
