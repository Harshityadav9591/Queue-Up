export default function Input({ className = '', ...props }) {
  return (
    <input
      type="text"
      className={`bg-neutral-1 text-neutral-3 border-2 border-neutral-2 rounded-md px-4 py-2 focus:outline-none focus:border-primary-1 w-full ${className}`}
      {...props}
    />
  );
}