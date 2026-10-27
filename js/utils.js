// Utility functions for Logitech Inventory Reconciliation System

const Utils = {
    /**
     * Normalize header string for comparison
     * Lowercase, remove accents, normalize punctuation
     */
    normalizeHeader(header) {
        if (header === null || header === undefined) return '';
        return String(header)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]+/g, ' ')     // Replace non-alphanumeric with space
            .trim();
    },

    /**
     * Clean and normalize EAN/code keys
     * Preserve as string to keep leading zeros
     */
    cleanKey(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number' && isNaN(value)) return '';
        let s = String(value).trim().replace(/'/g, '');
        // Remove .0 from numbers
        if (/^\d+\.0$/.test(s)) {
            s = s.slice(0, -2);
        }
        // Remove spaces
        s = s.replace(/\s+/g, '');
        return s.toUpperCase();
    },

    /**
     * Parse number (handle French decimals)
     */
    parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return isNaN(value) ? null : value;
        let s = String(value).trim().replace(/\s/g, '');
        // Handle French decimal comma
        s = s.replace(',', '.');
        // Remove currency symbols
        s = s.replace(/[€$£]/g, '');
        const num = parseFloat(s);
        return isNaN(num) ? null : num;
    },

    /**
     * Check if string looks like EAN (8-14 digits)
     */
    isValidEAN(ean) {
        if (!ean) return false;
        const cleaned = this.cleanKey(ean).replace(/\D/g, '');
        return cleaned.length >= 8 && cleaned.length <= 14;
    },

    /**
     * Extract EAN from text like "[5099206004023] Product Name"
     */
    extractEANFromText(text) {
        if (!text) return '';
        const match = String(text).match(/\[\s*(\d{8,14})\s*\]/);
        if (match) return match[1];
        // Try to find standalone long digit string
        const digitMatch = String(text).match(/\b(\d{8,14})\b/);
        if (digitMatch && this.isValidEAN(digitMatch[1])) {
            return digitMatch[1];
        }
        return '';
    },

    /**
     * Remove EAN from product name
     */
    removeEANFromName(text) {
        if (!text) return '';
        return String(text)
            .replace(/\[\s*\d{8,14}\s*\]/g, '')
            .replace(/\b\d{8,14}\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * Format date for filename
     */
    getTimestamp() {
        const now = new Date();
        return now.getFullYear().toString() +
               String(now.getMonth() + 1).padStart(2, '0') +
               String(now.getDate()).padStart(2, '0') + '_' +
               String(now.getHours()).padStart(2, '0') +
               String(now.getMinutes()).padStart(2, '0') +
               String(now.getSeconds()).padStart(2, '0');
    },

    /**
     * Deep clone object
     */
    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Make available globally
window.Utils = Utils;
