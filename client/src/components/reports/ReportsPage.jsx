import { api } from '../../api';
import { useLoad } from '../../hooks/useLoad';
import { Muted } from '../ui/Text';
import BarChart from './BarChart';
import ReportCard from './ReportCard';
import ReportTiles from './ReportTiles';

const monthLabel = (i) =>
  new Date(`${i.month}-01`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

export default function ReportsPage() {
  const report = useLoad(() => api.get('/api/reports'));
  if (!report) return null;

  return (
    <>
      <ReportTiles totals={report.totals} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
        <ReportCard title="Популярные книги">
          <BarChart items={report.topBooks} label={(i) => <>{i.title} <Muted>{i.author}</Muted></>} />
        </ReportCard>
        <ReportCard title="Активные читатели">
          <BarChart items={report.topReaders} label={(i) => i.name} />
        </ReportCard>
        <ReportCard title="Книги по жанрам">
          <BarChart items={report.genres} label={(i) => i.genre} />
        </ReportCard>
        <ReportCard title="Выдачи по месяцам">
          <BarChart items={report.byMonth} label={monthLabel} />
        </ReportCard>
      </div>
    </>
  );
}
