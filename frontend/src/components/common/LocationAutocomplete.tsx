import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onSelect: (address: string, lat: number, lon: number) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search for a location...',
  className = 'input-base',
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isSelectionRef = useRef(false);

  useEffect(() => {
    if (value !== query && !isSelectionRef.current) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (!query || query.length < 3) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1&limit=5`,
          {
            headers: {
              'User-Agent': 'FoodRescuePlatform/1.0',
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Failed to fetch locations:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (!isSelectionRef.current) {
        search();
      }
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [query, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isSelectionRef.current = false;
    setQuery(e.target.value);
    onChange(e.target.value);
  };

  const handleSelect = (item: NominatimResult) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const address = item.display_name;
    
    isSelectionRef.current = true;
    setQuery(address);
    setIsOpen(false);
    onSelect(address, lat, lon);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query || ''}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`${className} pr-10`}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
          {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((item) => (
            <li
              key={item.place_id}
              onClick={() => handleSelect(item)}
              className="flex items-start gap-2 p-3 hover:bg-[var(--bg-panel-hover)] cursor-pointer border-b border-[var(--border-hair)] last:border-0 transition-colors"
            >
              <MapPin size={16} className="text-[var(--brand)] mt-0.5 shrink-0" />
              <span className="text-sm text-[var(--text-primary)] leading-tight">
                {item.display_name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
