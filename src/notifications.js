import { bot } from './bot.js';

/**
 * Форматирует сумму в читаемый вид
 * @param {number} amount - Сумма в центах
 * @param {string} currency - Код валюты
 * @returns {string} - Форматированная строка (например "$50.00")
 */
function formatAmount(amount, currency) {
  const amountInUnits = (amount / 100).toFixed(2);
  
  const currencySymbols = {
    usd: '$',
    rub: '₽',
    eur: '€'
  };
  
  const symbol = currencySymbols[currency.toLowerCase()] || currency.toUpperCase();
  
  return `${symbol}${amountInUnits}`;
}

/**
 * Отправляет уведомление об успешной оплате
 * @param {number} chatId - Telegram chat ID
 * @param {Object} orderDetails - { productName, amount, currency, externalId }
 * @returns {Promise<boolean>} - true если отправлено успешно
 */
export async function sendPaymentSuccess(chatId, orderDetails) {
  const { productName, amount, currency, externalId } = orderDetails;
  
  const formattedAmount = formatAmount(amount, currency);
  
  const message = `✅ Оплата успешно получена!

Товар: ${productName}
Сумма: ${formattedAmount}
Номер заказа: ${externalId}

Спасибо за покупку!`;

  try {
    await bot.sendMessage(chatId, message);
    console.log('Payment notification sent', {
      chatId,
      orderId: externalId,
      productName,
      amount: formattedAmount
    });
    return true;
  } catch (error) {
    console.error('Failed to send payment notification', {
      chatId,
      orderId: externalId,
      productName,
      error: error.message,
      errorStack: error.stack
    });
    return false;
  }
}

/**
 * Отправляет уведомление о неудачной оплате
 * @param {number} chatId - Telegram chat ID
 * @param {string} reason - Причина отказа
 * @param {string} orderId - Номер заказа (опционально)
 * @returns {Promise<boolean>} - true если отправлено успешно
 */
export async function sendPaymentFailed(chatId, reason, orderId = null) {
  const message = `❌ Платеж не прошел

Причина: ${reason}

Попробуйте снова через /shop`;

  try {
    await bot.sendMessage(chatId, message);
    console.log('Payment failed notification sent', {
      chatId,
      orderId,
      reason
    });
    return true;
  } catch (error) {
    console.error('Failed to send payment failed notification', {
      chatId,
      orderId,
      reason,
      error: error.message,
      errorStack: error.stack
    });
    return false;
  }
}

/**
 * Отправляет уведомление о возврате средств
 * @param {number} chatId - Telegram chat ID
 * @param {Object} refundDetails - { amount, currency, externalId }
 * @returns {Promise<boolean>} - true если отправлено успешно
 */
export async function sendRefundNotification(chatId, refundDetails) {
  const { amount, currency, externalId } = refundDetails;
  
  const formattedAmount = formatAmount(amount, currency);
  
  const message = `💰 Возврат средств выполнен

Сумма: ${formattedAmount}
Номер заказа: ${externalId}

Средства будут зачислены на вашу карту в течение 5-10 рабочих дней.`;

  try {
    await bot.sendMessage(chatId, message);
    console.log('Refund notification sent', {
      chatId,
      orderId: externalId,
      amount: formattedAmount
    });
    return true;
  } catch (error) {
    console.error('Failed to send refund notification', {
      chatId,
      orderId: externalId,
      error: error.message,
      errorStack: error.stack
    });
    return false;
  }
}
