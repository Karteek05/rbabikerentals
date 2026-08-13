import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import {
	createDashboardAccessToken,
	DASHBOARD_ACCESS_COOKIE,
	dashboardRoleFromParam,
	getDashboardEmail,
	getDashboardUserId,
	verifyDashboardPassword,
} from "@/lib/auth/dashboard-access";
import { sendSmtpMail } from "@/lib/integrations/smtp";
import { consumeRateLimit } from "@/lib/security/rate-limit";

type LoginBody = {
	role?: string;
	password?: string;
	code?: string;
	action?: "password" | "send_code" | "verify_code";
};

const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const emailCodes = new Map<
	string,
	{ code: string; expiresAt: number; attempts: number }
>();
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const CODE_TTL_MS = 10 * 60 * 1000;

function getClientKey(request: Request, role: string) {
	const forwardedFor = request.headers
		.get("x-forwarded-for")
		?.split(",")[0]
		?.trim();
	const realIp = request.headers.get("x-real-ip")?.trim();
	return `${role}:${forwardedFor || realIp || "local"}`;
}

function isRateLimited(key: string) {
	const item = failedAttempts.get(key);
	if (!item) return false;
	if (item.resetAt <= Date.now()) {
		failedAttempts.delete(key);
		return false;
	}
	return item.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(key: string) {
	const now = Date.now();
	const item = failedAttempts.get(key);
	if (!item || item.resetAt <= now) {
		failedAttempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
		return;
	}
	failedAttempts.set(key, { count: item.count + 1, resetAt: item.resetAt });
}

function createCode() {
	return randomInt(100000, 1000000).toString();
}

function codeKey(role: string, request: Request) {
	return `${getClientKey(request, role)}:email`;
}

function issueCookie(
	role: NonNullable<ReturnType<typeof dashboardRoleFromParam>>,
) {
	return createDashboardAccessToken({
		role,
		userId: getDashboardUserId(role),
	});
}

async function setAccessCookie(
	role: NonNullable<ReturnType<typeof dashboardRoleFromParam>>,
) {
	const token = await issueCookie(role);

	if (!token) {
		return NextResponse.json(
			{
				ok: false,
				error: {
					code: "dashboard_secret_missing",
					message: "Dashboard access secret is not configured.",
				},
			},
			{ status: 500 },
		);
	}

	const response = NextResponse.json({ ok: true });
	response.cookies.set(DASHBOARD_ACCESS_COOKIE, token, {
		httpOnly: true,
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: 8 * 60 * 60,
	});
	return response;
}

export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as LoginBody;
	const role = dashboardRoleFromParam(body.role);

	if (!role) {
		return NextResponse.json(
			{
				ok: false,
				error: { code: "invalid_request", message: "Role is required." },
			},
			{ status: 400 },
		);
	}

	const clientKey = getClientKey(request, role);
	const distributedLimit = await consumeRateLimit(
		`dashboard-login:${clientKey}`,
		20,
		ATTEMPT_WINDOW_MS,
		{ failClosed: true },
	);
	if (!distributedLimit.allowed || isRateLimited(clientKey)) {
		return NextResponse.json(
			{
				ok: false,
				error: {
					code: "too_many_attempts",
					message: "Too many failed attempts. Try again in a few minutes.",
				},
			},
			{ status: 429 },
		);
	}

	if (body.action === "verify_code") {
		const saved = emailCodes.get(codeKey(role, request));
		if (!saved || saved.expiresAt <= Date.now()) {
			emailCodes.delete(codeKey(role, request));
			return NextResponse.json(
				{
					ok: false,
					error: {
						code: "code_expired",
						message: "Email code expired. Send a new code.",
					},
				},
				{ status: 401 },
			);
		}
		if (saved.attempts >= 5 || !body.code || saved.code !== body.code.trim()) {
			emailCodes.set(codeKey(role, request), {
				...saved,
				attempts: saved.attempts + 1,
			});
			recordFailedAttempt(clientKey);
			return NextResponse.json(
				{
					ok: false,
					error: { code: "invalid_code", message: "Invalid email code." },
				},
				{ status: 401 },
			);
		}
		emailCodes.delete(codeKey(role, request));
		failedAttempts.delete(clientKey);
		return setAccessCookie(role);
	}

	if (!body.password) {
		return NextResponse.json(
			{
				ok: false,
				error: { code: "invalid_request", message: "Password is required." },
			},
			{ status: 400 },
		);
	}

	const passwordOk = await verifyDashboardPassword(role, body.password);
	if (!passwordOk) {
		recordFailedAttempt(clientKey);
		return NextResponse.json(
			{
				ok: false,
				error: {
					code: "invalid_password",
					message: "Invalid dashboard password.",
				},
			},
			{ status: 401 },
		);
	}

	if (body.action === "send_code") {
		const recipient = getDashboardEmail(role);
		if (!recipient) {
			return NextResponse.json(
				{
					ok: false,
					error: {
						code: "dashboard_email_missing",
						message:
							"Dashboard email is not configured. Add ADMIN_DASHBOARD_EMAIL or PARTNER_DASHBOARD_EMAIL.",
					},
				},
				{ status: 500 },
			);
		}

		const code = createCode();
		emailCodes.set(codeKey(role, request), {
			code,
			expiresAt: Date.now() + CODE_TTL_MS,
			attempts: 0,
		});

		await sendSmtpMail({
			to: recipient,
			subject: "Your RBA dashboard access code",
			text: `Your RBA dashboard code is ${code}. It expires in 10 minutes.`,
		});

		failedAttempts.delete(clientKey);
		return NextResponse.json({ ok: true, data: { sent: true } });
	}

	failedAttempts.delete(clientKey);
	return setAccessCookie(role);
}

export function DELETE() {
	const response = NextResponse.json({ ok: true });
	response.cookies.set(DASHBOARD_ACCESS_COOKIE, "", {
		httpOnly: true,
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: 0,
	});
	return response;
}
