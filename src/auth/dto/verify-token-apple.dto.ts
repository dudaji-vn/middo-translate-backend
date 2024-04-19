type FullName = {
  familyName: string | null;
  givenName: string | null;
  middleName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
};

export type IdentityTokenPayload = {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  c_hash: string;
  email: string;
  email_verified: boolean;
  auth_time: number;
  nonce_supported: boolean;
};

export type VerifyTokenAppleDto = {
  authorizationCode: string;
  email: string | null;
  fullName: FullName;
  identityToken: string;
  realUserStatus: number;
  state: string | null;
  user: string;
};
