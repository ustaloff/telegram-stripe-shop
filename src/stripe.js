import Stripe from 'stripe';
import dotenv from 'dotenv';
import { getOrderByCheckoutSession, getOrderByPaymentIntent, updateOrderStatus } from './orders.js';
import { sendPaymentSuccess, sendPaymentFailed } from './notifications.js';
import { processRefundWebhook } from './refunds.js';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Bot instance will be set by server.js after bot initialization
let botInstance = null;

export function setBotInstance(bot) {
  botInstance = bot;
}

export async function createCheckout(amount, currency, name, metadata = {}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency, unit_amount: amount,
        product_data: { name }
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: process.env.SERVER_URL + '/success',
    cancel_url: process.env.SERVER_URL + '/cancel',
    metadata
  });
  return { url: session.url, sessionId: session.id };
}

export async function stripeWebhook(req, res) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const checkoutSessionId = session.id;
    const paymentIntentId = session.payment_intent;

    try {
      // Find order by checkout session ID
      const order = await getOrderByCheckoutSession(checkoutSessionId);

      if (!order) {
        console.warn(`Order not found for checkout session: ${checkoutSessionId}`);
        return res.json({ received: true });
      }

      // Idempotency check: skip if already paid
      if (order.status === 'paid') {
        console.log(`Order ${order.id} already marked as paid, skipping update`);
        return res.json({ received: true });
      }

      // Update order status to "paid"
      const updatedOrder = await updateOrderStatus(order.id, 'paid', paymentIntentId);
      console.log(`Order ${order.id} updated to paid status`);

      // Send payment confirmation notification to user
      const notificationSent = await sendPaymentSuccess(updatedOrder.chat_id, {
        productName: updatedOrder.product_name,
        amount: updatedOrder.amount,
        currency: updatedOrder.currency,
        externalId: updatedOrder.external_id
      });
      
      if (!notificationSent) {
        console.warn('Payment notification delivery failed but order processed', {
          orderId: updatedOrder.id,
          externalId: updatedOrder.external_id,
          chatId: updatedOrder.chat_id
        });
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      // Return 200 to prevent Stripe from retrying
      return res.json({ received: true });
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const checkoutSessionId = session.id;

    try {
      // Find order by checkout session ID
      const order = await getOrderByCheckoutSession(checkoutSessionId);

      if (!order) {
        console.warn(`Order not found for expired checkout session: ${checkoutSessionId}`);
        return res.json({ received: true });
      }

      // Update order status to "failed"
      await updateOrderStatus(order.id, 'failed');
      console.log(`Order ${order.id} marked as failed (session expired)`);

      // Send payment failed notification
      const notificationSent = await sendPaymentFailed(
        order.chat_id, 
        'Истекло время сессии оплаты',
        order.external_id
      );
      
      if (!notificationSent) {
        console.warn('Failed payment notification delivery failed', {
          orderId: order.id,
          externalId: order.external_id,
          chatId: order.chat_id,
          reason: 'session_expired'
        });
      }
    } catch (error) {
      console.error('Error processing expired session:', error);
      // Return 200 to prevent Stripe from retrying
      return res.json({ received: true });
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    const paymentIntentId = paymentIntent.id;
    const errorMessage = paymentIntent.last_payment_error?.message || 'Ошибка обработки платежа';

    try {
      // Find order by payment intent ID
      const order = await getOrderByPaymentIntent(paymentIntentId);

      if (!order) {
        console.warn(`Order not found for payment intent: ${paymentIntentId}`);
        return res.json({ received: true });
      }

      // Update order status to "failed"
      await updateOrderStatus(order.id, 'failed');
      console.log(`Order ${order.id} marked as failed (payment failed)`);

      // Send payment failed notification
      const notificationSent = await sendPaymentFailed(
        order.chat_id, 
        errorMessage,
        order.external_id
      );
      
      if (!notificationSent) {
        console.warn('Failed payment notification delivery failed', {
          orderId: order.id,
          externalId: order.external_id,
          chatId: order.chat_id,
          reason: 'payment_failed',
          errorMessage
        });
      }
    } catch (error) {
      console.error('Error processing payment failure:', error);
      // Return 200 to prevent Stripe from retrying
      return res.json({ received: true });
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const paymentIntentId = charge.payment_intent;
    const refundId = charge.refunds.data[0]?.id;

    try {
      if (!refundId) {
        console.warn(`No refund ID found in charge.refunded event for payment intent: ${paymentIntentId}`);
        return res.json({ received: true });
      }

      // Process refund webhook
      await processRefundWebhook(paymentIntentId, refundId);
      console.log(`Refund webhook processed for payment intent: ${paymentIntentId}`);
    } catch (error) {
      console.error('Error processing refund webhook:', error);
      // Return 200 to prevent Stripe from retrying
      return res.json({ received: true });
    }
  }

  res.json({ received: true });
}

