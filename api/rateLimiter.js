import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export const config = {
  runtime: 'edge',
  regions: ['fra1']
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io'
      }
    })
  }

  try {
    const body = await req.json()
    const email = body.email

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io'
        }
      })
    }

    const userKey = `donation:${email}`
    const lastDonation = await redis.get(userKey)

    if (lastDonation) {
      const lastDate = new Date(lastDonation)
      const now = new Date()

      if (now - lastDate < 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          nextAvailable: new Date(lastDate.getTime() + 24 * 60 * 60 * 1000).toISOString()
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io'
          }
        })
      }
    }

    await redis.set(userKey, new Date().toISOString(), { ex: 24 * 60 * 60 })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io'
      }
    })
  } catch (error) {
    console.error('Rate limiter error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io'
      }
    })
  }
}
