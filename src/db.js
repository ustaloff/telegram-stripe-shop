import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool from DATABASE_URL environment variable
// mysql2 accepts connection string directly
const pool = mysql.createPool(process.env.DATABASE_URL);

export { pool };
