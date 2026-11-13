import { useEffect, useRef } from 'react';

// popover выводит уведомление поверх открытых модальных окон
export default function Toast({ text, isError }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current.matches(':popover-open')) ref.current.showPopover();
  }, []);

  return (
    <div
      ref={ref}
      popover="manual"
      role="status"
      className={`inset-auto bottom-6 left-1/2 m-0 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-[10px] border-none px-5 py-3 text-white shadow-lg ${isError ? 'bg-danger' : 'bg-ink'}`}
    >
      {text}
    </div>
  );
}
