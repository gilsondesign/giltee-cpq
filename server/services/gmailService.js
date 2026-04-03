const { google } = require('googleapis')
const { getOAuthClient } = require('./googleAuth')

const TARGET_ACCOUNT = () => process.env.GMAIL_TARGET_ACCOUNT || 'me'

/**
 * Build a base64url-encoded RFC 2822 email with a PDF attachment.
 */
function buildRawEmail({ from, to, subject, body, pdfBuffer, pdfFilename }) {
  const boundary = `boundary_${Date.now()}`
  const pdfBase64 = pdfBuffer.toString('base64')

  const parts = [
    `MIME-Version: 1.0`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    ``,
    pdfBase64,
    ``,
    `--${boundary}--`,
  ].join('\r\n')

  return Buffer.from(parts).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Create a Gmail draft with a PDF attachment.
 * @returns {Promise<string>} The draft ID
 */
async function createDraft({ to, subject, body, pdfBuffer, pdfFilename }) {
  const auth = getOAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  const raw = buildRawEmail({
    from: TARGET_ACCOUNT(),
    to,
    subject,
    body,
    pdfBuffer,
    pdfFilename,
  })

  const response = await gmail.users.drafts.create({
    userId: TARGET_ACCOUNT(),
    requestBody: { message: { raw } },
  })

  return response.data.id
}

/**
 * Get a Gmail draft by ID.
 */
async function getDraft(draftId) {
  const auth = getOAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })
  const response = await gmail.users.drafts.get({
    userId: TARGET_ACCOUNT(),
    id: draftId,
  })
  return response.data
}

/**
 * Delete a Gmail draft by ID.
 */
async function deleteDraft(draftId) {
  const auth = getOAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.drafts.delete({
    userId: TARGET_ACCOUNT(),
    id: draftId,
  })
}

module.exports = { createDraft, getDraft, deleteDraft }
