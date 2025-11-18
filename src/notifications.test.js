import 'dotenv/config';
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert';
import { setBotInstance } from './bot.js';
import { sendPaymentSuccess, sendPaymentFailed } from './notifications.js';

describe('Notification Service', () => {
  let mockBot;

  before(() => {
    // Create and inject mock bot
    mockBot = {
      sendMessage: mock.fn(async () => ({ message_id: 123 }))
    };
    setBotInstance(mockBot);
  });

  describe('sendPaymentSuccess', () => {
    it('should send success notification with USD currency', async () => {
      mockBot.sendMessage.mock.resetCalls();

      const orderDetails = {
        productName: 'Test Product',
        amount: 5000,
        currency: 'usd',
        externalId: 'order-123'
      };

      const result = await sendPaymentSuccess(123456, orderDetails);

      assert.strictEqual(result, true, 'Should return true on success');
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 1, 'Should call sendMessage once');
      
      const [chatId, message] = mockBot.sendMessage.mock.calls[0].arguments;
      assert.strictEqual(chatId, 123456, 'Should send to correct chat ID');
      assert.ok(message.includes('✅ Оплата успешно получена!'), 'Should include success emoji and text');
      assert.ok(message.includes('Test Product'), 'Should include product name');
      assert.ok(message.includes('$50.00'), 'Should format USD amount correctly');
      assert.ok(message.includes('order-123'), 'Should include order ID');
    });

    it('should send success notification with RUB currency', async () => {
      mockBot.sendMessage.mock.resetCalls();

      const orderDetails = {
        productName: 'Тестовый товар',
        amount: 10000,
        currency: 'rub',
        externalId: 'order-456'
      };

      const result = await sendPaymentSuccess(789012, orderDetails);

      assert.strictEqual(result, true, 'Should return true on success');
      
      const [chatId, message] = mockBot.sendMessage.mock.calls[0].arguments;
      assert.strictEqual(chatId, 789012, 'Should send to correct chat ID');
      assert.ok(message.includes('₽100.00'), 'Should format RUB amount correctly');
      assert.ok(message.includes('Тестовый товар'), 'Should include product name');
    });

    it('should send success notification with EUR currency', async () => {
      mockBot.sendMessage.mock.resetCalls();

      const orderDetails = {
        productName: 'Euro Product',
        amount: 7500,
        currency: 'eur',
        externalId: 'order-789'
      };

      const result = await sendPaymentSuccess(345678, orderDetails);

      assert.strictEqual(result, true, 'Should return true on success');
      
      const [chatId, message] = mockBot.sendMessage.mock.calls[0].arguments;
      assert.ok(message.includes('€75.00'), 'Should format EUR amount correctly');
    });

    it('should handle bot.sendMessage failure gracefully', async () => {
      // Temporarily replace mock to throw error
      const originalMock = mockBot.sendMessage;
      mockBot.sendMessage = mock.fn(async () => {
        throw new Error('Bot blocked by user');
      });

      const orderDetails = {
        productName: 'Test Product',
        amount: 5000,
        currency: 'usd',
        externalId: 'order-error'
      };

      const result = await sendPaymentSuccess(999999, orderDetails);

      assert.strictEqual(result, false, 'Should return false on error');
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 1, 'Should attempt to send message');
      
      // Restore original mock
      mockBot.sendMessage = originalMock;
    });
  });

  describe('sendPaymentFailed', () => {
    it('should send failed notification with reason', async () => {
      mockBot.sendMessage.mock.resetCalls();

      const result = await sendPaymentFailed(123456, 'Insufficient funds');

      assert.strictEqual(result, true, 'Should return true on success');
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 1, 'Should call sendMessage once');
      
      const [chatId, message] = mockBot.sendMessage.mock.calls[0].arguments;
      assert.strictEqual(chatId, 123456, 'Should send to correct chat ID');
      assert.ok(message.includes('❌ Платеж не прошел'), 'Should include error emoji and text');
      assert.ok(message.includes('Insufficient funds'), 'Should include failure reason');
      assert.ok(message.includes('/shop'), 'Should suggest retry with /shop command');
    });

    it('should send failed notification with different reason', async () => {
      mockBot.sendMessage.mock.resetCalls();

      const result = await sendPaymentFailed(789012, 'Card declined', 'order-123');

      assert.strictEqual(result, true, 'Should return true on success');
      
      const [chatId, message] = mockBot.sendMessage.mock.calls[0].arguments;
      assert.ok(message.includes('Card declined'), 'Should include different failure reason');
    });

    it('should handle bot.sendMessage failure gracefully', async () => {
      // Temporarily replace mock to throw error
      const originalMock = mockBot.sendMessage;
      mockBot.sendMessage = mock.fn(async () => {
        throw new Error('Network timeout');
      });

      const result = await sendPaymentFailed(999999, 'Payment timeout');

      assert.strictEqual(result, false, 'Should return false on error');
      assert.strictEqual(mockBot.sendMessage.mock.calls.length, 1, 'Should attempt to send message');
      
      // Restore original mock
      mockBot.sendMessage = originalMock;
    });
  });
});
