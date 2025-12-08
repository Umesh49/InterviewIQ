import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Custom dropdown with Lucide icon support
 */
const IconSelect = ({ value, onChange, options, placeholder = 'Select...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    const selected = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-left hover:border-zinc-700 transition-colors"
            >
                <span className="flex items-center gap-2">
                    {selected?.icon && <selected.icon size={16} className="text-zinc-400" />}
                    <span className={selected ? 'text-white' : 'text-zinc-500'}>
                        {selected?.label || placeholder}
                    </span>
                </span>
                <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 py-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors ${value === opt.value ? 'bg-zinc-800 text-white' : 'text-zinc-300'
                                }`}
                        >
                            {opt.icon && <opt.icon size={16} className="text-zinc-400" />}
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IconSelect;
