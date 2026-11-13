const SIZES = {
  small: 'h-[70px] w-12 shadow-sm text-lg',
  medium: 'h-32 w-[90px] text-3xl',
  big: 'h-[230px] w-40 shadow-lg text-6xl',
};

// Обложка книги: картинка по ссылке или цветная заглушка с первой буквой названия
export default function Cover({ url, title, size = 'small' }) {
  const className = `shrink-0 rounded object-cover ${SIZES[size]}`;
  if (url) return <img className={`${className} bg-[#eee]`} src={url} alt="" loading="lazy" />;

  const hue = [...title].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className={`${className} inline-flex items-center justify-center font-serif font-bold text-white`}
      style={{ background: `hsl(${hue} 45% 45%)` }}
    >
      {title[0]}
    </span>
  );
}
