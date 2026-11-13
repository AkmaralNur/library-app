import Stats from './Stats';
import Tabs from './Tabs';
import UserBox from './UserBox';

export default function Header({ tabs, active, onSelect }) {
  return (
    <header className="mx-auto max-w-[1100px] px-4 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[2rem]">📚 Библиотека</h1>
        <UserBox />
      </div>
      <Stats />
      <Tabs tabs={tabs} active={active} onSelect={onSelect} />
    </header>
  );
}
