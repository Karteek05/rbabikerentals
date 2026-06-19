"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptRoute = adaptRoute;
function toWebHeaders(headers) {
    const webHeaders = new Headers();
    for (const [key, value] of Object.entries(headers)) {
        if (Array.isArray(value)) {
            value.forEach((item) => webHeaders.append(key, item));
        }
        else if (value !== undefined) {
            webHeaders.set(key, value);
        }
    }
    return webHeaders;
}
function readBody(req) {
    if (req.method === "GET" || req.method === "HEAD") {
        return Promise.resolve(undefined);
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
        req.on("error", reject);
    });
}
function buildUrl(req) {
    const protocol = req.headers["x-forwarded-proto"]?.toString().split(",")[0] ||
        req.protocol ||
        "http";
    const host = req.headers.host ?? `localhost:${process.env.PORT ?? 4000}`;
    return `${protocol}://${host}${req.originalUrl}`;
}
async function sendWebResponse(webResponse, res) {
    res.status(webResponse.status);
    webResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
    });
    const body = Buffer.from(await webResponse.arrayBuffer());
    res.send(body);
}
function adaptRoute(module) {
    return async (req, res) => {
        const method = req.method.toUpperCase();
        const handler = module[method];
        if (!handler) {
            res.status(405).json({
                ok: false,
                error: { code: "method_not_allowed", message: "HTTP method is not allowed." }
            });
            return;
        }
        const body = await readBody(req);
        const request = new Request(buildUrl(req), {
            method,
            headers: toWebHeaders(req.headers),
            body
        });
        const response = await handler(request, { params: Promise.resolve(req.params) });
        await sendWebResponse(response, res);
    };
}
