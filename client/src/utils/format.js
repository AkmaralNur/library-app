export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '');
export const money = (n) => `${Number(n).toLocaleString('ru-RU')} сом`;
export const isOverdue = (iso) => Boolean(iso) && new Date(iso) < new Date();
