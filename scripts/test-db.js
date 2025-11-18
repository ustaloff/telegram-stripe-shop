#!/usr/bin/env node
import dotenv from 'dotenv';
import { pool } from '../src/db.js';

dotenv.config();

console.log('🔍 Проверка подключения к базе данных...\n');

try {
  const connection = await pool.getConnection();
  console.log('✅ Подключение к MySQL успешно');
  
  // Проверка таблиц
  const [tables] = await connection.query('SHOW TABLES');
  console.log('\n📋 Таблицы в базе данных:');
  tables.forEach(row => {
    const tableName = Object.values(row)[0];
    console.log(`  - ${tableName}`);
  });
  
  // Проверка структуры orders
  const [columns] = await connection.query('DESCRIBE orders');
  console.log('\n📊 Структура таблицы orders:');
  columns.forEach(col => {
    console.log(`  - ${col.Field} (${col.Type})`);
  });
  
  // Подсчет заказов
  const [result] = await connection.query('SELECT COUNT(*) as count FROM orders');
  console.log(`\n📦 Всего заказов в базе: ${result[0].count}`);
  
  connection.release();
  await pool.end();
  
  console.log('\n✅ Проверка завершена успешно');
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}
