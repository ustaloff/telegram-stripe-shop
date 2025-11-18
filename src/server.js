import express from 'express';
import dotenv from 'dotenv';
import { initBot, bot } from './bot.js';
import { stripeWebhook, setBotInstance } from './stripe.js';

dotenv.config();
const app = express();

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf }}));
app.post('/stripe/webhook', stripeWebhook);

initBot();
setBotInstance(bot);

app.listen(3000, () => console.log('Server running on port 3000'));
