const { initDb } = require('../config/database');

let stripeClient = null;
if (process.env.STRIPE_SECRET) {
  try {
    const Stripe = require('stripe');
    stripeClient = Stripe(process.env.STRIPE_SECRET);
  } catch (e) {
    console.warn('Stripe not available:', e.message);
  }
}

// Create a PaymentIntent (if Stripe configured) or return a fallback token
const createPaymentIntent = async (req, res) => {
  const { amount, currency = 'usd', metadata = {} } = req.body;
  if (stripeClient) {
    const intent = await stripeClient.paymentIntents.create({ amount: Math.round(Number(amount) * 100), currency, metadata });
    return res.json({ clientSecret: intent.client_secret, id: intent.id });
  }
  // fallback (no real payment)
  return res.json({ clientSecret: 'demo_client_secret', id: `demo_${Date.now()}` });
};

// Handle a simple payment post (record payment info). In production this should be driven by webhook/confirmed payment.
const pay = async (req, res) => {
  const sequelize = await initDb();
  const { Payment, Booking } = require('../models')(sequelize);
  const { bookingId, method = 'card', amount, stripePaymentIntentId } = req.body;
  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.status(400).json({ error: 'Invalid booking' });

  const status = stripePaymentIntentId ? 'paid' : 'pending';
  const p = await Payment.create({ bookingId, method, amount, status, meta: { stripePaymentIntentId } });

  // notify via socket
  const io = req.app && req.app.get('io');
  if (io) io.emit('payment:received', { payment: p });

  res.json(p);
};

// Webhook handler for Stripe
const handleWebhook = async (req, res) => {
  if (!stripeClient) return res.status(400).json({ error: 'Stripe not configured' });
  const sig = req.headers['stripe-signature'];
  const rawBody = req.body; // expect raw body (express.raw)
  let event;
  try {
    event = stripeClient.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Process relevant events
  const sequelize = await initDb();
  const { Payment } = require('../models')(sequelize);

  switch (event.type) {
    case 'payment_intent.succeeded':
      {
        const pi = event.data.object;
        // mark payment records with this intent as paid
        await Payment.update({ status: 'paid' }, { where: { meta: { stripePaymentIntentId: pi.id } } });
        const io = req.app && req.app.get('io');
        if (io) io.emit('payment:received', { paymentIntent: pi });
      }
      break;
    default:
      console.log('Unhandled event type', event.type);
  }

  res.json({ received: true });
};

module.exports = { pay, createPaymentIntent, handleWebhook };
