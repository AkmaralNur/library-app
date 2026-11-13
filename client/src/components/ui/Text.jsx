// Небольшие текстовые элементы, которые повторяются по всему приложению

export function Muted({ children, className = '' }) {
  return <small className={`text-muted ${className}`}>{children}</small>;
}

export function SectionTitle({ children }) {
  return <h2 className="mt-6 mb-3 text-xl">{children}</h2>;
}

export function DialogSubtitle({ children }) {
  return <h3 className="mt-5 mb-2">{children}</h3>;
}

export function EmptyNote({ children }) {
  return <p className="text-muted">{children}</p>;
}

export function EmptyState({ children }) {
  return <p className="p-6 text-center text-muted">{children}</p>;
}

export function Toolbar({ children }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

// Ссылка-кнопка: выглядит как текст, действие выполняется по клику
export function TextLink({ className = '', ...props }) {
  return (
    <button
      type="button"
      className={`cursor-pointer text-left font-semibold hover:text-accent hover:underline ${className}`}
      {...props}
    />
  );
}
