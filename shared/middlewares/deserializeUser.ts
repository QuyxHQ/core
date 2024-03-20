import { get } from "lodash";
import { NextFunction, Response, Request } from "express";
import { verifyJWT } from "../utils/jwt";
import { reIssueAccessToken } from "../../modules/session/service";
import { setCookie } from "../utils/helpers";
import { QUYX_USER } from "../utils/constants";

async function deserializeUser(req: Request, res: Response, next: NextFunction) {
  const accessToken =
    get(req, "cookies.accessToken") ||
    get(req, "cookies.sdk_accessToken") ||
    get(req, "headers.authorization", "").replace(/^Bearer\s/, "");

  const refreshToken =
    get(req, "cookies.refreshToken") ||
    get(req, "cookies.sdk_refreshToken") ||
    get(req, "headers.x-refresh");

  if (!accessToken) return next();
  const { decoded, expired } = verifyJWT(accessToken);

  if (decoded) {
    res.locals.meta = decoded;
    return next();
  }

  if (expired && refreshToken) {
    const response = await reIssueAccessToken(refreshToken as string);
    if (response) {
      if (response.role === QUYX_USER.SDK_USER) {
        res.setHeader("x-sdk-access-token", response.accessToken);
        setCookie(res, "sdk_accessToken", response.accessToken, 5 * 60 * 1000);
      } else {
        res.setHeader("x-access-token", response.accessToken);
        setCookie(res, "accessToken", response.accessToken, 5 * 60 * 1000);
      }

      const result = verifyJWT(response.accessToken);
      res.locals.meta = result.decoded;
    }

    return next();
  }

  return next();
}

export default deserializeUser;
