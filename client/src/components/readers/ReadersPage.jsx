import { useState } from 'react';
import { api } from '../../api';
import { useDialogs } from '../../context/DialogContext';
import { useLoad } from '../../hooks/useLoad';
import Button from '../ui/Button';
import { Input } from '../ui/Inputs';
import { Toolbar } from '../ui/Text';
import ReadersTable from './ReadersTable';

export default function ReadersPage() {
  const { open } = useDialogs();
  const [search, setSearch] = useState('');
  const readers = useLoad(() => api.get('/api/readers'));

  const q = search.toLowerCase();
  const found = readers?.filter((r) => `${r.name} ${r.username}`.toLowerCase().includes(q));

  return (
    <>
      <Toolbar>
        <Input
          type="search"
          placeholder="Поиск читателя…"
          className="min-w-[200px] flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={() => open('newReader')}>+ Новый читатель</Button>
      </Toolbar>
      <ReadersTable readers={found} />
    </>
  );
}
