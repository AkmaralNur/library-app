import { useState } from 'react';
import { api } from '../../api';
import { useDebounced } from '../../hooks/useDebounced';
import { useLoad } from '../../hooks/useLoad';
import BooksTable from './BooksTable';
import CatalogToolbar from './CatalogToolbar';

export default function CatalogPage() {
  const [filters, setFilters] = useState({ q: '', genre: '', sort: 'title', availableOnly: false });
  const q = useDebounced(filters.q);

  const books = useLoad(() => {
    const params = new URLSearchParams({
      q,
      genre: filters.genre,
      sort: filters.sort,
      available: filters.availableOnly ? '1' : '',
    });
    return api.get(`/api/books?${params}`);
  }, [q, filters.genre, filters.sort, filters.availableOnly]);

  return (
    <>
      <CatalogToolbar filters={filters} onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))} />
      <BooksTable books={books} />
    </>
  );
}
