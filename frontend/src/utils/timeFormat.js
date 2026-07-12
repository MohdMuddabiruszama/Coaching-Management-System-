/**
 * format12Hour
 * Converts a 24-hour time string (e.g., "21:51:33" or "14:30") 
 * into a 12-hour format string with AM/PM (e.g., "09:51 PM").
 */
export const format12Hour = (timeStr) => {
    if (!timeStr) return "—";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr; // fallback if it's not a standard time string

    let h = parseInt(parts[0], 10);
    const m = parts[1];
    
    // Validate parsing
    if (isNaN(h)) return timeStr;

    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    
    
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
};
