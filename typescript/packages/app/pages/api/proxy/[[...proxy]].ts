import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { X_IMPERSONATE_HEADER } from "@fgpt/precedent-iso";
import type { NextApiRequest, NextApiResponse } from "next";

import { parseCookies } from "../../../src/services/parse-cookies";
import { SERVER_SETTINGS } from "../../../src/settings";

async function proxy(req: NextApiRequest, res: NextApiResponse) {
  const proxy = (() => {
    const path = req.query.proxy ?? [];
    const asArray = Array.isArray(path) ? path : [path];
    return asArray.join("/");
  })();

  const { accessToken } = await getAccessToken(req, res);

  const method = req.method ?? "GET";
  const url = `${SERVER_SETTINGS.publicApiEndpoint}/api/${proxy}`;
  const cookies = parseCookies(req.cookies);

  try {
    const response = await fetch(
      url,

      {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(cookies[X_IMPERSONATE_HEADER]
            ? { [X_IMPERSONATE_HEADER]: cookies[X_IMPERSONATE_HEADER] }
            : {}),
        },
        ...(req.body ? { body: JSON.stringify(req.body) } : {}),
      },
    );
    res.status(response.status).json(await response.json());
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error });
  }
}

export default withApiAuthRequired(proxy);
