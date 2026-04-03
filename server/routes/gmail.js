const express = require('express')
const gmailService = require('../services/gmailService')

const router = express.Router()

// GET /api/gmail/draft/:id — retrieve a draft (for preview)
router.get('/draft/:id', async (req, res, next) => {
  try {
    const draft = await gmailService.getDraft(req.params.id)
    res.json(draft)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/gmail/draft/:id — discard a draft
router.delete('/draft/:id', async (req, res, next) => {
  try {
    await gmailService.deleteDraft(req.params.id)
    res.json({ message: 'Draft deleted' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
