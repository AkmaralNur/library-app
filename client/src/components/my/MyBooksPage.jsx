import { api } from '../../api';
import { useLoad } from '../../hooks/useLoad';
import LoansTable from '../loans/LoansTable';
import { EmptyNote, SectionTitle } from '../ui/Text';
import FinesNotice from './FinesNotice';
import ReservationsTable from './ReservationsTable';

export default function MyBooksPage() {
  const loans = useLoad(() => api.get('/api/loans'));
  const reservations = useLoad(() => api.get('/api/reservations'));
  if (!loans || !reservations) return null;

  const active = loans.filter((l) => !l.returned_at);
  const history = loans.filter((l) => l.returned_at);
  const unpaid = loans.reduce((sum, l) => sum + (l.fine_paid ? 0 : l.fine), 0);

  return (
    <>
      {unpaid > 0 && <FinesNotice unpaid={unpaid} />}

      <SectionTitle>На руках</SectionTitle>
      {active.length
        ? <LoansTable loans={active} />
        : <EmptyNote>Сейчас у вас нет книг. Забронируйте книгу в каталоге и заберите её в библиотеке.</EmptyNote>}

      <SectionTitle>Мои брони</SectionTitle>
      {reservations.length
        ? <ReservationsTable reservations={reservations} />
        : <EmptyNote>Нет броней. Нажмите «📌 Забронировать» у любой книги в каталоге.</EmptyNote>}

      <SectionTitle>История</SectionTitle>
      {history.length ? <LoansTable loans={history} /> : <EmptyNote>Пока пусто</EmptyNote>}
    </>
  );
}
