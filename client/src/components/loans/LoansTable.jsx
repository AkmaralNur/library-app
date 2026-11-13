import { Table, Th } from '../ui/Table';
import LoanRow from './LoanRow';

// Таблица выдач, общая для нескольких разделов
export default function LoansTable({ loans, showReader = false }) {
  return (
    <Table
      head={
        <>
          <Th>Книга</Th>
          {showReader && <Th>Читатель</Th>}
          <Th>Выдана</Th>
          <Th>Вернуть до</Th>
          <Th>Статус</Th>
          <Th>Штраф</Th>
          <Th />
        </>
      }
    >
      {loans.map((loan) => <LoanRow key={loan.id} loan={loan} showReader={showReader} />)}
    </Table>
  );
}
