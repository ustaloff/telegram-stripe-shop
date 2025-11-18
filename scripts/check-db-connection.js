#!/usr/bin/env node
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

console.log('🔍 Проверка DATABASE_URL...\n');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL}\n`);

if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL не установлен в .env');
  process.exit(1);
}

try {
  console.log('Попытка подключения...');
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('✅ Подключение успешно!\n');
  
  // Показать текущую базу данных
  const [rows] = await connection.query('SELECT DATABASE() as db');
  console.log(`📊 Текущая база данных: ${rows[0].db}\n`);
  
  // Показать таблицы
  const [tables] = await connection.query('SHOW TABLES');
  console.log('📋 Таблицы:');
  if (tables.length === 0) {
    console.log('  (нет таблиц - запустите npm run migrate)');
  } else {
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`  - ${tableName}`);
    });
  }
  
  await connection.end();
  process.exit(0);
} catch (error) {
  console.log(`\n❌ Ошибка подключения:`);
  console.log(`   Код: ${error.code}`);
  console.log(`   Сообщение: ${error.message}\n`);
  
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.log('💡 Проверьте:');
    console.log('   - Правильность имени пользователя и пароля');
    console.log('   - Формат: mysql://username:password@host:port/database');
    console.log('   - Если пароль пустой: mysql://root:@localhost:3306/dbname');
  } else if (error.code === 'ER_BAD_DB_ERROR') {
    console.log('💡 База данных не существует. Создайте её:');
    console.log('   mysql -u root -e "CREATE DATABASE telegram_shop;"');
  } else if (error.code === 'ECONNREFUSED') {
    console.log('💡 MySQL сервер не запущен. Запустите WAMP/MySQL.');
  }
  
  process.exit(1);
}
