import 'dotenv/config';
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { stripeWebhook, setBotInstance } from './stripe.js';
import { createOrder, getOrderByCheckoutSession } from './orders.js';
import { pool } from './db.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

describe('Stripe Webhook Integration', () => {
  let testOrderId;
  let testCheckoutSessionId;
  let testExternalId;
  let mockBot;

  before(async () => {
    // Clean up any existing test data
    await pool.execute('DELETE FROM orders WHERE product_name LIKE "TEST_WEBHOOK_%"');

    // Create mock bot instance
    mockBot = {
      sendMessage: mock.fn(async () => ({ message_id: 123 }))
    };
    setBotInstance(mockBot);
  });

  after(async () => {
    // Clean up test data
    await pool.execute('DELETE FROM orders WHERE product_name LIKE "TEST_WEBHOOK_%"');
    await pool.end();
  });

  describe('Valid checkout.session.completed event', () => {
    it('should update order status to paid and send notification', async () => {
      // Create a test order
      testCheckoutSessionId = `cs_test_webhook_${Date.now()}`;
      const orderData = {
        userId: 111222333,
        chatId: 444555666,
        productId: 1,
        productName: 'TEST_WEBHOOK_Product',
        amount: 1000,
        currency: 'usd',
        checkoutSessionId: testCheckoutSessionId
      };

      const result = await createOrder(orderData);
      testOrderId = result.orderId;
      testExternalId = result.externalId;

      // Construct webhook event
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: testCheckoutSessionId,
            payment_intent: 'pi_test_123456'
          }
        }
      };

      // Create mock request and response
      const mockReq = {
        rawBody: JSON.stringify(event),
        headers: {
          'stripe-signature': 'mock_signature'
        }
      };

      const mockRes = {
        status: mock.fn(() => mockRes),
        send: mock.fn(),
        json: mock.fn()
      };

      // Mock stripe.webhooks.constructEvent to return our test event
      const originalConstructEvent = stripe.webhooks.constructEvent;
      stripe.webhooks.constructEvent = mock.fn(() => event);

      // Call webhook handler
      await stripeWebhook(mockReq, mockRes);

      // Restore original function
      stripe.webhooks.constructEvent = originalConstructEvent;

      // Verify order was updated
      const updatedOrder = await getOrderByCheckoutSession(testCheckoutSessionId);
      assert.strictEqual(updatedOrder.status, 'paid', 'Order status should be updated to paid');
      assert.strictEqual(updatedOrder.payment_intent_id, 'pi_test_123456', 'Payment intent ID should be saved');

      // Verify notification was sent
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 1, 'Bot should send one message');
      const [chatId, message] = mockBot.sendMessage.mock.calls[0].arguments;
      assert.strictEqual(chatId, 444555666, 'Message should be sent to correct chat');
      assert.ok(message.includes('TEST_WEBHOOK_Product'), 'Message should include product name');
      assert.ok(message.includes(testExternalId), 'Message should include external ID');

      // Verify response
      assert.strictEqual(mockRes.json.mock.calls.length, 1, 'Should send JSON response');
      assert.deepStrictEqual(mockRes.json.mock.calls[0].arguments[0], { received: true });
    });
  });

  describe('Idempotency - duplicate webhook processing', () => {
    it('should skip update if order already paid', async () => {
      // Reset mock call count
      mockBot.sendMessage.mock.resetCalls();

      // Construct same webhook event again
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: testCheckoutSessionId,
            payment_intent: 'pi_test_123456'
          }
        }
      };

      const mockReq = {
        rawBody: JSON.stringify(event),
        headers: {
          'stripe-signature': 'mock_signature'
        }
      };

      const mockRes = {
        status: mock.fn(() => mockRes),
        send: mock.fn(),
        json: mock.fn()
      };

      // Mock stripe.webhooks.constructEvent
      const originalConstructEvent = stripe.webhooks.constructEvent;
      stripe.webhooks.constructEvent = mock.fn(() => event);

      // Call webhook handler again
      await stripeWebhook(mockReq, mockRes);

      // Restore original function
      stripe.webhooks.constructEvent = originalConstructEvent;

      // Verify order status unchanged
      const order = await getOrderByCheckoutSession(testCheckoutSessionId);
      assert.strictEqual(order.status, 'paid', 'Order status should still be paid');

      // Verify no additional notification sent
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 0, 'Bot should not send duplicate message');

      // Verify response
      assert.strictEqual(mockRes.json.mock.calls.length, 1, 'Should send JSON response');
      assert.deepStrictEqual(mockRes.json.mock.calls[0].arguments[0], { received: true });
    });
  });

  describe('Order not found scenario', () => {
    it('should log warning and return 200 for non-existent order', async () => {
      // Construct webhook event with non-existent checkout session
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_nonexistent_webhook_12345',
            payment_intent: 'pi_test_nonexistent'
          }
        }
      };

      const mockReq = {
        rawBody: JSON.stringify(event),
        headers: {
          'stripe-signature': 'mock_signature'
        }
      };

      const mockRes = {
        status: mock.fn(() => mockRes),
        send: mock.fn(),
        json: mock.fn()
      };

      // Mock stripe.webhooks.constructEvent
      const originalConstructEvent = stripe.webhooks.constructEvent;
      stripe.webhooks.constructEvent = mock.fn(() => event);

      // Call webhook handler
      await stripeWebhook(mockReq, mockRes);

      // Restore original function
      stripe.webhooks.constructEvent = originalConstructEvent;

      // Verify response is still 200
      assert.strictEqual(mockRes.json.mock.calls.length, 1, 'Should send JSON response');
      assert.deepStrictEqual(mockRes.json.mock.calls[0].arguments[0], { received: true });
      
      // Verify no error response
      assert.strictEqual(mockRes.status.mock.calls.length, 0, 'Should not call status() for error');
    });
  });
});
