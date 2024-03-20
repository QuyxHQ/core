type QuyxUser = Base & {
  username: string;
  email: string | null;
  hasCompletedKYC: boolean;
  hasBlueTick: boolean;
  changedUsernameLastOn: Date | null;
  address: string;
  pfp: string | null;
  emailVerificationCode: string | null;
  emailVerificationCodeExpiry: Date | null;
  boughtCards: string[];
  soldCards: string[];
};

type QuyxSDKUser = Base & {
  app: string;
  address: string;
  card: string;
  isActive: boolean;
};

type QuyxDev = Base & {
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  role: string;
  heardUsFrom: string;
  provider: "google" | "email" | "github";
  password: string;
  verifiedPasswordLastOn: Date | null;
  isEmailVerified: boolean;
  emailVerificationOTP: string | null;
  emailVerificationOTPExpiry: Date | null;
  forgetPasswordHash: string | null;
  forgetPasswordHashExpiry: Date | null;
};

type QuyxCard = Base & {
  owner: string;
  identifier: null | string;
  version: number;
  mintedBy: string;
  tempToken: string;
  username: string;
  pfp: string;
  bio: string;
  description: stirng | null;
  isForSale: boolean;
  isAuction: boolean | null;
  listingPrice: number | null;
  maxNumberOfBids: number | null;
  auctionEnds: Date | null;
  tags: string[] | null;
  isFlagged: boolean;
  isDeleted: boolean;
};

type QuyxBid = Base & {
  card: string;
  version: number;
  bidder: string;
  price: number;
  timestamp: Date;
};

type QuyxBookmark = Base & {
  user: string;
  card: string;
};

const QUYX_REQUEST_STATUS = ["failed", "successful"] as const;

type QuyxLog = Base & {
  app: string;
  dev: string;
  status: (typeof QUYX_REQUEST_STATUS)[number];
  log: string | null;
  route: string;
  responseTime: number;
  date: Date;
};

const QUYX_USERS = ["quyx_user", "quyx_staff", "quyx_dev", "quyx_sdk_user"] as const;

type QuyxSession = Base & {
  identifier: string;
  role: (typeof QUYX_USERS)[number];
  isActive: boolean;
  userAgent: string | null;
};

type QuyxApp = Base & {
  apiKey: string;
  clientID: string;
  owner: string;
  name: string;
  description: string;
  webhook: string | null;
  url: string;
  allowedDomains: string[] | null;
  allowedBundleIDs: string[] | null;
  blacklistedAddresses: string[] | null;
  whitelistedAddresses: string[] | null;
  isActive: boolean;
};

type QuyxReferral = Base & {
  user: string;
  card: string;
  clicks: number;
  isActive: boolean;
  won: boolean;
  bidsPlaced: number;
};

type QuyxLocals = {
  meta: {
    session: string;
    role: (typeof QUYX_USERS)[number];
    identifier: string;
  };
  app: QuyxApp & { _id: string };
  nonce?: string;
};

type Base = { createdAt?: Date; updatedAt?: Date };
type FindProps = { limit: number; page: number };

type QuyxAiWaitlist = Base & {
  dev: string;
};

type QuyxNonce = Base & {
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

const QUYX_EVENTS = [
  "event.card_deleted",
  "event.card_updated",
  "event.card_ownershiptransferred",
  "event.card_listed",
  "event.card_disconnected",
] as const;

type CachedData = {
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

type SignMessage = {
  domain?: string;
  address: string;
  chainId: string;
  nonce: string;
  statement?: string;
  issuedAt: string;
  expirationTime: string;
};

type GoogleUser = {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
};

type GitHubUser = {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  name: string;
  company: null;
  blog: string;
  location: string;
  email: null;
  hireable: null;
  bio: null;
  twitter_username: null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: Date;
  updated_at: Date;
};
