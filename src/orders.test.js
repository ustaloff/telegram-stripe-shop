import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createOrder, getOrderByCheckoutSession, updateOrderStatus } from './orders.js';
import { pool } from './db.js';

describe('Order Service', () => {
  let testOrderId;
  let testCheckoutSessionId;

  before(async () => {
    // Clean up any existing test data
    await pool.execute('DELETE FROM orders WHERE product_name LIKE "TEST_%"');
  });

  after(async () => {
    // Clean up test data
    await pool.execute('DELETE FROM orders WHERE product_name LIKE "TEST_%"');
    await pool.end();
  });

  describe('createOrder', () => {
    it('should create order with valid data', async () => {
      testCheckoutSessionId = `cs_test_${Date.now()}`;
      
      const orderData = {
        userId: 123456789,
        chatId: 987654321,
        productId: 1,
        productName: 'TEST_Product',
        amount: 500,
        currency: 'usd',
        checkoutSessionId: testCheckoutSessionId
      };

      const result = await createOrder(orderData);

      assert.ok(result.orderId, 'Order ID should be returned');
      assert.ok(result.externalId, 'External ID should be generated');
      assert.match(result.externalId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'External ID should be a valid UUID');

      testOrderId = result.orderId;
    });
  });

  describe('getOrderByCheckoutSession', () => {
    it('should find order by existing checkout session ID', async () => {
      const order = await getOrderByCheckoutSession(testCheckoutSessionId);

      assert.ok(order, 'Order should be found');
      assert.strictEqual(order.id, testOrderId, 'Order ID should match');
      assert.strictEqual(order.checkout_session_id, testCheckoutSessionId, 'Checkout session ID should match');
      assert.strictEqual(order.status, 'pending', 'Status should be pending');
      assert.strictEqual(order.product_name, 'TEST_Product', 'Product name should match');
    });

    it('should return null for non-existing checkout session ID', async () => {
      const order = await getOrderByCheckoutSession('cs_nonexistent_12345');

      assert.strictEqual(order, null, 'Should return null for non-existing session');
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status to paid', async () => {
      const updatedOrder = await updateOrderStatus(testOrderId, 'paid');

      assert.ok(updatedOrder, 'Updated order should be returned');
      assert.strictEqual(updatedOrder.status, 'paid', 'Status should be updated to paid');
    });

    it('should update order status with payment intent ID', async () => {
      const paymentIntentId = 'pi_test_123456';
      const updatedOrder = await updateOrderStatus(testOrderId, 'paid', paymentIntentId);

      assert.ok(updatedOrder, 'Updated order should be returned');
      assert.strictEqual(updatedOrder.status, 'paid', 'Status should be paid');
      assert.strictEqual(updatedOrder.payment_intent_id, paymentIntentId, 'Payment intent ID should be saved');
    });

    it('should update order status to failed', async () => {
      const updatedOrder = await updateOrderStatus(testOrderId, 'failed');

      assert.ok(updatedOrder, 'Updated order should be returned');
      assert.strictEqual(updatedOrder.status, 'failed', 'Status should be updated to failed');
    });
  });
});
