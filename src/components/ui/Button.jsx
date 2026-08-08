export default function Button({ variant = 'primary', children, className = '', ...props }) {
  const baseClasses = "px-4 py-2 rounded-md transition duration-300 button-effect font-medium";
  
  const variants = {
    primary: "bg-primary-1 hover:bg-primary-2 text-white",
    secondary: "text-primary-1 border-2 border-primary-1 hover:border-primary-2 hover:text-primary-2"
  };

  return (
    <button className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}