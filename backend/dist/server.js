"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./env");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const node_1 = require("better-auth/node");
const better_auth_1 = require("./lib/auth/better-auth");
const routes_1 = require("./http/routes");
const security_1 = require("./http/security");
const app = (0, express_1.default)();
const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
app.disable("x-powered-by");
app.use((0, cors_1.default)({
    origin: [frontendOrigin, `http://localhost:${port}`],
    credentials: true
}));
app.use(security_1.applySecurityHeaders);
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "rbabikerentals-backend" });
});
const authHandler = (0, node_1.toNodeHandler)(better_auth_1.auth);
app.all("/api/auth", (req, res) => {
    void authHandler(req, res);
});
app.all("/api/auth/*", (req, res) => {
    void authHandler(req, res);
});
(0, routes_1.registerApiRoutes)(app);
app.use(express_1.default.static(path_1.default.resolve(process.cwd(), "public")));
const frontendDist = path_1.default.resolve(process.cwd(), "frontend", "dist");
app.use(express_1.default.static(frontendDist));
app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
        next();
        return;
    }
    res.sendFile(path_1.default.join(frontendDist, "index.html"), (error) => {
        if (error) {
            next();
        }
    });
});
app.use((_req, res) => {
    res.status(404).json({
        ok: false,
        error: { code: "not_found", message: "Route not found." }
    });
});
app.listen(port, () => {
    console.log(`RBA backend listening on http://localhost:${port}`);
});
