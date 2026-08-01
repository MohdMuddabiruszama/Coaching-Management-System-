/**
 * Format Utilities (Backend — CommonJS)
 * Shared formatting functions for export and display.
 */

/**
 * Format amount as Indian Rupee currency string: ₹1,23,456.78
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(parseFloat(amount));
}

/**
 * Format date string as: 30 Jul 2026
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

module.exports = { formatCurrency, formatDate };
