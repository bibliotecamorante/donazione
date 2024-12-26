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
  },
  api: {
    baseUrl: 'https://donazione-rmr192ag1-bibliotecamorantes-projects.vercel.app',
    rateLimiter: '/api/rateLimiter'
  }
};

// Function to handle API requests with CORS
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

// Function to handle rate-limiting API request
config.handleRateLimit = async (email) => {
  try {
    showLoadingOverlay();
    
    const rateLimitResponse = await fetch(
      `${config.api.baseUrl}/api/rateLimiter`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify({ email })
      }
    );

    const data = await rateLimitResponse.json();
    return data;
  } catch (error) {
    console.error('Error handling rate limit:', error);
    throw error;
  } finally {
    hideLoadingOverlay();  // Assuming you have a function to hide the loading overlay
  }
};

export default config;
