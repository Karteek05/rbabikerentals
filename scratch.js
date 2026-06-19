require("dotenv").config({ path: ".env.local" });
const { betterAuth } = require("better-auth");

try {
  const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true }
  });
  console.log("betterAuth initialized successfully");
} catch (e) {
  console.error("Initialization error:", e);
}
