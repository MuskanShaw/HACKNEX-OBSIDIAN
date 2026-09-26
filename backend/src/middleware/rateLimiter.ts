import rateLimit from 'express-rate-limit';

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  validate: { xForwardedForHeader: false },
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});

export const deployRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each store / IP to 5 deployments per hour
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  validate: { xForwardedForHeader: false },
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded: maximum 5 deployments allowed per hour.',
  },
});

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each client to 30 chat messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  validate: { xForwardedForHeader: false },
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded: Please wait a moment before sending another message.',
  },
});

