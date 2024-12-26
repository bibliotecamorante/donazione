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
    const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]
    if (!ip) {
      throw new Error('Could not determine IP address')
    }

    const ipKey = `donation:ip:${ip}`
    const lastDonations = await redis.get(ipKey) || '[]'
    const donations = JSON.parse(lastDonations)
    
    const now = new Date()
    const recentDonations = donations.filter(timestamp => 
      now - new Date(timestamp) < 24 * 60 * 60 * 1000
    )

    if (recentDonations.length >= 1) {
      const oldestDonation = new Date(Math.min(...recentDonations.map(d => new Date(d))))
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        nextAvailable: new Date(oldestDonation.getTime() + 24 * 60 * 60 * 1000).toISOString()
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io'
        }
      })
    }

    recentDonations.push(now.toISOString())
    await redis.set(ipKey, JSON.stringify(recentDonations), { ex: 24 * 60 * 60 })

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
