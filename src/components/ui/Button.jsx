export default function Button({ variant = 'primary', size, children, className = '', ...props }) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-quiet',
    quiet: 'btn-quiet',
    ghost: 'btn-ghost',
  };
  const sizes = { sm: 'btn-sm', lg: 'btn-lg' };

  return (
    <button className={`btn ${variants[variant] || variants.primary} ${sizes[size] || ''} ${className}`} {...props}>
      {children}
    </button>
  );
}
