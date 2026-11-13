import { api } from '../../api';
import { useDialogs } from '../../context/DialogContext';
import { useSession } from '../../context/SessionContext';
import { useLoad } from '../../hooks/useLoad';
import Button, { buttonClass } from '../ui/Button';
import { Input, Select } from '../ui/Inputs';
import { Toolbar } from '../ui/Text';

const SORTS = [
  ['title', 'По названию'],
  ['author', 'По автору'],
  ['year', 'Сначала новые'],
  ['rating', 'По рейтингу'],
  ['popular', 'Популярные'],
];

export default function CatalogToolbar({ filters, onChange }) {
  const { isLibrarian } = useSession();
  const { open } = useDialogs();
  const genres = useLoad(() => api.get('/api/genres')) ?? [];

  return (
    <Toolbar>
      <Input
        type="search"
        placeholder="Поиск по названию или автору…"
        className="min-w-[200px] flex-1"
        value={filters.q}
        onChange={(e) => onChange({ q: e.target.value })}
      />
      <Select value={filters.genre} onChange={(e) => onChange({ genre: e.target.value })}>
        <option value="">Все жанры</option>
        {genres.map((g) => <option key={g}>{g}</option>)}
      </Select>
      <Select title="Сортировка" value={filters.sort} onChange={(e) => onChange({ sort: e.target.value })}>
        {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      <label className="flex items-center gap-1.5 whitespace-nowrap text-muted">
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(e) => onChange({ availableOnly: e.target.checked })}
        />
        Только в наличии
      </label>
      <span className="flex-1" />
      {isLibrarian && (
        <>
          <a className={buttonClass()} href="/api/export/books.csv">⬇ CSV</a>
          <Button variant="primary" onClick={() => open('bookForm', { id: null })}>+ Добавить книгу</Button>
        </>
      )}
    </Toolbar>
  );
}
