import { useRef, useState } from 'react';
import CatalogPage from './components/catalog/CatalogPage';
import DialogHost from './components/dialogs/DialogHost';
import Header from './components/layout/Header';
import LoansPage from './components/loans/LoansPage';
import MyBooksPage from './components/my/MyBooksPage';
import ReadersPage from './components/readers/ReadersPage';
import ReportsPage from './components/reports/ReportsPage';
import { useSession } from './context/SessionContext';

const TABS = [
  { id: 'catalog', label: 'Каталог', Page: CatalogPage },
  { id: 'my', label: 'Мои книги', role: 'reader', Page: MyBooksPage },
  { id: 'loans', label: 'Выдачи', role: 'librarian', Page: LoansPage },
  { id: 'readers', label: 'Читатели', role: 'librarian', Page: ReadersPage },
  { id: 'reports', label: 'Отчёты', role: 'librarian', Page: ReportsPage },
];

export default function App() {
  const { me, refresh } = useSession();
  const [tab, setTab] = useState('catalog');
  const visited = useRef(new Set());

  const tabs = TABS.filter((t) => !t.role || t.role === me?.role);
  const active = tabs.some((t) => t.id === tab) ? tab : 'catalog';
  if (active !== tab) setTab(active);
  visited.current.add(active);

  const showTab = (id) => {
    setTab(id);
    refresh();
  };

  return (
    <>
      <Header tabs={tabs} active={active} onSelect={showTab} />
      <main className="mx-auto max-w-[1100px] p-4">
        {/* Открытые вкладки скрываем, а не удаляем: так сохраняются поиск и фильтры */}
        {tabs.filter((t) => visited.current.has(t.id)).map(({ id, Page }) => (
          <section key={id} hidden={id !== active}>
            <Page />
          </section>
        ))}
      </main>
      <DialogHost />
    </>
  );
}
