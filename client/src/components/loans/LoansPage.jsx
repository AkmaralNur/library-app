import { useState } from 'react';
import { api } from '../../api';
import { useLoad } from '../../hooks/useLoad';
import { Select } from '../ui/Inputs';
import { EmptyState, Muted, SectionTitle, Toolbar } from '../ui/Text';
import HoldsTable from './HoldsTable';
import LoansTable from './LoansTable';

const FILTERS = {
  active: { label: 'На руках', match: () => true },
  overdue: { label: 'Просроченные', match: (l) => l.overdue },
  fines: { label: 'С неоплаченным штрафом', match: (l) => l.fine && !l.fine_paid },
  all: { label: 'Все выдачи', match: () => true },
};

export default function LoansPage() {
  const [filter, setFilter] = useState('active');
  const holds = useLoad(() => api.get('/api/holds')) ?? [];
  const all = useLoad(() => api.get(`/api/loans${filter === 'active' ? '?active=1' : ''}`), [filter]);
  const loans = all?.filter(FILTERS[filter].match);

  return (
    <>
      {holds.length > 0 && (
        <>
          <SectionTitle>Ждут выдачи <Muted className="font-normal">— забронированы читателями</Muted></SectionTitle>
          <HoldsTable holds={holds} />
          <SectionTitle>Выдачи</SectionTitle>
        </>
      )}
      <Toolbar>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {Object.entries(FILTERS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Toolbar>
      {loans?.length ? <LoansTable loans={loans} showReader /> : null}
      {loans?.length === 0 && <EmptyState>Выдач нет</EmptyState>}
    </>
  );
}
