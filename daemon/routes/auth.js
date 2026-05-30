import { extractBearerToken, loadAuthConfig, saveAuthConfig, verifyYantrAuthToken } from "../auth.js";

export default async function authRoutes(fastify) {
  fastify.get("/api/setup/status", async (_request, reply) => {
    const config = await loadAuthConfig();
    return reply.send({ success: true, configured: !!config });
  });

  fastify.post("/api/setup/admin", async (request, reply) => {
    const existing = await loadAuthConfig();
    if (existing) {
      return reply.code(409).send({ success: false, error: "Yantr is already configured" });
    }

    const { username, publicKey } = request.body || {};
    try {
      const config = await saveAuthConfig({ username, publicKey });
      return reply.code(201).send({ success: true, configured: true, username: config.username });
    } catch (error) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  fastify.post("/api/auth/login", async (request, reply) => {
    const result = await verifyYantrAuthToken(extractBearerToken(request));

    if (!result.config) {
      return reply.code(409).send({ success: false, error: "Setup required", code: "SETUP_REQUIRED" });
    }

    if (!result.ok) {
      return reply.code(401).send({ success: false, error: "Unauthorized", code: result.reason || "UNAUTHORIZED" });
    }

    return reply.send({
      success: true,
      authenticated: true,
      user: {
        username: result.config.username,
        publicKey: result.publicKey,
      },
    });
  });
}