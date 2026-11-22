const fs = require('fs');
const path = require('path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: true
  }
});

const adapter = new PrismaPg(pool);
const prisma = {
  user: {
    findUnique: async (where) => {
      const id = where.id;
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    },
    create: async (data) => {
      const input = data.data || data; // Unwrap Prisma's automatic wrapping
      const userId = Number(input.id) || Math.floor(Date.now() / 1000);
      const result = await pool.query(
        'INSERT INTO users (id, name, email, password, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
        [userId, input.name, input.email, input.password, input.role]
      );
      return result.rows[0];
    },
  }
};

module.exports = prisma;
