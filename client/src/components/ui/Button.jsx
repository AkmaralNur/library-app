const VARIANTS = {
  default: 'rounded-lg border border-line bg-white hover:border-accent',
  primary: 'rounded-lg border border-accent bg-accent text-white',
  icon: 'rounded-lg border-none bg-transparent',
  link: 'border-none bg-transparent text-[13px] text-muted underline',
};

const SIZES = {
  md: 'px-3 py-2',
  sm: 'px-2 py-1 text-[13px]',
  link: 'px-1',
};

export function buttonClass({ variant = 'default', size = 'md', className = '' } = {}) {
  return `inline-block cursor-pointer disabled:cursor-default disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export default function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
