const control = 'rounded-lg border border-line bg-white px-3 py-2 text-ink';

export function Input({ className = '', ...props }) {
  return <input className={`${control} ${className}`} {...props} />;
}

export function Select({ className = '', ...props }) {
  return <select className={`${control} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${control} w-full resize-y ${className}`} {...props} />;
}

// Подпись над полем формы
export function Field({ label, children }) {
  return (
    <label className="mb-3 block flex-1 text-sm text-muted">
      {label}
      <span className="mt-1 block [&>*]:w-full">{children}</span>
    </label>
  );
}
