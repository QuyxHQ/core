type QuyxUser = DateProps & {
  username: string;
  email: string | null;
  hasCompletedKYC: boolean;
  hasBlueTick: boolean;
  changedUsernameLastOn: Date | null;
  address: string;
  pfp: string | null;
  cardsCreatedCount: {
    chainId: string;
    count: number;
  }[];
  cardsSoldCount: {
    chainId: string;
    count: number;
  }[];
  cardsBoughtCount: {
    chainId: string;
    count: number;
  }[];
  emailVerificationCode: string | null;
  emailVerificationCodeExpiry: Date | null;
  boughtCards: {
    chainId: string;
    cards: string[];
  }[];
  soldCards: {
    chainId: string;
    cards: string[];
  }[];
};

type QuyxSDKUser = DateProps & {
  app: string;
  address: string;
  card: string;
  isActive: boolean;
};

type QuyxDev = DateProps & {
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  role: string;
  heardUsFrom: string;
  password: string;
  verifiedPasswordLastOn: Date | null;
  isEmailVerified: boolean;
  emailVerificationOTP: string | null;
  emailVerificationOTPExpiry: Date | null;
  forgetPasswordHash: string | null;
  forgetPasswordHashExpiry: Date | null;
};

type QuyxCard = DateProps & {
  owner: string;
  identifier: null | number;
  version: null | number;
  chainId: (typeof QUYX_NETWORKS)[number];
  mintedBy: string;
  tempToken: string;
  username: string;
  pfp: string;
  bio: string;
  description: stirng | null;
  isForSale: boolean;
  isAuction: boolean | null;
  maxNumberOfBids: number | null;
  aunctionEnds: Date | null;
  tags: string[] | null;
  isFlagged: boolean;
  isDeleted: boolean;
};

type QuyxBid = DateProps & {
  card: string;
  version: number;
  bidder: string;
  price: number;
  timestamp: Date;
};

type QuyxBookmark = DateProps & {
  user: string;
  card: string;
};

const QUYX_REQUEST_STATUS = ["failed", "successful"] as const;

type QuyxLog = DateProps & {
  app: string;
  dev: string;
  status: (typeof QUYX_REQUEST_STATUS)[number];
  log: string | null;
  route: string;
  responseTime: number;
};

const QUYX_USERS = ["quyx_user", "quyx_staff", "quyx_dev", "quyx_sdk_user"] as const;

type QuyxSession = DateProps & {
  identifier: string;
  role: (typeof QUYX_USERS)[number];
  isActive: boolean;
  userAgent: string | null;
};

const QUYX_NETWORKS = ["1", "56"] as const;

type QuyxApp = DateProps & {
  apiKey: string;
  clientID: string;
  owner: string;
  name: string;
  description: string;
  allowedDomains: string[] | null;
  allowedBundleIDs: string[] | null;
  blacklistedAddresses: string[] | null;
  whitelistedAddresses: string[] | null;
  isActive: boolean;
};

type QuyxLocals = {
  meta: {
    session: string;
    role: (typeof QUYX_USERS)[number];
    identifier: string;
    app?: QuyxApp & { _id: string };
  };
};

type DateProps = { createdAt?: Date; updatedAt?: Date };
type FindProps = { limit: number; page: number };
