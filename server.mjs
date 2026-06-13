import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

process.on("unhandledRejection", (reason) => {
  console.error("[velora-bundles] unhandledRejection:", reason);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8080;
const host = "0.0.0.0";

const app = express();
app.disable("x-powered-by");

app.get("/healthcheck", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.APP_VERSION ?? "1.0.0",
    environment: process.env.NODE_ENV ?? "development",
  });
});

app.listen(port, host, () => {
  console.log(`[velora-bundles] listening on http://${host}:${port}`);
});

async function attachReactRouter() {
  try {
    const buildPath = path.join(__dirname, "build/server/index.js");
    const buildModule = await import(pathToFileURL(buildPath).href);
    const publicPath = buildModule.publicPath ?? "/";
    const assetsDirectory = path.resolve(
      __dirname,
      buildModule.assetsBuildDirectory ?? "build/client",
    );

    app.use(compression());
    app.use(
      path.posix.join(publicPath, "assets"),
      express.static(path.join(assetsDirectory, "assets"), {
        immutable: true,
        maxAge: "1y",
      }),
    );
    app.use(publicPath, express.static(assetsDirectory));
    app.use(express.static("public", { maxAge: "1h" }));
    app.all(
      "*",
      createRequestHandler({
        build: buildModule,
        mode: process.env.NODE_ENV ?? "production",
      }),
    );

    console.log("[velora-bundles] React Router handler attached");
  } catch (error) {
    console.error("[velora-bundles] Failed to attach React Router app:", error);
  }
}

void attachReactRouter();
