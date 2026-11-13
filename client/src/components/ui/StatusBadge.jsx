const TONES = {
  neutral: 'border-line',
  in: 'border-ok text-ok',
  out: 'border-danger text-danger',
  hold: 'border-gold bg-[#fff8e8] text-[#9a6a00]',
};

// Статус-метка. Если передан onClick, становится кнопкой
export default function StatusBadge({ tone = 'neutral', onClick, title, children }) {
  const className = `inline-block rounded-full border px-2.5 py-1 text-[13px] ${TONES[tone]}`;
  return onClick
    ? <button type="button" title={title} onClick={onClick} className={`${className} cursor-pointer`}>{children}</button>
    : <span className={className}>{children}</span>;
}
