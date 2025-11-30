/**
 * Generate cryptographically secure unique voting codes
 * @param {number} count - Number of codes to generate
 * @param {number} length - Length of each code (default: 12)
 * @returns {string[]} Array of unique codes
 */
export function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars (I, 1, O, 0)
    let code = ''
    for (let i = 0; i < 6; i++) {
        if (i === 3) code += '-'
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

export function generateUniqueCodes(count, existingCodes = new Set()) {
    const codes = new Set()
    while (codes.size < count) {
        const code = generateCode()
        if (!existingCodes.has(code)) {
            codes.add(code)
        }
    }

    return Array.from(codes)
}

/**
 * Validate code format
 * @param {string} code - Code to validate
 * @returns {boolean} True if valid format
 */
export function isValidCodeFormat(code) {
    // Format: XXX-XXX (6 characters + 1 dash)
    const regex = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/
    return regex.test(code)
}
