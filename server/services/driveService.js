const { google } = require('googleapis')
const { Readable } = require('stream')
const { getOAuthClient } = require('./googleAuth')

/**
 * Upload a PDF buffer to Google Drive in the configured folder.
 * @param {Buffer} pdfBuffer
 * @param {string} filename
 * @returns {Promise<{ fileId: string, url: string }>}
 */
async function uploadPDF(pdfBuffer, filename) {
  const auth = getOAuthClient()
  const drive = google.drive({ version: 'v3', auth })

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: process.env.GOOGLE_DRIVE_FOLDER_ID
        ? [process.env.GOOGLE_DRIVE_FOLDER_ID]
        : [],
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(pdfBuffer),
    },
    fields: 'id, webViewLink',
  })

  return {
    fileId: response.data.id,
    url: response.data.webViewLink,
  }
}

module.exports = { uploadPDF }
