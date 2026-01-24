import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './input';
import { cn } from '../../lib/utils';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';

/**
 * SearchableSelect - A type-to-search dropdown component
 * Supports async search via API endpoint
 */
export const SearchableSelect = ({
  value,
  onChange,
  placeholder = "Search...",
  searchEndpoint,
  displayField = "name",
  valueField = "id",
  secondaryField = null,
  disabled = false,
  className = "",
  minSearchLength = 0,
  debounceMs = 300,
  // Static options (optional - if provided, no API call)
  options = null,
  // Custom render for items
  renderItem = null,
  // Additional query params
  queryParams = {},
  // Allow clearing
  clearable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Build auth header
  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch items from API
  const fetchItems = useCallback(async (query) => {
    if (options) {
      // Filter static options
      const filtered = options.filter(opt => 
        String(opt[displayField] || '').toLowerCase().includes(query.toLowerCase())
      );
      setItems(filtered);
      return;
    }

    if (!searchEndpoint) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, ...queryParams });
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${searchEndpoint}?${params}`,
        { headers: getAuthHeader() }
      );
      const data = await response.json();
      setItems(data.items || data.locations || data.formulas || data.lots || data.categories || []);
    } catch (error) {
      console.error('Search error:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchEndpoint, options, displayField, queryParams]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchTerm.length >= minSearchLength || isOpen) {
      debounceRef.current = setTimeout(() => {
        fetchItems(searchTerm);
      }, debounceMs);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, fetchItems, minSearchLength, debounceMs, isOpen]);

  // Load initial value
  useEffect(() => {
    if (value && !selectedItem) {
      // Try to find in current items
      const found = items.find(item => item[valueField] === value);
      if (found) {
        setSelectedItem(found);
      }
    }
  }, [value, items, valueField, selectedItem]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    setSelectedItem(item);
    onChange(item[valueField], item);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedItem(null);
    onChange(null, null);
    setSearchTerm('');
  };

  const displayValue = selectedItem 
    ? (selectedItem[displayField] || selectedItem[valueField])
    : '';

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2 border rounded-md px-3 py-2 bg-white cursor-pointer transition-colors",
          isOpen && "ring-2 ring-blue-500 border-blue-500",
          disabled && "bg-gray-100 cursor-not-allowed opacity-60"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        data-testid="searchable-select-trigger"
      >
        <Search className="w-4 h-4 text-gray-400" />
        {isOpen ? (
          <Input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="flex-1 border-0 p-0 h-auto focus:ring-0 focus-visible:ring-0"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            data-testid="searchable-select-input"
          />
        ) : (
          <span className={cn("flex-1 text-sm", !displayValue && "text-gray-400")}>
            {displayValue || placeholder}
          </span>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        {clearable && selectedItem && !isOpen && (
          <button
            onClick={handleClear}
            className="p-0.5 hover:bg-gray-100 rounded"
            data-testid="searchable-select-clear"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
          data-testid="searchable-select-dropdown"
        >
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {searchTerm ? 'No results found' : 'Start typing to search'}
            </div>
          ) : (
            items.map((item, index) => (
              <div
                key={item[valueField] || index}
                className={cn(
                  "px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors",
                  selectedItem && selectedItem[valueField] === item[valueField] && "bg-blue-100"
                )}
                onClick={() => handleSelect(item)}
                data-testid={`searchable-select-option-${index}`}
              >
                {renderItem ? renderItem(item) : (
                  <div>
                    <div className="text-sm font-medium">{item[displayField]}</div>
                    {secondaryField && item[secondaryField] && (
                      <div className="text-xs text-gray-500">{item[secondaryField]}</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
