import { useDialogs } from '../../context/DialogContext';
import BookDialog from '../book/BookDialog';
import ReaderDialog from '../readers/ReaderDialog';
import AuthDialog from './AuthDialog';
import BookFormDialog from './BookFormDialog';
import IssueDialog from './IssueDialog';
import NewReaderDialog from './NewReaderDialog';
import PasswordDialog from './PasswordDialog';

// Все окна приложения. Открываются через useDialogs().open(имя, значение)
export default function DialogHost() {
  const { dialogs, close } = useDialogs();
  return (
    <>
      {dialogs.book && <BookDialog key={dialogs.book} id={dialogs.book} />}
      {dialogs.reader && <ReaderDialog key={dialogs.reader} id={dialogs.reader} />}
      {dialogs.bookForm && <BookFormDialog id={dialogs.bookForm.id} onClose={() => close('bookForm')} />}
      {dialogs.issue && <IssueDialog id={dialogs.issue} onClose={() => close('issue')} />}
      {dialogs.auth && <AuthDialog onClose={() => close('auth')} />}
      {dialogs.password && <PasswordDialog onClose={() => close('password')} />}
      {dialogs.newReader && <NewReaderDialog onClose={() => close('newReader')} />}
    </>
  );
}
