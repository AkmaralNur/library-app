export function Table({ head, children }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-xl bg-white shadow-sm max-md:block max-md:overflow-x-auto">
      <thead>
        <tr>{head}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Th({ className = '', children }) {
  return (
    <th className={`border-b border-line bg-[#faf8f5] px-3 py-2.5 text-left text-[13px] font-semibold text-muted ${className}`}>
      {children}
    </th>
  );
}

export function Tr({ highlight = false, children }) {
  return (
    <tr className={`last:[&>td]:border-b-0 ${highlight ? '[&>td]:bg-[#fdf1f0]' : ''}`}>
      {children}
    </tr>
  );
}

export function Td({ className = '', children, ...props }) {
  return (
    <td className={`border-b border-line px-3 py-2.5 text-left align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}

// Ячейка с кнопками действий, прижатыми к правому краю
export function ActionsTd({ children }) {
  return <Td className="space-x-1 text-right whitespace-nowrap">{children}</Td>;
}
