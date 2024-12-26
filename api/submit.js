// File: scripts/config.js (questo rimane invariato)
const config = {
  emailjs: {
    serviceId: window?.env?.EMAILJS_SERVICE_ID || 'service_yepi8uu',
    templateId: window?.env?.EMAILJS_TEMPLATE_ID || 'template_s1jmd7r',
    publicKey: window?.env?.EMAILJS_PUBLIC_KEY || 'z6OeY42qSulJ-8EcS'
  },
  googleBooks: {
    apiKey: window?.env?.GOOGLE_BOOKS_API_KEY || 'AIzaSyCHJzsPtp8CfKeUag-vvyTxobwR_DmYink',
    apiOptions: {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  },
  library: {
    email: window?.env?.LIBRARY_EMAIL || 'bibliotecamorante@gmail.com'
  }
};

// Aggiungi funzione per gestire le chiamate API con CORS
config.fetchWithCORS = async (url, options = {}) => {
  const defaultOptions = {
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export default config;

// File: api/submit.js (questo è il file completamente aggiornato)
import { createClient } from '@vercel/edge-config';
import config from '../scripts/config.js';

// Crea il client Edge Config una sola volta
let edgeConfig;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Inizializza Edge Config se non è già stato fatto
    if (!edgeConfig) {
      edgeConfig = createClient(process.env.EDGE_CONFIG);
    }

    const userIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.connection.remoteAddress;
    const today = new Date().toISOString().split('T')[0];
    const key = `donations:${userIp}:${today}`;

    // Get current count from Edge Config
    let count = await edgeConfig.get(key) || 0;

    // Check if limit exceeded
    if (count >= 2) {
      return res.status(429).json({ 
        error: 'Limite giornaliero raggiunto. Riprova domani.',
        remainingTime: getRemainingTime()
      });
    }

    // Increment count
    await edgeConfig.set(key, count + 1, {
      ttl: 86400 // Scade dopo 24 ore
    });

    // Forward the request to EmailJS
    const emailData = {
      service_id: process.env.EMAILJS_SERVICE_ID || config.emailjs.serviceId,
      template_id: process.env.EMAILJS_TEMPLATE_ID || config.emailjs.templateId,
      user_id: process.env.EMAILJS_PUBLIC_KEY || config.emailjs.publicKey,
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
      throw new Error(`EmailJS error: ${await response.text()}`);
    }

    res.status(200).json({ 
      success: true,
      remainingSubmissions: 2 - (count + 1)
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Si è verificato un errore. Riprova più tardi.' 
    });
  }
}

function getRemainingTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  return Math.ceil((tomorrow - now) / 1000 / 60); // Minuti rimanenti
}

// File: vercel.json (questo rimane invariato)
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Credentials",
          "value": "true"
        },
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://donazione-delta.vercel.app"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET,POST,OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
        }
      ]
    }
  ],
  "buildCommand": "npm run build",
  "functions": {
    "api/submit.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}

// File: .gitignore (questo rimane invariato)
# Config files with sensitive data
.env
.env.local
.env.*.local
# Environment variables
.env.development
.env.production
# IDE files
.idea/
.vscode/
*.sublime-project
*.sublime-workspace
# OS files
.DS_Store
Thumbs.db
# API keys and secrets
*.key
*.pem
*.p12
*.pfx
# Vercel
.vercel
