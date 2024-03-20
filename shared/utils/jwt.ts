import jwt from "jsonwebtoken";
import config from "./config";

export function signJWT(payload: Object, options?: jwt.SignOptions) {
  return jwt.sign(payload, config.APP_PRIVATE_KEY!, {
    ...(options && options),
    algorithm: "RS256",
  });
}

export function verifyJWT(token: string) {
  try {
    const decoded = jwt.verify(token, config.APP_PUBLIC_KEY!);

    return {
      valid: true,
      expired: false,
      decoded,
    };
  } catch (e: any) {
    return {
      valid: false,
      message: e.message,
      expired: e.message == "jwt expired",
      decoded: null,
    };
  }
}
