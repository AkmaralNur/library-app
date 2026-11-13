export default function ReportCard({ title, children }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-2">{title}</h3>
      {children}
    </div>
  );
}
