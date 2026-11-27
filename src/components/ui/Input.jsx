export default function Input({ className = '', ...props }) {
  return <input type="text" className={`field ${className}`} {...props} />;
}
