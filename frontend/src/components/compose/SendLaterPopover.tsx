import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

interface SendLaterPopoverProps {
  initialDate?: Date;
  onSelectTime: (date: Date) => void;
  onCancel: () => void;
}

export const SendLaterPopover: React.FC<SendLaterPopoverProps> = ({
  initialDate,
  onSelectTime,
  onCancel,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialDate || new Date(Date.now() + 60 * 60 * 1000)
  );

  const getPresetDate = (hoursFromNow?: number, specificHour?: number): Date => {
    const d = new Date();
    if (hoursFromNow !== undefined) {
      d.setHours(d.getHours() + hoursFromNow);
    } else if (specificHour !== undefined) {
      d.setDate(d.getDate() + 1);
      d.setHours(specificHour, 0, 0, 0);
    }
    return d;
  };

  const handleApply = () => {
    onSelectTime(selectedDate);
  };

  // Convert Date to datetime-local string
  const formatDateTimeLocal = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  return (
    <div className="absolute right-6 top-16 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 z-50 animate-scale-in">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Send Later</h3>

      {/* Date & Time Input with Calendar Icon */}
      <div className="relative mb-4">
        <input
          type="datetime-local"
          value={formatDateTimeLocal(selectedDate)}
          onChange={(e) => {
            if (e.target.value) {
              setSelectedDate(new Date(e.target.value));
            }
          }}
          className="w-full pl-3 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
        />
        <Calendar className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Preset Options matching Figma exactly */}
      <div className="space-y-1 mb-5">
        <button
          type="button"
          onClick={() => setSelectedDate(getPresetDate(24))}
          className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-md transition-all font-medium"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => setSelectedDate(getPresetDate(undefined, 10))}
          className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-md transition-all font-medium"
        >
          Tomorrow, 10:00 AM
        </button>
        <button
          type="button"
          onClick={() => setSelectedDate(getPresetDate(undefined, 11))}
          className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-md transition-all font-medium"
        >
          Tomorrow, 11:00 AM
        </button>
        <button
          type="button"
          onClick={() => setSelectedDate(getPresetDate(undefined, 15))}
          className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-md transition-all font-medium"
        >
          Tomorrow, 3:00 PM
        </button>
      </div>

      {/* Action Buttons matching Figma */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-800 font-medium px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="text-xs font-semibold px-4 py-1.5 rounded-full border border-[#10B981] bg-white text-[#00A854] hover:bg-emerald-50 active:bg-emerald-100 transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
};

