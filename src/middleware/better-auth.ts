import { createAuth } from "../lib/auth";
import type { Context, MiddlewareHandler } from "hono";

export const betterAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const auth = createAuth(c.env);
  c.set("betterAuth", auth);
  await next();
};

export const requireAuthBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get("betterAuth");
  const session = await auth.api.getSession({ 
    headers: c.req.raw.headers 
  });
  
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  c.set("betterUser", session.user);
  c.set("betterSession", session.session);
  await next();
};

export const requireAdminBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get("betterAuth");
  const session = await auth.api.getSession({ 
    headers: c.req.raw.headers 
  });
  
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  if (session.user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  c.set("betterUser", session.user);
  c.set("betterSession", session.session);
  await next();
};

export const requireContributorBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get("betterAuth");
  const session = await auth.api.getSession({ 
    headers: c.req.raw.headers 
  });
  
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  if (session.user.role !== "admin" && session.user.role !== "contributor") {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  c.set("betterUser", session.user);
  c.set("betterSession", session.session);
  await next();
};