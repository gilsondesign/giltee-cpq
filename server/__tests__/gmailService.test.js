jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

// Mock googleapis
jest.mock('googleapis', () => {
  const mockDraftsCreate = jest.fn().mockResolvedValue({ data: { id: 'draft-abc-123' } })
  const mockDraftsGet = jest.fn().mockResolvedValue({ data: { id: 'draft-abc-123', message: { snippet: 'test' } } })
  const mockDraftsDelete = jest.fn().mockResolvedValue({})
  const mockFilesCreate = jest.fn().mockResolvedValue({ data: { id: 'file-xyz', webViewLink: 'https://drive.google.com/file/xyz' } })

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn()
        }))
      },
      gmail: jest.fn().mockReturnValue({
        users: {
          drafts: {
            create: mockDraftsCreate,
            get: mockDraftsGet,
            delete: mockDraftsDelete,
          }
        }
      }),
      drive: jest.fn().mockReturnValue({
        files: { create: mockFilesCreate }
      })
    }
  }
})

const gmailService = require('../services/gmailService')
const driveService = require('../services/driveService')

describe('gmailService.createDraft', () => {
  it('calls gmail drafts.create and returns draft ID', async () => {
    const draftId = await gmailService.createDraft({
      to: 'customer@example.com',
      subject: 'Quote — Test Order',
      body: 'Hi Test,\n\nHere is your quote.',
      pdfBuffer: Buffer.from('fake pdf'),
      pdfFilename: 'GL-00001-Test-Quote.pdf',
    })
    expect(draftId).toBe('draft-abc-123')
  })
})

describe('gmailService.getDraft', () => {
  it('returns draft data by ID', async () => {
    const draft = await gmailService.getDraft('draft-abc-123')
    expect(draft).toHaveProperty('id', 'draft-abc-123')
  })
})

describe('gmailService.deleteDraft', () => {
  it('calls gmail drafts.delete', async () => {
    await expect(gmailService.deleteDraft('draft-abc-123')).resolves.not.toThrow()
  })
})

describe('driveService.uploadPDF', () => {
  it('uploads a PDF and returns fileId and url', async () => {
    const result = await driveService.uploadPDF(Buffer.from('fake pdf'), 'GL-00001-Test.pdf')
    expect(result.fileId).toBe('file-xyz')
    expect(result.url).toContain('drive.google.com')
  })
})
