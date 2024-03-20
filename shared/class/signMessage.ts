import bs58 from "bs58";
import nacl from "tweetnacl";
import { dateUTC } from "../utils/helpers";

export class SigninMessage {
  domain: any;
  address: any;
  nonce: any;
  statement: any;
  chainId: any;
  issuedAt: any;
  expirationTime: any;

  constructor(props: SignMessage) {
    this.domain = props.domain || window.location.host;
    this.address = props.address;
    this.nonce = props.nonce;
    this.statement =
      props.statement ||
      "Clicking Sign or Approve only means you have approved this wallet is owned by you. This request will not trigger any blockchain transaction or cost any gas fee";
    this.chainId = props.chainId;
    this.issuedAt = props.issuedAt || dateUTC().toISOString();
    this.expirationTime = props.expirationTime;
  }

  prepare() {
    return `${this.domain}\n${this.statement}\n\nNonce: ${this.nonce}\nChain ID${this.chainId}\nIssued At: ${this.issuedAt}\nExpiration Time: ${this.expirationTime}`;
  }

  validate(signature: string) {
    const msg = this.prepare();
    const signatureUint8 = bs58.decode(signature);
    const msgUint8 = new TextEncoder().encode(msg);
    const pubKeyUint8 = bs58.decode(this.address);

    // Check if the message has expired
    const currentTime = new Date().getTime();
    const issuedAt = new Date(this.issuedAt).getTime();
    const expirationTime = this.expirationTime
      ? new Date(this.expirationTime).getTime()
      : Infinity;

    // Message is not valid (expired or not yet issued)
    if (currentTime < issuedAt || currentTime >= expirationTime) return false;

    return nacl.sign.detached.verify(msgUint8, signatureUint8, pubKeyUint8);
  }
}
