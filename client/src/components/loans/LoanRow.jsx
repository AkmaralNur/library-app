import { useDialogs } from '../../context/DialogContext';
import { useSession } from '../../context/SessionContext';
import { useActions } from '../../hooks/useActions';
import { fmtDate, money } from '../../utils/format';
import Button from '../ui/Button';
import StatusBadge from '../ui/StatusBadge';
import { ActionsTd, Td, Tr } from '../ui/Table';
import { Muted, TextLink } from '../ui/Text';

function LoanStatus({ loan }) {
  if (loan.returned_at) return <StatusBadge>Возвращена {fmtDate(loan.returned_at)}</StatusBadge>;
  return loan.overdue
    ? <StatusBadge tone="out">Просрочена</StatusBadge>
    : <StatusBadge tone="in">На руках</StatusBadge>;
}

function LoanFine({ loan }) {
  if (!loan.fine) return null;
  return (
    <span className={loan.fine_paid ? 'text-muted' : 'font-semibold text-danger'}>
      {money(loan.fine)}{loan.fine_paid ? ' ✓ оплачен' : ''}
    </span>
  );
}

export default function LoanRow({ loan, showReader }) {
  const { isLibrarian, config } = useSession();
  const { open } = useDialogs();
  const { returnBook, extendLoan, payFine } = useActions();

  return (
    <Tr highlight={Boolean(loan.overdue)}>
      <Td>
        <TextLink onClick={() => open('book', loan.book_id)}>{loan.title}</TextLink>
        <br />
        <Muted>{loan.author}</Muted>
      </Td>
      {showReader && (
        <Td><TextLink className="font-normal text-accent" onClick={() => open('reader', loan.user_id)}>{loan.borrower}</TextLink></Td>
      )}
      <Td>{fmtDate(loan.issued_at)}</Td>
      <Td>
        {fmtDate(loan.due_at)}
        {loan.extensions ? <Muted> (продлено ×{loan.extensions})</Muted> : null}
      </Td>
      <Td><LoanStatus loan={loan} /></Td>
      <Td><LoanFine loan={loan} /></Td>
      <ActionsTd>
        {isLibrarian && !loan.returned_at && (
          <Button size="sm" onClick={() => returnBook(loan.book_id)}>Принять</Button>
        )}
        {loan.can_extend && (
          <Button size="sm" title={`+${config.extendDays} дней`} onClick={() => extendLoan(loan.id)}>Продлить</Button>
        )}
        {isLibrarian && loan.fine && !loan.fine_paid ? (
          <Button size="sm" onClick={() => payFine(loan.id)}>Штраф оплачен</Button>
        ) : null}
      </ActionsTd>
    </Tr>
  );
}
