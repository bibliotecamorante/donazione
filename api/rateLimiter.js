import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const email = req.body.email;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Create a unique key for the user combining IP and email
    const userKey = `donation:${ip}:${email}`;
    
    // Get the last donation timestamp
    const lastDonation = await redis.get(userKey);
    
    // Check if user has already submitted today
    if (lastDonation) {
      const lastDate = new Date(lastDonation);
      const now = new Date();
      
      // Check if last donation was within the last 24 hours
      if (now - lastDate < 24 * 60 * 60 * 1000) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          nextAvailable: new Date(lastDate.getTime() + 24 * 60 * 60 * 1000)
        });
      }
    }
    
    // Store the current timestamp with 24 hour expiration
    await redis.set(userKey, new Date().toISOString(), { ex: 24 * 60 * 60 });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Rate limiter error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
