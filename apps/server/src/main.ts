import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { RequestHandler } from "http-proxy-middleware";
import { arxivSearch } from "./modules/arxiv/search";
import { requireJwt } from "./modules/auth/require-jwt";
import { hitsApi } from "./modules/hits/api";
import { hitsSignIn } from "./modules/hits/sign-in";
import { hitsSignInStatus } from "./modules/hits/sign-in-status";
import { hitsSignOut } from "./modules/hits/sign-out";
import { hitsToken } from "./modules/hits/token";
import { hitsUATSearch } from "./modules/hits/uat-search";
import { validateHitsToken } from "./modules/hits/validate-hits-token";
import { logError } from "./modules/logging/log-error";
import { logRoute } from "./modules/logging/log-route";
import { chat } from "./modules/openai/chat";
import { completions } from "./modules/openai/completion";
import { getGpt35Dev16kSpecs, getGpt35DevSpecs, getGpt35ProdSpecs, getGpt4Dev32kSpecs, getGpt4Dev8kSpecs } from "./modules/openai/default-spects";
import { embedding } from "./modules/openai/embedding";
import { plexChat } from "./modules/openai/plex-chat";
import { rateLimit } from "./modules/rate-limit/rate-limit";
import { webCrawl } from "./modules/web/crawl";
import { webSearch } from "./modules/web/search";
import { withGracefulShutdown } from "./utils/graceful-shutdown";

dotenv.config();

const port = process.env.PORT || 5201;
const app = express();

app.use(cors());

// proxy middleware must be registered before express.json()
// ref: https://github.com/chimurai/http-proxy-middleware/issues/320
app.use("/hits/api", [
  requireJwt,
  hitsApi,
  ((req, res, next) => {
    console.log("!!!!!!!");
    next();
  }) as RequestHandler,
]);
app.use("/hits/search/claims", [validateHitsToken, hitsUATSearch("/indexes/hits-claims/docs/search?api-version=2021-04-30-Preview")]);

app.use(express.json());

app.post("/openai/plexchat", [
  validateHitsToken,
  plexChat({
    endpoints: [
      { endpoint: process.env.OPENAI_CHAT_ENDPOINT!, key: process.env.OPENAI_API_PROD_KEY!, ...getGpt35ProdSpecs() },
      { endpoint: process.env.OPENAI_CHAT_ENDPOINT_V35!, key: process.env.OPENAI_API_DEV_KEY!, ...getGpt35DevSpecs() },
      { endpoint: process.env.OPENAI_CHAT_ENDPOINT_V35_16K!, key: process.env.OPENAI_API_DEV_KEY!, ...getGpt35Dev16kSpecs() },
      { endpoint: process.env.OPENAI_CHAT_ENDPOINT_V4_8K!, key: process.env.OPENAI_API_DEV_KEY!, ...getGpt4Dev8kSpecs() },
      { endpoint: process.env.OPENAI_CHAT_ENDPOINT_V4_32K!, key: process.env.OPENAI_API_DEV_KEY!, ...getGpt4Dev32kSpecs() },
    ],
  }),
]);
app.post("/openai/completions", [
  rateLimit(120),
  validateHitsToken,
  completions({
    endpoint: process.env.OPENAI_COMPLETION_ENDPOINT!,
    key: process.env.OPENAI_API_DEV_KEY!,
  }),
]);
// chat is actuall limited to 300 rpm. but response time seems unstable at that rate
app.post("/openai/chat", [rateLimit(300), validateHitsToken, chat({ endpoint: process.env.OPENAI_CHAT_ENDPOINT!, key: process.env.OPENAI_API_PROD_KEY! })]);
app.post("/openai/chat/v3.5-turbo", [
  rateLimit(300),
  validateHitsToken,
  chat({ endpoint: process.env.OPENAI_CHAT_ENDPOINT!, key: process.env.OPENAI_API_PROD_KEY! }),
]);
app.post("/openai/chat/v4-8k", [
  rateLimit(1),
  validateHitsToken,
  chat({ endpoint: process.env.OPENAI_CHAT_ENDPOINT_V4_8K!, key: process.env.OPENAI_API_DEV_KEY! }),
]);
app.post("/openai/chat/v4-32k", [
  rateLimit(1),
  validateHitsToken,
  chat({ endpoint: process.env.OPENAI_CHAT_ENDPOINT_V4_32K!, key: process.env.OPENAI_API_DEV_KEY! }),
]);
app.post("/openai/embeddings", [
  rateLimit(300),
  validateHitsToken,
  embedding({ endpoint: process.env.OPENAI_CHAT_ENDPOINT_V4_32K!, key: process.env.OPENAI_API_PROD_KEY! }),
]);

app.post("/web/search", [validateHitsToken, webSearch]);
app.post("/web/crawl", [validateHitsToken, webCrawl]);

app.post("/arxiv/search", [validateHitsToken, arxivSearch]);

app.post("/hits/token", hitsToken);
app.post("/hits/signinstatus", hitsSignInStatus);
app.post("/hits/signin", hitsSignIn);
app.post("/hits/signout", hitsSignOut);

app.use(logRoute);
app.use(logError);

withGracefulShutdown(app.listen(port));

console.log(`[auth-server] Listening at port ${port}`);
