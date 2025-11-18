import { pool } from './db.js';
import { randomUUID } from 'crypto';

/**
 * Creates a new order with "pending" status
 * @param {Object} orderData - Order information
 * @param {number} orderData.userId - Telegram user ID
 * @param {number} orderData.chatId - Telegram chat ID
 * @param {number} orderData.productId - Product ID
 * @param {string} orderData.productName - Product name
 * @param {number} orderData.amount - Amount in cents
 * @param {string} orderData.currency - Currency code (usd, rub, etc)
 * @param {string} orderData.checkoutSessionId - Stripe checkout session ID
 * @param {string} [orderData.externalId] - Optional pre-generated external ID
 * @returns {Promise<{orderId: number, externalId: string}>}
 */
export async function createOrder(orderData) {
  const {
    userId,
    chatId,
    productId,
    productName,
    amount,
    currency,
    checkoutSessionId,
    externalId: providedExternalId
  } = orderData;

  const externalId = providedExternalId || randomUUID();
  const status = 'pending';

  const [result] = await pool.execute(
    `INSERT INTO orders (
      external_id,
      user_id,
      chat_id,
      product_id,
      product_name,
      amount,
      currency,
      status,
      checkout_session_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [externalId, userId, chatId, productId, productName, amount, currency, status, checkoutSessionId]
  );

  return {
    orderId: result.insertId,
    externalId
  };
}

/**
 * Finds an order by Stripe checkout session ID
 * @param {string} sessionId - Stripe checkout session ID
 * @returns {Promise<Object|null>} Order object or null if not found
 */
export async function getOrderByCheckoutSession(sessionId) {
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE checkout_session_id = ?',
    [sessionId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Updates order status and optionally payment intent ID
 * @param {number} orderId - Order ID
 * @param {string} status - New status (pending, paid, failed, refunded)
 * @param {string} [paymentIntentId] - Stripe payment intent ID (optional)
 * @returns {Promise<Object>} Updated order object
 */
export async function updateOrderStatus(orderId, status, paymentIntentId = null) {
  if (paymentIntentId) {
    await pool.execute(
      'UPDATE orders SET status = ?, payment_intent_id = ? WHERE id = ?',
      [status, paymentIntentId, orderId]
    );
  } else {
    await pool.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );
  }

  // Fetch and return updated order
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE id = ?',
    [orderId]
  );

  return rows[0];
}

/**
 * Finds an order by order ID
 * @param {number} orderId - Order ID
 * @returns {Promise<Object|null>} Order object or null if not found
 */
export async function getOrderById(orderId) {
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE id = ?',
    [orderId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Finds an order by external ID
 * @param {string} externalId - External order ID (UUID)
 * @returns {Promise<Object|null>} Order object or null if not found
 */
export async function getOrderByExternalId(externalId) {
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE external_id = ?',
    [externalId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Finds an order by Stripe payment intent ID
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @returns {Promise<Object|null>} Order object or null if not found
 */
export async function getOrderByPaymentIntent(paymentIntentId) {
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE payment_intent_id = ?',
    [paymentIntentId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Marks an order as refunded
 * @param {number} orderId - Order ID
 * @param {string} refundId - Stripe refund ID
 * @returns {Promise<Object>} Updated order object
 */
export async function markOrderRefunded(orderId, refundId) {
  await pool.execute(
    'UPDATE orders SET status = ?, refund_id = ?, updated_at = NOW() WHERE id = ?',
    ['refunded', refundId, orderId]
  );

  // Fetch and return updated order
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE id = ?',
    [orderId]
  );

  return rows[0];
}
