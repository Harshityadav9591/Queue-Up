import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

export default function MultiSelect({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = 'Select options...',
  fullWidth = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateViewport);
      return () => mediaQuery.removeEventListener('change', updateViewport);
    }
    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedTrigger = containerRef.current?.contains(event.target);
      const clickedDropdown = dropdownRef.current?.contains(event.target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false);
      }
    };
    const handleKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleToggleOption = (value) => {
    const stringValue = String(value);
    const selectedStrings = selected.map(String);

    let updated;
    if (selectedStrings.includes(stringValue)) {
      updated = selected.filter(v => String(v) !== stringValue);
    } else {
      updated = [...selected, value];
    }
    onChange(updated);
  };

  // Filter options by search term
  const filteredOptions = options.filter(opt =>
    String(opt.label).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Trigger text: the one choice by name, or the group name with a count beside it
  const getTriggerText = () => {
    if (!selected || selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const match = options.find(o => String(o.value) === String(selected[0]));
      return match ? match.label : placeholder;
    }
    return label || 'Selected';
  };

  const selectedStrings = (selected || []).map(String);
  const active = selected.length > 0;
  const dropdown = isOpen ? (
    <div
      ref={dropdownRef}
      className="float fixed inset-x-3 bottom-3 z-50 flex max-h-[70vh] flex-col overflow-hidden sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:mt-2 sm:max-h-96 sm:w-72"
    >
      {options.length > 6 && (
        <div className="p-2 pb-0">
          <input
            type="text"
            autoFocus
            placeholder={`Find a ${(label || 'value').replace(/s$/, '').toLowerCase()}`}
            aria-label={`Filter ${label || 'options'}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field h-10 rounded-[10px] text-[15px]"
          />
        </div>
      )}

      <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[13px] text-muted">
        <span className="num">{selected.length} selected</span>
        {active && (
          <button type="button" onClick={() => onChange([])} className="font-semibold text-ink underline-offset-4 hover:underline">
            Clear
          </button>
        )}
      </div>

      <div role="listbox" aria-multiselectable="true" aria-label={label} className="flex-grow overflow-y-auto p-1.5 scrollbar-hide">
        {filteredOptions.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">Nothing matches “{searchTerm}”.</p>
        ) : (
          filteredOptions.map((opt) => {
            const isChecked = selectedStrings.includes(String(opt.value));
            return (
              <button
                type="button"
                role="option"
                aria-selected={isChecked}
                key={opt.value}
                onClick={() => handleToggleOption(opt.value)}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[15px] transition-colors hover:bg-surface"
              >
                <span className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] transition-colors ${isChecked ? 'bg-ink text-ground' : 'shadow-[inset_0_0_0_1.5px_var(--muted)]'}`}>
                  {isChecked && <Icon name="check" strokeWidth={3} className="h-3 w-3" />}
                </span>
                <span className={`truncate ${isChecked ? 'font-semibold' : ''}`}>{opt.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={fullWidth ? 'relative w-full sm:w-auto sm:flex-none' : 'relative flex-none'}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-active={active}
        className={fullWidth ? 'chip w-full justify-between px-2 sm:w-auto sm:justify-start sm:px-4' : 'chip'}
      >
        <span className="max-w-[160px] truncate">{getTriggerText()}</span>
        {selected.length > 1 && <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-ground px-1.5 text-xs text-ink">{selected.length}</span>}
        <Icon name="chevronDown" className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isMobile ? createPortal(dropdown, document.body) : dropdown}
    </div>
  );
}
