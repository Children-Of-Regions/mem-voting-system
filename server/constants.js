// Server Constants

// Email processing
const EMAIL_BATCH_SIZE = 50
const EMAIL_RATE_LIMIT_MS = 500 // Delay between emails

// Server
const DEFAULT_PORT = 3000
const HOURLY_CHECK_INTERVAL = 3600000 // 1 hour in milliseconds (for emails)
const VOTING_CLOSE_CHECK_INTERVAL = 60000 // 1 minute in milliseconds (for auto-close voting)
const STARTUP_DELAY = 2000 // 2 seconds

module.exports = {
    EMAIL_BATCH_SIZE,
    EMAIL_RATE_LIMIT_MS,
    DEFAULT_PORT,
    HOURLY_CHECK_INTERVAL,
    VOTING_CLOSE_CHECK_INTERVAL,
    STARTUP_DELAY
}
