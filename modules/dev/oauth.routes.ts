import express, { Request, Response } from "express";
import qs from "qs";
import { get } from "lodash";
import jwt from "jsonwebtoken";
import axios, { AxiosError } from "axios";
import config from "../../shared/utils/config";
import log from "../../shared/utils/log";
import { findDev, upsertDev } from "./service";
import { QUYX_USER } from "../../shared/utils/constants";
import { signJWT } from "../../shared/utils/jwt";
import { createSession } from "../session/service";
import { setCookie } from "../../shared/utils/helpers";

const router = express.Router();

async function getGitHubUser({ code }: { code: string }) {
  try {
    const { data } = await axios.post(
      `https://github.com/login/oauth/access_token?client_id=${config.GITHUB_CLIENT_ID}&client_secret=${config.GITHUB_CLIENT_SECRET}&code=${code}`
    );

    const decoded = qs.parse(data);
    const accessToken = decoded.access_token;

    const { data: githubUser } = await axios.get<GitHubUser>("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!githubUser.email) {
      const { data } = await axios.get<{ email: string; primary: boolean; verified: true }[]>(
        "https://api.github.com/user/emails",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      githubUser.email = data.find((item) => item.verified == true && item.primary == true)
        ?.email as any;
    }

    return githubUser as GitHubUser;
  } catch (e: any) {
    throw new Error(e.message || "unable to complete sign in");
  }
}

async function getGoogleOAuthUser({ code }: { code: string }) {
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    code,
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    redirect_uri: config.GOOGLE_REDIRECT_URL,
    grant_type: "authorization_code",
  };

  try {
    //# getting tokens
    const { data } = await axios.post<{ id_token: string; [key: string]: any }>(
      url,
      new URLSearchParams(values)
    );

    //# get user info from jwt >>>>
    const payload = jwt.decode(data.id_token) as GoogleUser;
    return payload;
  } catch (e: any) {
    console.log("error getting tokens");
    if (e instanceof AxiosError) {
      console.log(e.response?.data);
    }

    throw new Error(e.message);
  }
}

//# initialize github oauth
router.get("/init/github", async function (_: any, res: Response) {
  const rootURL = `https://github.com/login/oauth/authorize`;

  const options = {
    client_id: config.GITHUB_CLIENT_ID,
    redirect_uri: config.GITHUB_REDIRECT_URL,
    scope: "user:email",
  };

  const qs = new URLSearchParams(options);
  return res.redirect(`${rootURL}?${qs.toString()}`);
});

//# authenticate github oauth
router.get("/auth/github", async function (req: Request, res: Response) {
  try {
    const code = get(req, "query.code");

    if (!code) throw new Error("Code not passed");
    const gitHubUser = await getGitHubUser({ code: code as string });

    if (!gitHubUser.email) throw new Error("Github email must be linked with an email");
    const existingDev = await findDev({ email: gitHubUser.email });
    if (existingDev && existingDev.provider !== "github") {
      throw new Error(
        `Account already exists with this email address, provider: ${existingDev.provider}`
      );
    }

    // upsert the user
    const name = gitHubUser.name.split(" ");
    const dev = await upsertDev(
      { email: gitHubUser.email },
      {
        email: gitHubUser.email,
        firstName: name[0],
        lastName: name[1] || null,
        provider: "github",
        isEmailVerified: true,
      }
    );

    // create a  session
    const session = await createSession(dev._id, QUYX_USER.DEV, req.get("user-agent"));

    //# creating the payload
    const payload = {
      session: session._id,
      role: QUYX_USER.DEV,
      identifier: dev._id,
    };

    // create access & refresh token
    const accessToken = signJWT(payload, { expiresIn: config.ACCESS_TOKEN_TTL });
    const refreshToken = signJWT(payload, { expiresIn: config.REFRESH_TOKEN_TTL });

    // set cookie
    setCookie(res, "accessToken", accessToken, 5 * 60 * 1000); // 5 minutes
    setCookie(res, "refreshToken", refreshToken, 365 * 24 * 60 * 60 * 1000); // 1yr

    // redirect back to client
    return res.redirect(config.DEV_BASE_URL);
  } catch (e: any) {
    log.error(e, "Unable to complete github OAuth signin");
    return res.redirect(
      `${config.DEV_BASE_URL}/oauth/error?provider=github&message=${e.message}`
    );
  }
});

//# initialize google oauth
router.get("/init/google", async function (_: any, res: Response) {
  const rootURL = `https://accounts.google.com/o/oauth2/auth`;

  const options = {
    redirect_uri: config.GOOGLE_REDIRECT_URL,
    client_id: config.GOOGLE_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);
  return res.redirect(`${rootURL}?${qs.toString()}`);
});

//# authenticate google oauth
router.get("/auth/google", async function (req: Request, res: Response) {
  try {
    // get code
    const code = get(req, "query.code") as string | undefined;
    if (!code) throw new Error("Code is missing in request");

    const googleUser = await getGoogleOAuthUser({ code });

    if (!googleUser.email_verified) throw new Error("Google account is not yet verified");
    const existingDev = await findDev({ email: googleUser.email });
    if (existingDev && existingDev.provider !== "google") {
      throw new Error(
        `Account already exists with this email address, provider: ${existingDev.provider}`
      );
    }

    // upsert the user
    const name = googleUser.name.split(" ");
    const dev = await upsertDev(
      { email: googleUser.email },
      {
        email: googleUser.email,
        firstName: name[0],
        lastName: name[1] || null,
        provider: "google",
        isEmailVerified: true,
      }
    );

    // create a  session
    const session = await createSession(dev._id, QUYX_USER.DEV, req.get("user-agent"));

    //# creating the payload
    const payload = {
      session: session._id,
      role: QUYX_USER.DEV,
      identifier: dev._id,
    };

    // create access & refresh token
    const accessToken = signJWT(payload, { expiresIn: config.ACCESS_TOKEN_TTL });
    const refreshToken = signJWT(payload, { expiresIn: config.REFRESH_TOKEN_TTL });

    // set cookie
    setCookie(res, "accessToken", accessToken, 5 * 60 * 1000); // 5 minutes
    setCookie(res, "refreshToken", refreshToken, 365 * 24 * 60 * 60 * 1000); // 1yr

    // redirect back to client
    return res.redirect(config.DEV_BASE_URL);
  } catch (e: any) {
    log.error(e, "Unable to complete google OAuth signin");
    return res.redirect(
      `${config.DEV_BASE_URL}/oauth/error?provider=google&message=${e.message}`
    );
  }
});
export = router;
