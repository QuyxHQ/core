import mongoose from "mongoose";
import { QUYX_USER } from "../../shared/utils/constants";
import { signJWT, verifyJWT } from "../../shared/utils/jwt";
import Session, { SessionDoc } from "./model";
import { get } from "lodash";
import { findUser } from "../user/service";
import config from "../../shared/utils/config";
import { findDev } from "../dev/service";
import { findSDKUser } from "../sdk/service";

export async function createSession(
  identifier: string,
  role: QUYX_USER,
  userAgent?: string
) {
  try {
    const session = await Session.create({
      identifier,
      role,
      userAgent,
    });

    return session.toJSON();
  } catch (e: any) {
    if (e && e instanceof mongoose.Error.ValidationError) {
      for (let field in e.errors) {
        const errorMsg = e.errors[field].message;

        throw new Error(errorMsg);
      }
    }

    throw new Error(e);
  }
}

export async function findSessions(filter: mongoose.FilterQuery<SessionDoc>) {
  try {
    const result = await Session.find(filter).lean();

    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findSession(_id: string) {
  try {
    const session = await Session.findOne({ _id });
    return session;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function updateSession(
  filter: mongoose.FilterQuery<SessionDoc>,
  update: mongoose.UpdateQuery<SessionDoc>
) {
  try {
    const result = await Session.updateOne(filter, update);

    return result.acknowledged && result.modifiedCount >= 1;
  } catch (e: any) {
    if (e && e instanceof mongoose.Error.ValidationError) {
      for (let field in e.errors) {
        const errorMsg = e.errors[field].message;

        throw new Error(errorMsg);
      }
    }

    throw new Error(e);
  }
}

export async function reIssueAccessToken(refreshToken: string) {
  const { decoded } = verifyJWT(refreshToken);

  if (!decoded || !get(decoded, "session")) return false;
  const session = await Session.findById(get(decoded, "session"));

  //# invalid session or it is not active again (logged out)
  if (!session || !session.isActive) return false;
  let data;

  if (session.role == "quyx_user") data = await findUser({ _id: session.identifier });
  if (session.role == "quyx_staff") data = null;
  if (session.role == "quyx_dev") data = await findDev({ _id: session.identifier });
  if (session.role == "quyx_sdk_user") {
    data = await findSDKUser({
      _id: session.identifier,
      isActive: true,
    });
  }

  if (!data) return false;

  const accessToken = signJWT(
    { session: session._id, role: session.role, identifier: session.identifier },
    { expiresIn: config.ACCESS_TOKEN_TTL }
  );

  return accessToken;
}
