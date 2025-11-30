// API Service for server communication
// Development: http://localhost:3000
// Production: https://vote.mem.team/api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://localhost:${import.meta.env.SERVER_PORT || 3000}`

export const api = {
    async triggerEmailProcess() {
        try {
            const response = await fetch(`${API_BASE_URL}/trigger-process`, {
                method: 'POST'
            })
            return await response.json()
        } catch (error) {
            console.error('Failed to trigger email process:', error)
            throw error
        }
    },

    async checkHealth() {
        try {
            const response = await fetch(`${API_BASE_URL}/health`)
            return await response.json()
        } catch (error) {
            console.error('Failed to check server health:', error)
            throw error
        }
    }
}
