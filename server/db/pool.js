if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  throw new Error('DATABASE_URL environment variable is required')
}

const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

pool.on('error', (err) => {
  console.error('Unexpected database error', err)
})

module.exports = pool
