"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function MultiSelect({ options, selected, onChange, placeholder = "Seleccionar...", className, style }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  // Cuando está vacío, asume que están seleccionados "Todos"
  const displayText = selected.length === 0 
    ? "Todos" 
    : selected.length === 1 
      ? selected[0] 
      : `${selected.length} seleccionados`;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }} className={className}>
      <button 
        type="button"
        onClick={() => setOpen(!open)}
        className="select-filter"
        style={{ 
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          textAlign: 'left', background: '#fff', border: '1px solid var(--color-border)', 
          borderRadius: '8px', padding: '8px 12px', fontSize: '14px', cursor: 'pointer',
          outline: 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selected.length > 0 ? 700 : 500, color: selected.length > 0 ? 'var(--color-primary)' : 'inherit' }}>
          {displayText}
        </span>
        <ChevronDown size={16} color="var(--color-text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />
      </button>
      
      {open && (
        <div style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', 
          background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '250px', overflowY: 'auto' 
        }}>
          <div 
            onClick={() => { onChange([]); setOpen(false); }}
            style={{ 
              padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', 
              borderBottom: '1px solid var(--color-border)', background: selected.length === 0 ? 'rgba(0,0,0,0.02)' : 'transparent' 
            }}
          >
            <div style={{ 
              width: 16, height: 16, border: '1px solid var(--color-border)', borderRadius: 4, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              background: selected.length === 0 ? 'var(--color-primary)' : 'transparent',
              borderColor: selected.length === 0 ? 'var(--color-primary)' : 'var(--color-border)'
            }}>
              {selected.length === 0 && <Check size={12} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: '13px', fontWeight: selected.length === 0 ? 700 : 500, color: selected.length === 0 ? 'var(--color-primary)' : 'inherit' }}>
              Todos
            </span>
          </div>
          
          {options.filter(o => o !== 'Todos').map(opt => {
            const isSelected = selected.includes(opt);
            return (
              <div 
                key={opt}
                onClick={() => toggleOption(opt)}
                style={{ 
                  padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                  background: isSelected ? 'rgba(0,0,0,0.02)' : 'transparent'
                }}
              >
                <div style={{ 
                  width: 16, height: 16, border: '1px solid var(--color-border)', borderRadius: 4, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)'
                }}>
                  {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>
                <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'inherit' }}>
                  {opt}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
