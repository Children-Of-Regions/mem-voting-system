import { supabase } from '../lib/supabase'

/**
 * Admin login using Supabase Auth
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, error?: string, user?: object}>}
 */
export async function loginAdmin(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) {
            return { success: false, error: 'Սխալ էլ․ փոստ կամ գաղտնաբառ' }
        }

        return { success: true, user: data.user }
    } catch (error) {
        console.error('Login error:', error)
        return { success: false, error: 'Սերվերի սխալ' }
    }
}

/**
 * Check if admin is logged in
 * @returns {Promise<object|null>} User session or null
 */
export async function getAdminSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user || null
}

/**
 * Logout admin
 */
export async function logoutAdmin() {
    await supabase.auth.signOut()
}

/**
 * Request password reset email
 * @param {string} email 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function requestPasswordReset(email) {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/admin/reset-password`,
        })

        if (error) {
            return { success: false, error: 'Սխալ էլ․ փոստ' }
        }

        return { success: true }
    } catch (error) {
        console.error('Password reset request error:', error)
        return { success: false, error: 'Սերվերի սխալ' }
    }
}

/**
 * Update user password
 * @param {string} newPassword 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updatePassword(newPassword) {
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        })

        if (error) {
            return { success: false, error: 'Գաղտնաբառի թարմացման սխալ' }
        }

        return { success: true }
    } catch (error) {
        console.error('Password update error:', error)
        return { success: false, error: 'Սերվերի սխալ' }
    }
}
