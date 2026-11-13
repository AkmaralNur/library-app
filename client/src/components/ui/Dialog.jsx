import { useEffect, useRef } from 'react';

// Модальное окно на основе <dialog>. Открывается при появлении в разметке;
// onClose срабатывает при нажатии Esc и на кнопку ✕.
export default function Dialog({ wide = false, showClose = false, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current.open) ref.current.showModal();
  }, []);

  const width = wide ? 'w-[min(820px,calc(100%-32px))]' : 'w-[min(440px,calc(100%-32px))]';

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={`m-auto max-h-[calc(100vh-48px)] rounded-xl bg-white p-6 text-ink backdrop:bg-black/35 ${width}`}
    >
      {showClose && (
        <button
          type="button"
          title="Закрыть"
          onClick={onClose}
          className="absolute top-3 right-3 cursor-pointer px-3 py-2 text-lg"
        >
          ✕
        </button>
      )}
      {children}
    </dialog>
  );
}
