import { config } from 'dotenv';

config();

export const envConfig = {
  app: {
    url: process.env.CLIENT_URL || 'http://localhost:3000',
    serverUrl: process.env.SERVER_URL || 'http://localhost:8080',
    name: process.env.APP_NAME || 'Nest',
    extension_name: process.env.APP_EXTENSION || 'Middo Extension',
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
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '365d',
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
    name: process.env.EMAIL_NAME,
  },
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    mobileClientId: process.env.GOOGLE_MOBILE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
  },

  password: {
    RegExp: /^(?=.*[A-Z]).{1,}$/,
    errorMessage: 'Password must contain at least one uppercase letter',
  },

  firebase: {
    credentials: {
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
      privateKey: process.env.FIREBASE_PRIVATE_KEY as string,
      projectId: process.env.FIREBASE_PROJECT_ID as string,
    },
  },
  helpDesk: {
    room: {
      expireIn: process.env.HELP_DESK_ROOM_EXPIRES_IN || 60 * 60 * 24,
    },
  },
};
