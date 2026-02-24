import type { Express, Request, Response, NextFunction } from "express";

/**
 * Middleware to require authentication
 * Returns 401 if session is not authenticated
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.authenticated) {
    return res.status(401).json({ message: "Unauthorized - please log in" });
  }
  next();
};

/**
 * Register authentication routes
 */
export const registerAuthRoutes = (app: Express) => {
  // POST /api/auth/login - Authenticate with password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { password } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminPassword) {
        return res.status(500).json({ message: "Server not configured for authentication" });
      }

      if (password !== adminPassword) {
        return res.status(401).json({ message: "Incorrect password" });
      }

      // Set session as authenticated
      req.session.authenticated = true;
      await req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to save session" });
        }
        res.json({ message: "Logged in successfully" });
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // POST /api/auth/logout - Destroy session
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // GET /api/auth/status - Check authentication status
  app.get("/api/auth/status", (req, res) => {
    res.json({
      authenticated: req.session?.authenticated ?? false,
    });
  });
};
