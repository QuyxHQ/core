import express, { Request, Response } from "express";
import qs from "qs";
import { get } from "lodash";
import axios from "axios";
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

    const { data: githubUser } = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return githubUser as GitHubUser;
  } catch (e: any) {
    throw new Error(e.message || "unable to complete sign in");
  }
}

async function getGoogleOAuthTokens({ code }: { code: string }) {
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    code,
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    redirect_uri: config.GOOGLE_REDIRECT_URL,
    grant_type: "authorization_code",
  };

  try {
    const res = await axios.post(url, qs.stringify(values), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return res.data as {
      id_token: string;
      access_token: string;
      refresh_token: string;
      scope: string;
      expires_in: number;
    };
  } catch (e: any) {
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
  const rootURL = `https://accounts.google.com/a/oauth2/v2/auth`;

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
    if (!code) throw new Error("Code is missing in requestƒ");

    // get id & access token from code
    const { id_token, access_token } = await getGoogleOAuthTokens({ code });

    // get user with tokens
    const { data: googleUser } = await axios.get<GoogleUser>(
      `https://www.googleapis.com/oauth2/v1/userInfo?alt=json&access_token=${access_token}`,
      {
        headers: {
          Authorization: `Bearer ${id_token}`,
        },
      }
    );

    if (!googleUser.verified_email) throw new Error("Google account is not yet verified");
    const existingDev = await findDev({ email: googleUser.email });
    if (existingDev && existingDev.provider !== "google") {
      throw new Error(
        `Account already exists with this email address, provider: ${existingDev.provider}`
      );
    }

    // upsert the user
    const dev = await upsertDev(
      { email: googleUser.email },
      {
        email: googleUser.email,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
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
