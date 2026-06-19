"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRazorpayOrder = createRazorpayOrder;
exports.createRazorpayRefund = createRazorpayRefund;
exports.verifyRazorpaySignature = verifyRazorpaySignature;
const crypto_1 = __importDefault(require("crypto"));
const errors_1 = require("../../lib/utils/errors");
async function createRazorpayOrder(params) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new errors_1.ApiException(500, "razorpay_env_missing", "Razorpay keys are not configured.");
    }
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            amount: params.amountInPaise,
            currency: params.currency ?? "INR",
            receipt: params.receipt,
            notes: {
                platform: "rbabikerentals"
            }
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new errors_1.ApiException(502, "razorpay_order_create_failed", text);
    }
    const order = (await response.json());
    return {
        provider: "razorpay",
        key_id: keyId,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
    };
}
async function createRazorpayRefund(params) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new errors_1.ApiException(500, "razorpay_env_missing", "Razorpay keys are not configured.");
    }
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch(`https://api.razorpay.com/v1/payments/${params.paymentId}/refund`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            amount: params.amountInPaise,
            speed: "normal",
            notes: {
                platform: "rbabikerentals",
                ...(params.notes ?? {})
            }
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new errors_1.ApiException(502, "razorpay_refund_create_failed", text);
    }
    const refund = (await response.json());
    return {
        provider: "razorpay",
        refund_id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status
    };
}
function verifyRazorpaySignature(params) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
        throw new errors_1.ApiException(500, "razorpay_env_missing", "Razorpay webhook secret is not configured.");
    }
    const digest = crypto_1.default
        .createHmac("sha256", secret)
        .update(`${params.orderId}|${params.paymentId}`)
        .digest("hex");
    return digest === params.signature;
}
