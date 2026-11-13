import { useState } from 'react';

// Выбор оценки звёздами от 1 до 5; при наведении подсвечивается будущая оценка
export default function RatingInput({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div className="inline-flex" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Оценка ${n} из 5`}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          className={`cursor-pointer px-0.5 text-[26px] leading-none ${n <= shown ? 'text-gold' : 'text-[#d8d2ca]'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
