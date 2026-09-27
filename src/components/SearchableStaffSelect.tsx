import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, User, Check, X, Building2 } from 'lucide-react';
import { StaffMember } from '../types';

interface SearchableStaffSelectProps {
  staffList: StaffMember[];
  selectedEmployeeId?: string;
  selectedStaffId?: string;
  onSelect?: (employeeId: string) => void;
  onSelectStaff?: (staff: StaffMember) => void;
  placeholder?: string;
  label?: string;
  filterExited?: boolean;
}

export const SearchableStaffSelect: React.FC<SearchableStaffSelectProps> = ({
  staffList,
  selectedEmployeeId,
  selectedStaffId,
  onSelect,
  onSelectStaff,
  placeholder = 'Search & select staff member...',
  label,
  filterExited = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Available list
  const availableStaff = staffList.filter((s) => {
    if (filterExited && s.status === 'Exited') return false;
    return true;
  });

  const selectedStaff = staffList.find(
    (s) =>
      (selectedEmployeeId && s.employeeId === selectedEmployeeId) ||
      (selectedStaffId && s.id === selectedStaffId)
  );

  // Filtered list
  const filteredStaff = availableStaff.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.employeeId.toLowerCase().includes(term) ||
      s.department.toLowerCase().includes(term) ||
      s.role.toLowerCase().includes(term)
    );
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1 relative" ref={wrapperRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      {/* Select Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors text-xs"
      >
        {selectedStaff ? (
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-600 dark:text-blue-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
              {selectedStaff.name.charAt(0)}
            </div>
            <div className="truncate flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white mr-1">
                {selectedStaff.name}
              </span>
              {selectedStaff.status === 'Suspended' && (
                <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  (suspended)
                </span>
              )}
              <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                ({selectedStaff.employeeId})
              </span>
              <span className="text-[10px] text-slate-400">
                • {selectedStaff.department}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}

        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden p-2 space-y-2">
          {/* Search Input Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to search name, ID, or dept..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60 pr-1">
            {filteredStaff.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching staff members found
              </div>
            ) : (
              filteredStaff.map((staff, idx) => {
                const isSelected =
                  (selectedEmployeeId && staff.employeeId === selectedEmployeeId) ||
                  (selectedStaffId && staff.id === selectedStaffId);
                return (
                  <div
                    key={`${staff.id}-${idx}`}
                    onClick={() => {
                      onSelect?.(staff.employeeId);
                      onSelectStaff?.(staff);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-xs ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {staff.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{staff.name}</span>
                          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                            [{staff.employeeId}]
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>{staff.department}</span>
                          <span>• {staff.role}</span>
                          {staff.status === 'Suspended' && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">(suspended)</span>
                          )}
                          {staff.status === 'On Leave' && (
                            <span className="text-amber-500 font-semibold">(On Leave)</span>
                          )}
                          {staff.status === 'Exited' && (
                            <span className="text-rose-500 font-semibold">(Exited)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
