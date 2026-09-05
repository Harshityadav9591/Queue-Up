import { useState, useRef, useEffect } from 'react';

export default function MultiSelect({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = 'Select options...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleClear = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  // Filter options by search term
  const filteredOptions = options.filter(opt =>
    String(opt.label).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Determine button trigger text
  const getTriggerText = () => {
    if (!selected || selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const match = options.find(o => String(o.value) === String(selected[0]));
      return match ? match.label : placeholder;
    }
    return `${label || 'Selected'} (${selected.length})`;
  };

  const selectedStrings = (selected || []).map(String);

  return (
    <div ref={containerRef} className="relative inline-block text-left w-full sm:w-auto min-w-[160px]">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] transition-colors"
      >
        <span className="truncate">{getTriggerText()}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {selected && selected.length > 0 && (
            <span
              onClick={handleClear}
              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 font-bold p-0.5 rounded transition-colors"
              title="Clear selection"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-80 transition-all duration-200">
          {/* Search box if options > 6 */}
          {options.length > 6 && (
            <div className="p-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff]"
              />
            </div>
          )}

          {/* Quick Header Actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
            <span>{selected.length} selected</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-blue-600 dark:text-[#00f0ff] hover:underline font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 flex-grow max-h-56">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">No results found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedStrings.includes(String(opt.value));
                return (
                  <label
                    key={opt.value}
                    onClick={() => handleToggleOption(opt.value)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-blue-50 dark:bg-[#00f0ff]/10 text-blue-600 dark:text-[#00f0ff] font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by label onClick
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 dark:text-[#00f0ff] focus:ring-0 cursor-pointer"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
