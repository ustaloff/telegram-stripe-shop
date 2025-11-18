import Stripe from 'stripe';
import dotenv from 'dotenv';
import { getOrderById, getOrderByPaymentIntent, markOrderRefunded } from './orders.js';
import { sendRefundNotification } from './notifications.js';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Создает возврат для заказа
 * @param {number} orderId - ID заказа в БД
 * @returns {Promise<Object>} - { success, refundId, error }
 */
export async function createRefund(orderId) {
  try {
    // Получить заказ из БД
    const order = await getOrderById(orderId);
    
    if (!order) {
      console.error('Order not found', { orderId });
      return { success: false, error: 'Order not found' };
    }

    // Проверить что заказ не возвращен
    if (order.status === 'refunded') {
      console.warn('Order already refunded', { orderId, refundId: order.refund_id });
      return { success: false, error: 'Order already refunded' };
    }

    // Проверить наличие payment_intent_id
    if (!order.payment_intent_id) {
      console.error('Payment intent ID missing', { orderId });
      return { success: false, error: 'Payment intent not found' };
    }

    // Создать возврат в Stripe
    let refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: order.payment_intent_id
      });
      console.log('Stripe refund created', { 
        orderId, 
        refundId: refund.id,
        paymentIntentId: order.payment_intent_id 
      });
    } catch (stripeError) {
      console.error('Stripe refund creation failed', {
        orderId,
        paymentIntentId: order.payment_intent_id,
        error: stripeError.message,
        code: stripeError.code
      });

      // Обработка специфичных ошибок Stripe
      if (stripeError.code === 'resource_missing') {
        return { success: false, error: 'Payment intent not found' };
      }
      if (stripeError.code === 'charge_already_refunded') {
        return { success: false, error: 'Already refunded' };
      }
      
      return { success: false, error: stripeError.message };
    }

    // Обновить статус заказа
    await markOrderRefunded(orderId, refund.id);
    console.log('Order marked as refunded', { orderId, refundId: refund.id });

    // Отправить уведомление пользователю
    const notificationSent = await sendRefundNotification(order.chat_id, {
      amount: order.amount,
      currency: order.currency,
      externalId: order.external_id
    });
    
    if (notificationSent) {
      console.log('Refund notification sent successfully', { orderId, chatId: order.chat_id });
    } else {
      console.warn('Failed to send refund notification, but refund was successful', { 
        orderId, 
        chatId: order.chat_id 
      });
    }

    return { success: true, refundId: refund.id };
  } catch (error) {
    console.error('Unexpected error in createRefund', {
      orderId,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

/**
 * Обрабатывает webhook событие о возврате
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {string} refundId - Stripe refund ID
 * @returns {Promise<boolean>}
 */
export async function processRefundWebhook(paymentIntentId, refundId) {
  try {
    // Найти заказ по payment_intent_id
    const order = await getOrderByPaymentIntent(paymentIntentId);

    if (!order) {
      console.warn('Order not found for refund webhook', { 
        paymentIntentId, 
        refundId 
      });
      return true; // Возвращаем true чтобы webhook вернул 200
    }

    // Проверка идемпотентности
    if (order.status === 'refunded') {
      console.log('Order already refunded, skipping webhook processing', {
        orderId: order.id,
        existingRefundId: order.refund_id,
        webhookRefundId: refundId
      });
      return true;
    }

    // Обновить статус заказа
    await markOrderRefunded(order.id, refundId);
    console.log('Order marked as refunded via webhook', {
      orderId: order.id,
      refundId,
      paymentIntentId
    });

    // Отправить уведомление пользователю
    const notificationSent = await sendRefundNotification(order.chat_id, {
      amount: order.amount,
      currency: order.currency,
      externalId: order.external_id
    });
    
    if (notificationSent) {
      console.log('Refund notification sent successfully via webhook', { 
        orderId: order.id, 
        chatId: order.chat_id 
      });
    } else {
      console.warn('Failed to send refund notification via webhook, but refund was processed', { 
        orderId: order.id, 
        chatId: order.chat_id 
      });
    }

    return true;
  } catch (error) {
    console.error('Error processing refund webhook', {
      paymentIntentId,
      refundId,
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}
