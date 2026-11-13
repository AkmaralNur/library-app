import { api } from '../api';
import { useDialogs } from '../context/DialogContext';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/format';

// Действия с книгами и выдачами, которые нужны сразу в нескольких компонентах
export function useActions() {
  const { me, setMe, refresh } = useSession();
  const { open, close, closeAll } = useDialogs();
  const toast = useToast();

  // Любая ошибка сервера показывается уведомлением
  const safe = (action) => async (...args) => {
    try {
      await action(...args);
    } catch (err) {
      toast(err.message, true);
    }
  };

  return {
    logout: safe(async () => {
      await api.post('/api/logout');
      setMe(null);
      closeAll();
      refresh();
    }),

    deleteBook: safe(async (id) => {
      if (!confirm('Удалить книгу?')) return;
      await api.delete(`/api/books/${id}`);
      close('book');
      toast('Книга удалена');
      refresh();
    }),

    returnBook: safe(async (id) => {
      if (!confirm('Оформить возврат книги?')) return;
      const res = await api.post(`/api/books/${id}/return`);
      toast(res.next ? `Возврат оформлен. Книга отложена для: ${res.next.name}` : 'Возврат оформлен');
      refresh();
    }),

    extendLoan: safe(async (id) => {
      const loan = await api.post(`/api/loans/${id}/extend`);
      toast(`Срок продлён до ${fmtDate(loan.due_at)}`);
      refresh();
    }),

    payFine: safe(async (id) => {
      if (!confirm('Отметить штраф как оплаченный?')) return;
      await api.post(`/api/loans/${id}/pay`);
      toast('Штраф отмечен оплаченным');
      close('reader');
      refresh();
    }),

    reserve: safe(async (id) => {
      if (!me) {
        toast('Войдите, чтобы забронировать книгу');
        open('auth');
        return;
      }
      const res = await api.post(`/api/books/${id}/reserve`);
      toast(res.ready
        ? `Книга отложена для вас до ${fmtDate(res.hold_until)} — заберите её в библиотеке`
        : `Вы в очереди под номером ${res.position}. Когда книга освободится, её отложат для вас`);
      refresh();
    }),

    unreserve: safe(async (id) => {
      await api.delete(`/api/books/${id}/reserve`);
      toast('Бронь отменена');
      refresh();
    }),

    removeReservation: safe(async (id) => {
      if (!confirm('Снять бронь читателя?')) return;
      await api.delete(`/api/reservations/${id}`);
      toast('Бронь снята');
      refresh();
    }),

    deleteReview: safe(async (id) => {
      if (!confirm('Удалить отзыв?')) return;
      await api.delete(`/api/reviews/${id}`);
      refresh();
    }),

    saveReview: safe(async (bookId, data) => {
      await api.post(`/api/books/${bookId}/reviews`, data);
      toast('Спасибо за отзыв!');
      refresh();
    }),
  };
}
