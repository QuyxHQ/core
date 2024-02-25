import config from "./config";
import { mailerSdk } from "./mailer.class";

export async function sendKYCMail(data: { email: string; otp: string; username: string }) {
  const html = `<p>Good day from quyx</p>
  <p>This email address was used as a primary email address for a Quyx user. If this was you, kindly use the 6-digit OTP code below to complete request otherwise kindly do away with this email</p>
  <h1>${data.otp}</h1>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> ${data.username}, verify email address`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendDevKYCMail(data: { email: string; otp: string; firstName: string }) {
  const html = `<p>Hello ${data.firstName}, Good day from quyx</p>
  <p>This email address was used as an email address for a Quyx dev. If this was you, kindly use the 6-digit OTP code below to complete request otherwise kindly do away with this email</p>
  <h1>${data.otp}</h1>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx::DEV <-> verify email address`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendDevForgotPasswordMail(data: {
  email: string;
  hash: string;
  firstName: string;
}) {
  const html = `<p>Hello ${data.firstName}, Good day from quyx</p>
  <p>You just requested for a password reset mail, please if this was not you, kindly do away with this email immediately otherwise follow this link to complete password reset</p>
  <a href="${config.DEV_BASE_URL}/reset-password/${data.hash}">${config.DEV_BASE_URL}/reset-password/${data.hash}</a>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx::DEV <-> forgot password?`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendBidPlacedMail(data: {
  email: string;
  username: string;
  amount: number;
  chainId: (typeof QUYX_NETWORKS)[number];
  cardId: number;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>A new bid has been placed on your card with id of [${data.cardId}], details below</p>
  <p><strong>Chain ID: </strong>${data.chainId}</p>
  <p><strong>Amount: </strong>${data.amount} ETH</p>
  <p><strong>URL: </strong><a href="${config.CLIENT_BASE_URL}/card/${data.cardId}">view card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> Bid Notification?`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendHighestBidPlacedMail(data: {
  email: string;
  username: string;
  cardId: number;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Guess what? A new bid has just overthrown your bid on card #${data.cardId} as the highest bidder.</p>
  <p>What's the next line of action? Withdraw bid or take back your position?</p>
  <p><a href="${config.CLIENT_BASE_URL}/card/${data.cardId}">View Card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> A new highest bidder?`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendCardTransferredToMail(data: {
  email: string;
  username: string;
  chainId: (typeof QUYX_NETWORKS)[number];
  cardId: number;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Card #${data.cardId} ownership has been transferred to you! Happy owning :-)</p>
  <p><strong>Chain ID: </strong>${data.chainId}</p>
  <p><strong>URL: </strong><a href="${config.CLIENT_BASE_URL}/card/${data.cardId}">view card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> Card #${data.cardId} is now yours 🎉`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendCardBoughtMail(data: {
  email: string;
  username: string;
  chainId: (typeof QUYX_NETWORKS)[number];
  cardId: number;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Card #${data.cardId} ownership has been bought and ownership has been transferred to it's new owner</p>
  <p><strong>Chain ID: </strong>${data.chainId}</p>
  <p><strong>URL: </strong><a href="${config.CLIENT_BASE_URL}/card/${data.cardId}">view card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> Card #${data.cardId} has been purchased`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendAuctionEndedMail(data: {
  email: string;
  username: string;
  chainId: (typeof QUYX_NETWORKS)[number];
  cardId: number;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Card #${data.cardId} which you placed for auction has elapsed it's time limit and it's waiting for you to end it. If nothing gets done after 24 hours, we will have to end it on our end.</p>
  <p><strong>Chain ID: </strong>${data.chainId}</p>
  <p><strong>URL: </strong><a href="${config.CLIENT_BASE_URL}/card/${data.cardId}">view card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> Card #${data.cardId} Auction has elapsed`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}
