import config from "./config";
import { mailerSdk } from "../class/mailer.class";

export async function sendKYCMail(data: { email: string; otp: string; username: string }) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>This email address was used as a primary email address for a Quyx user. If this was you, kindly use the 6-digit OTP code below to complete your request otherwise kindly do away with this email</p>
  <h1>${data.otp}</h1>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> ${data.username}, verify your email address`;

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
  card: QuyxCard;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>A new bid has been placed on your card with id of [${data.card.identifier}]</p>
  <p><strong>Card username: </strong>${data.card.username} SOL</p>
  <p><strong>Card description: </strong>${data.card.description}</p>
  <p><strong>Tags: </strong>${data.card.tags?.toString()}</p>
  <p><strong>Bid Amount: </strong>${data.amount} SOL</p>
  <p>
    <strong>URL: </strong>
    <a href="${config.CLIENT_BASE_URL}/card/${data.card.identifier}">view card</a>
  </p>
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
  card: QuyxCard;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Guess what? A new bid has has just overthrown your bid on card #${data.card.identifier} as the highest bidder.</p>
  <p>What's the next line of action? Withdraw bid or take back your position?</p>
  <p><a href="${config.CLIENT_BASE_URL}/card/${data.card.identifier}">View Card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> A new highest bidder 😱`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendCardTransferredToMail(data: {
  email: string;
  username: string;
  card: QuyxCard;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Card #${data.card.identifier} ownership has been transferred to you! Happy owning :-)</p>
  <p><strong>Card username: </strong>${data.card.username} SOL</p>
  <p><strong>Card description: </strong>${data.card.description}</p>
  <p><strong>Tags: </strong>${data.card.tags?.toString()}</p>
  <p>
    <strong>URL: </strong>
    <a href="${config.CLIENT_BASE_URL}/card/${data.card.identifier}">view card</a>
  </p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> Card #${data.card.identifier} is now yours 🎉`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendCardBoughtMail(data: {
  email: string;
  username: string;
  card: QuyxCard;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Card #${data.card.identifier} has been bought and ownership has been transferred to it's new owner</p>
  <p><strong>URL: </strong><a href="${config.CLIENT_BASE_URL}/card/${data.card.identifier}">view card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> Your Card, #${data.card.identifier} has been purchased`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendAuctionEndedMail(data: {
  email: string;
  username: string;
  card: QuyxCard;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Card #${data.card.identifier} which you placed for auction has elapsed it's time limit and it's waiting for you to end it. If nothing gets done after 24 hours, we will have to end it on your behalf.</p>
  <p><strong>URL: </strong><a href="${config.CLIENT_BASE_URL}/card/${data.card.identifier}">view card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> Card #${data.card.identifier} Auction has elapsed`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}

export async function sendReferralLinkUsed(data: {
  email: string;
  username: string;
  card: QuyxCard;
}) {
  const html = `<p>Hello ${data.username}, Good day from quyx</p>
  <p>Good news! Your referall link has just been used to purchase a card on Quyx. Brief description found below, for more info check your Quyx's referral page</p>
  <p><strong>URL: </strong><a href="${config.CLIENT_BASE_URL}/card/${data.card.identifier}">view card</a></p>
  <br/>
  <br/>
  <p>Best Regards,</p>
  <p>Quyx Team ✨</p>`;
  const subject = `Quyx <-> Yippe! You just got a referral bonus`;

  await mailerSdk.send({ receiver: data.email, subject, html });
}
