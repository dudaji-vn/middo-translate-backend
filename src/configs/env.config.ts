import { config } from 'dotenv';

config();

export const envConfig = {
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
  },
};
