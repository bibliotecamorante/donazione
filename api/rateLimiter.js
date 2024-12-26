// api/rateLimiter.js
import { Redis } from '@upstash/redis'

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export const config = {
  runtime: 'edge',
  regions: ['fra1'], // Specify the region closest to your users
}

export default async function handler(req) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    )
  }

  try {
    const body = await req.json()
    const email = body.email

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    // Create a unique key for the user based on email
    const userKey = `donation:${email}`

    // Get the last donation timestamp
    const lastDonation = await redis.get(userKey)

    // Check if user has already submitted today
    if (lastDonation) {
      const lastDate = new Date(lastDonation)
      const now = new Date()

      // Check if last donation was within the last 24 hours
      if (now - lastDate < 24 * 60 * 60 * 1000) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            nextAvailable: new Date(lastDate.getTime() + 24 * 60 * 60 * 1000).toISOString()
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        )
      }
    }

    // Store the current timestamp with 24 hour expiration
    await redis.set(userKey, new Date().toISOString(), { ex: 24 * 60 * 60 })

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Rate limiter error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
}
