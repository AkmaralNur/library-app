import { useDialogs } from '../../context/DialogContext';
import Cover from '../ui/Cover';

// Обложка с названием, открывает карточку книги. Вместо названия можно передать своё содержимое
export default function BookLink({ id, title, coverUrl, children }) {
  const { open } = useDialogs();
  return (
    <button
      type="button"
      onClick={() => open('book', id)}
      className="group flex cursor-pointer items-center gap-2.5 text-left font-semibold"
    >
      <Cover url={coverUrl} title={title} />
      <span className="group-hover:text-accent group-hover:underline">{children ?? title}</span>
    </button>
  );
}
