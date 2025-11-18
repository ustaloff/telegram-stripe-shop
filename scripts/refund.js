import dotenv from 'dotenv';
import { pool } from '../src/db.js';
import { getOrderById, getOrderByExternalId } from '../src/orders.js';
import { createRefund } from '../src/refunds.js';

dotenv.config();

async function main() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('Usage: node scripts/refund.js <order_id or external_id>');
    process.exit(1);
  }

  try {
    let order = null;

    // Try to find order by numeric ID first
    if (/^\d+$/.test(identifier)) {
      const orderId = parseInt(identifier, 10);
      order = await getOrderById(orderId);
      if (order) {
        console.log(`Found order by ID: ${orderId}`);
      }
    }

    // If not found by ID, try by external_id
    if (!order) {
      order = await getOrderByExternalId(identifier);
      if (order) {
        console.log(`Found order by external_id: ${identifier}`);
      }
    }

    // Validate order exists
    if (!order) {
      console.error(`Order not found: ${identifier}`);
      await pool.end();
      process.exit(1);
    }

    console.log(`Processing refund for order #${order.id} (${order.external_id})`);
    console.log(`Amount: ${order.amount} ${order.currency}`);
    console.log(`Status: ${order.status}`);

    // Call createRefund
    const result = await createRefund(order.id);

    if (result.success) {
      console.log(`✓ Refund successful!`);
      console.log(`Refund ID: ${result.refundId}`);
      await pool.end();
      process.exit(0);
    } else {
      console.error(`✗ Refund failed: ${result.error}`);
      await pool.end();
      process.exit(1);
    }
  } catch (error) {
    console.error('Unexpected error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main();
