export default function Stars({ rating }) {
  if (!rating) return <span className="text-muted">—</span>;
  const full = Math.round(rating);
  return (
    <span className="tracking-[1px] text-gold" title={`${rating} из 5`}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
    </span>
  );
}
