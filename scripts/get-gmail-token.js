/**
 * One-time script to generate a Gmail/Drive refresh token for custom@giltee.com.
 *
 * Usage:
 *   node scripts/get-gmail-token.js
 *
 * Prerequisites:
 *   - GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be in .env
 *   - http://localhost:3333/oauth2callback must be added as an authorized
 *     redirect URI in your Google Cloud Console OAuth app.
 */

require('dotenv').config()
const { google } = require('googleapis')
const http = require('http')
const url = require('url')

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3333/oauth2callback'

if (!CLIENT_ID || CLIENT_ID.startsWith('your_')) {
  console.error('ERROR: GOOGLE_OAUTH_CLIENT_ID is not set in .env')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/drive.file',
]

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',   // force refresh_token to be returned every time
  scope: SCOPES,
  login_hint: process.env.GMAIL_TARGET_ACCOUNT || 'custom@giltee.com',
})

console.log('\n─────────────────────────────────────────────────────────')
console.log('  Gmail Token Generator')
console.log('─────────────────────────────────────────────────────────')
console.log('\n1. Open this URL in your browser and sign in as custom@giltee.com:\n')
console.log('  ', authUrl)
console.log('\n2. After authorizing, you will be redirected to localhost.')
console.log('   This script will automatically capture the token.\n')
console.log('─────────────────────────────────────────────────────────\n')

// Temporary local server to capture the OAuth callback
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true)
  if (parsed.pathname !== '/oauth2callback') {
    res.end('Not found')
    return
  }

  const code = parsed.query.code
  if (!code) {
    res.writeHead(400)
    res.end('No authorization code found in callback.')
    server.close()
    return
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`
      <html><body style="font-family:sans-serif;padding:2rem">
        <h2 style="color:#104F42">✓ Token generated successfully</h2>
        <p>You can close this tab and return to your terminal.</p>
      </body></html>
    `)
    server.close()

    console.log('─────────────────────────────────────────────────────────')
    console.log('  SUCCESS — add these values to your .env file:')
    console.log('─────────────────────────────────────────────────────────\n')
    console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`)
    console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`)
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('\n─────────────────────────────────────────────────────────')

    if (!tokens.refresh_token) {
      console.log('\n⚠  No refresh_token returned.')
      console.log('   This usually means the app was already authorized.')
      console.log('   Go to https://myaccount.google.com/permissions, revoke')
      console.log('   access for this app, then run this script again.\n')
    }
  } catch (err) {
    res.writeHead(500)
    res.end('Token exchange failed: ' + err.message)
    server.close()
    console.error('Token exchange failed:', err.message)
  }
})

server.listen(3333, () => {
  console.log('Waiting for Google to redirect to localhost:3333...\n')
})
