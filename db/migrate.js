import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const files = fs.readdirSync('./db/migrations').sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join('./db/migrations', file), 'utf-8');
  console.log('Running', file);
  await connection.query(sql);
}

await connection.end();
console.log('Migrations applied');
