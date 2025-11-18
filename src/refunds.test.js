import 'dotenv/config';
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { createRefund, processRefundWebhook } from './refunds.js';
import { createOrder, updateOrderStatus } from './orders.js';
import { pool } from './db.js';
import { setBotInstance } from './bot.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

describe('Refund Service', () => {
  let testOrderId;
  let testPaymentIntentId;
  let mockBot;

  before(async () => {
    // Clean up any existing test data
    await pool.execute('DELETE FROM orders WHERE product_name LIKE "TEST_REFUND_%"');

    // Create mock bot instance
    mockBot = {
      sendMessage: mock.fn(async () => ({ message_id: 123 }))
    };
    setBotInstance(mockBot);
  });

  after(async () => {
    // Clean up test data
    await pool.execute('DELETE FROM orders WHERE product_name LIKE "TEST_REFUND_%"');
    await pool.end();
  });

  describe('createRefund', () => {
    it('should create refund with valid order', async () => {
      // Create a test order with payment intent
      const checkoutSessionId = `cs_test_refund_${Date.now()}`;
      testPaymentIntentId = `pi_test_refund_${Date.now()}`;
      
      const orderData = {
        userId: 111222333,
        chatId: 444555666,
        productId: 1,
        productName: 'TEST_REFUND_Product',
        amount: 1000,
        currency: 'usd',
        checkoutSessionId
      };

      const result = await createOrder(orderData);
      testOrderId = result.orderId;

      // Update order to paid status with payment intent
      await updateOrderStatus(testOrderId, 'paid', testPaymentIntentId);

      // Mock Stripe refund creation
      const originalCreate = stripe.refunds.create;
      const mockRefundId = `re_test_${Date.now()}`;
      stripe.refunds.create = mock.fn(async () => ({
        id: mockRefundId,
        amount: 1000,
        status: 'succeeded'
      }));

      // Reset bot mock calls
      mockBot.sendMessage.mock.resetCalls();

      // Create refund
      const refundResult = await createRefund(testOrderId);

      // Restore original function
      stripe.refunds.create = originalCreate;

      // Verify refund was created successfully
      assert.strictEqual(refundResult.success, true, 'Refund should succeed');
      assert.strictEqual(refundResult.refundId, mockRefundId, 'Should return refund ID');

      // Verify Stripe API was called correctly
      assert.strictEqual(stripe.refunds.create.mock.calls.length, 1, 'Should call Stripe refunds.create once');
      const [createParams] = stripe.refunds.create.mock.calls[0].arguments;
      assert.strictEqual(createParams.payment_intent, testPaymentIntentId, 'Should use correct payment intent ID');

      // Verify notification was sent
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 1, 'Should send notification');
      const [chatId, message] = mockBot.sendMessage.mock.calls[0].arguments;
      assert.strictEqual(chatId, 444555666, 'Should send to correct chat');
      assert.ok(message.includes('💰'), 'Should include money emoji');
      assert.ok(message.includes('$10.00'), 'Should include formatted amount');
    });

    it('should fail when order already refunded', async () => {
      // Try to refund the same order again
      const refundResult = await createRefund(testOrderId);

      assert.strictEqual(refundResult.success, false, 'Refund should fail');
      assert.strictEqual(refundResult.error, 'Order already refunded', 'Should return correct error message');
    });

    it('should fail when order has missing payment_intent_id', async () => {
      // Create order without payment intent
      const checkoutSessionId = `cs_test_no_pi_${Date.now()}`;
      
      const orderData = {
        userId: 777888999,
        chatId: 111222333,
        productId: 2,
        productName: 'TEST_REFUND_No_PI',
        amount: 500,
        currency: 'usd',
        checkoutSessionId
      };

      const result = await createOrder(orderData);
      const orderIdNoPi = result.orderId;

      // Try to create refund
      const refundResult = await createRefund(orderIdNoPi);

      assert.strictEqual(refundResult.success, false, 'Refund should fail');
      assert.strictEqual(refundResult.error, 'Payment intent not found', 'Should return correct error message');
    });
  });

  describe('processRefundWebhook', () => {
    let webhookTestOrderId;
    let webhookPaymentIntentId;

    it('should process refund webhook with valid payment intent', async () => {
      // Create a test order for webhook processing
      const checkoutSessionId = `cs_test_webhook_refund_${Date.now()}`;
      webhookPaymentIntentId = `pi_test_webhook_refund_${Date.now()}`;
      
      const orderData = {
        userId: 555666777,
        chatId: 888999000,
        productId: 3,
        productName: 'TEST_REFUND_Webhook',
        amount: 2000,
        currency: 'usd',
        checkoutSessionId
      };

      const result = await createOrder(orderData);
      webhookTestOrderId = result.orderId;

      // Update order to paid status with payment intent
      await updateOrderStatus(webhookTestOrderId, 'paid', webhookPaymentIntentId);

      // Reset bot mock calls
      mockBot.sendMessage.mock.resetCalls();

      // Process webhook
      const webhookRefundId = `re_webhook_${Date.now()}`;
      const webhookResult = await processRefundWebhook(webhookPaymentIntentId, webhookRefundId);

      assert.strictEqual(webhookResult, true, 'Webhook processing should succeed');

      // Verify notification was sent
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 1, 'Should send notification');
      const [chatId, message] = mockBot.sendMessage.mock.calls[0].arguments;
      assert.strictEqual(chatId, 888999000, 'Should send to correct chat');
      assert.ok(message.includes('💰'), 'Should include money emoji');
      assert.ok(message.includes('$20.00'), 'Should include formatted amount');
    });

    it('should handle webhook idempotency correctly', async () => {
      // Reset bot mock calls
      mockBot.sendMessage.mock.resetCalls();

      // Process same webhook again
      const webhookRefundId = `re_webhook_duplicate_${Date.now()}`;
      const webhookResult = await processRefundWebhook(webhookPaymentIntentId, webhookRefundId);

      assert.strictEqual(webhookResult, true, 'Webhook processing should succeed (idempotent)');

      // Verify no additional notification was sent
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 0, 'Should not send duplicate notification');
    });
  });
});
