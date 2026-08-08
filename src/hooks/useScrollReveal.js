import { useEffect } from 'react';

export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
        }
      });
    });
    
    const targets = document.querySelectorAll('.reveal');
    targets.forEach(target => observer.observe(target));
    
    return () => {
      targets.forEach(target => observer.unobserve(target));
    };
  }, []);
}