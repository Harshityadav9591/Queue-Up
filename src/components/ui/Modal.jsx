export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-primary-1/80 flex justify-center items-center z-50 fade-in px-4" aria-modal="true">
      <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full relative">
        <h2 className="text-2xl font-bold mb-4 text-primary-1">{title}</h2>
        <div className="mb-6 text-primary-2">
          {children}
        </div>
        <button 
          onClick={onClose} 
          className="bg-primary-1 hover:bg-primary-2 transition text-white px-4 py-2 rounded-md w-full font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}