// api/submit.js
import { createClient } from '@vercel/edge-config';
import config from '../scripts/config.js';

const edgeConfig = createClient(process.env.EDGE_CONFIG);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const today = new Date().toISOString().split('T')[0];
    const key = `${userIp}_${today}`;

    // Get current count from Edge Config
    let count = await edgeConfig.get(key) || 0;

    // Check if limit exceeded
    if (count >= 2) {
      return res.status(429).json({ 
        error: 'Limite giornaliero raggiunto. Riprova domani.' 
      });
    }

    // Increment count
    await edgeConfig.set(key, count + 1);
    
    // Forward the request to EmailJS
    const emailData = {
      service_id: config.emailjs.serviceId,
      template_id: config.emailjs.templateId,
      user_id: config.emailjs.publicKey,
      template_params: req.body
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error('Failed to send email');
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
