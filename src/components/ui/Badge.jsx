export default function Badge({ children, className = '' }) {
  return (
    <div className={`bg-primary-1 text-white px-2 py-1 rounded-md text-xs inline-block font-semibold ${className}`}>
      {children}
    </div>
  );
}