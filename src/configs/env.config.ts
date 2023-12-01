import { config } from 'dotenv';

config();

export const envConfig = {
  app: {
    url: process.env.APP_URL || 'http://localhost:3000',
  },
  database: {
    uri: process.env.DATABASE_URI || 'mongodb://localhost/nest',
  },
  port: process.env.PORT || 3000,
  jwt: {
    accessToken: {
      secret: process.env.ACCESS_TOKEN_SECRET,
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '1d',
    },
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    },
    verifyToken: {
      secret: process.env.VERIFY_TOKEN_SECRET,
      expiresIn: process.env.VERIFY_TOKEN_EXPIRES_IN || '1d',
    },
  },
  mail: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM,
  },
};
