import { useState } from 'react';

// A person's picture, or their initial on a tint of their own (the hue comes from the name, so it stays the same)
export default function Avatar({ url, name = '', size = 'h-10 w-10 text-base', className = '' }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').replace('@', '').charAt(0).toUpperCase();
  const hue = [...(name || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);

  if (url && !broken) {
    return <img src={url} alt="" onError={() => setBroken(true)} className={`flex-none rounded-full bg-surface object-cover ${size} ${className}`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`avatar-tint grid flex-none place-items-center rounded-full font-bold ${size} ${className}`}
      style={{ '--h': hue }}
    >
      {initial}
    </span>
  );
}
