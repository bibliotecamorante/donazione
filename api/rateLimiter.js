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
  // Gestione CORS preflight
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

  // Verifica metodo HTTP
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed',
      details: 'Only POST requests are allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io'
      }
    })
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://bibliotecamorante.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  try {
    // Ottieni IP del client
    const ip = req.headers.get('x-real-ip') || 
               req.headers.get('x-forwarded-for')?.split(',')[0] ||
               'unknown-ip'

    if (ip === 'unknown-ip') {
      return new Response(JSON.stringify({ 
        error: 'Invalid request',
        message: 'Could not determine client IP address' 
      }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Chiave per Redis
    const ipKey = `donation:ip:${ip}`
    
    // Ottieni donazioni precedenti
    let lastDonations = []
    try {
      const storedDonations = await redis.get(ipKey)
      if (storedDonations) {
        lastDonations = JSON.parse(storedDonations)
      }
    } catch (redisError) {
      console.error('Redis get error:', redisError)
      return new Response(JSON.stringify({
        error: 'Database error',
        message: 'Error checking donation history'
      }), {
        status: 500,
        headers: corsHeaders
      })
    }

    // Verifica limite donazioni nelle ultime 24 ore
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000))
    
    const recentDonations = lastDonations.filter(timestamp => 
      new Date(timestamp) > oneDayAgo
    )

    if (recentDonations.length >= 2) {
      const oldestDonation = new Date(Math.min(...recentDonations.map(d => new Date(d))))
      const nextAvailable = new Date(oldestDonation.getTime() + (24 * 60 * 60 * 1000))
      
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Too many donation attempts',
        nextAvailable: nextAvailable.toISOString()
      }), {
        status: 429,
        headers: corsHeaders
      })
    }

    // Aggiorna lista donazioni
    recentDonations.push(now.toISOString())
    
    try {
      await redis.set(ipKey, JSON.stringify(recentDonations), {
        ex: 24 * 60 * 60 // Scade dopo 24 ore
      })
    } catch (redisError) {
      console.error('Redis set error:', redisError)
      return new Response(JSON.stringify({
        error: 'Database error',
        message: 'Error updating donation history'
      }), {
        status: 500,
        headers: corsHeaders
      })
    }

    return new Response(JSON.stringify({
      success: true,
      remaining: 2 - recentDonations.length
    }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Rate limiter general error:', error)
    return new Response(JSON.stringify({
      error: 'Server error',
      message: 'An unexpected error occurred',
      details: error.message
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
}
