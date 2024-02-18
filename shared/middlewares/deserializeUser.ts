import { get } from "lodash";
import { NextFunction, Response, Request } from "express";
import { verifyJWT } from "../utils/jwt";
import { reIssueAccessToken } from "../../modules/session/service";

async function deserializeUser(req: Request, res: Response, next: NextFunction) {
  const accessToken = get(req, "headers.authorization", "").replace(/^Bearer\s/, "");
  const refreshToken = get(req, "headers.x-refresh");

  if (!accessToken) return next();
  const { decoded, expired } = verifyJWT(accessToken);

  if (decoded) {
    res.locals.meta = decoded;
    return next();
  }

  if (expired && refreshToken) {
    const newAccessToken = await reIssueAccessToken(refreshToken as string);
    if (newAccessToken) {
      res.setHeader("x-access-token", newAccessToken);

      const result = verifyJWT(newAccessToken);
      res.locals.meta = result.decoded;
    }

    return next();
  }

  return next();
}

export default deserializeUser;
