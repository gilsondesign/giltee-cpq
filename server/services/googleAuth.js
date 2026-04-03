const { google } = require('googleapis')

/**
 * Creates an authenticated Google OAuth2 client using env credentials.
 * Used by both gmailService and driveService.
 */
function getOAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return auth
}

module.exports = { getOAuthClient }
