import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog-backdrop" onClick={onClose} />
      <div className="dialog-panel relative w-full max-w-md rounded-[20px] bg-float p-7 shadow-[var(--shadow-float)]">
        <h2 className="mb-3 text-xl font-bold">{title}</h2>
        <div className="mb-6 text-muted">{children}</div>
        <button onClick={onClose} className="btn btn-primary w-full">Close</button>
      </div>
    </div>
  );
}
