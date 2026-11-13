import { useEffect, useState } from 'react';
import Button from './Button';
import Dialog from './Dialog';

// Окно с формой: заголовок, поля, текст ошибки и кнопки «Отмена» / подтверждение.
// onSubmit получает значения полей в виде объекта; брошенная ошибка показывается в окне.
// При изменении resetKey текст ошибки очищается.
export default function FormDialog({ title, submitLabel, onClose, onSubmit, resetKey, children }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(''), [resetKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(Object.fromEntries(new FormData(e.target)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 className="mb-4 text-2xl">{title}</h2>
        {children}
        <p className="mb-2 min-h-[1em] text-danger">{error}</p>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" disabled={busy}>{submitLabel}</Button>
        </div>
      </form>
    </Dialog>
  );
}
