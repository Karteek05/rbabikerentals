import { describe, expect, it, beforeEach } from "vitest";
import {
	assertSafeExternalImageUrl,
	readValidatedUpload,
} from "@/lib/uploads/validation";
import {
	consumeRateLimit,
	resetLocalRateLimitsForTests,
} from "@/lib/security/rate-limit";

describe("upload validation", () => {
	it("rejects MIME-spoofed image content", async () => {
		const file = new File(["not an image"], "bike.jpg", { type: "image/jpeg" });
		await expect(
			readValidatedUpload(file, { kind: "image", maxBytes: 1024 }),
		).rejects.toMatchObject({ code: "invalid_file_signature" });
	});

	it("accepts signed PDF and rejects unsafe external image URLs", async () => {
		const file = new File(["%PDF-1.7\n"], "rc.pdf", {
			type: "application/pdf",
		});
		await expect(
			readValidatedUpload(file, { kind: "document", maxBytes: 1024 }),
		).resolves.toMatchObject({ extension: ".pdf" });
		expect(() =>
			assertSafeExternalImageUrl("javascript:alert(1)"),
		).toThrowError(/safe HTTP/);
		expect(() =>
			assertSafeExternalImageUrl("https://example.com/image.jpg"),
		).not.toThrow();
	});
});

describe("rate limiter", () => {
	beforeEach(() => resetLocalRateLimitsForTests());

	it("enforces local fallback window", async () => {
		await expect(consumeRateLimit("test", 2, 60_000)).resolves.toMatchObject({
			allowed: true,
			remaining: 1,
			distributed: false,
		});
		await expect(consumeRateLimit("test", 2, 60_000)).resolves.toMatchObject({
			allowed: true,
			remaining: 0,
			distributed: false,
		});
		await expect(consumeRateLimit("test", 2, 60_000)).resolves.toMatchObject({
			allowed: false,
			remaining: 0,
			distributed: false,
		});
	});
});
