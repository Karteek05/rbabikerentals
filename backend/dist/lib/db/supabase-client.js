"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupabaseConfigured = isSupabaseConfigured;
exports.getSupabaseServiceClient = getSupabaseServiceClient;
const supabase_js_1 = require("@supabase/supabase-js");
let cachedServiceClient = null;
function isSupabaseConfigured() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
function getSupabaseServiceClient() {
    if (cachedServiceClient) {
        return cachedServiceClient;
    }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
    }
    cachedServiceClient = (0, supabase_js_1.createClient)(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    return cachedServiceClient;
}
