import { ApiException } from "@/lib/utils/errors";

export type UploadKind = "image" | "document";

const IMAGE_TYPES = new Map([
	["image/jpeg", ".jpg"],
	["image/png", ".png"],
	["image/webp", ".webp"],
]);
const DOCUMENT_TYPES = new Map([["application/pdf", ".pdf"], ...IMAGE_TYPES]);

export function sanitizeUploadFileName(name: string, fallback: string) {
	const base = name
		.trim()
		.replace(/[^a-zA-Z0-9._-]/g, "_")
		.replace(/^\.+/, "");
	return base || fallback;
}

function hasSignature(buffer: Buffer, type: string) {
	if (type === "application/pdf")
		return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
	if (type === "image/jpeg")
		return (
			buffer.length >= 3 &&
			buffer[0] === 0xff &&
			buffer[1] === 0xd8 &&
			buffer[2] === 0xff
		);
	if (type === "image/png")
		return buffer
			.subarray(0, 8)
			.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
	if (type === "image/webp")
		return (
			buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
			buffer.subarray(8, 12).toString("ascii") === "WEBP"
		);
	return false;
}

export async function readValidatedUpload(
	file: File,
	options: { kind: UploadKind; maxBytes: number },
) {
	const allowed = options.kind === "image" ? IMAGE_TYPES : DOCUMENT_TYPES;
	const expectedExtension = allowed.get(file.type);
	if (!expectedExtension) {
		throw new ApiException(
			400,
			"invalid_file_type",
			"Unsupported upload type.",
		);
	}
	const buffer = Buffer.from(await file.arrayBuffer());
	if (buffer.length === 0 || buffer.length > options.maxBytes) {
		throw new ApiException(
			400,
			"file_too_large",
			`Upload must be non-empty and ${Math.floor(options.maxBytes / 1024 / 1024)}MB or smaller.`,
		);
	}
	const fileParts = file.name.split(".");
	const extension =
		fileParts.length > 1
			? `.${(fileParts[fileParts.length - 1] ?? "").toLowerCase()}`
			: "";
	if (extension !== expectedExtension || !hasSignature(buffer, file.type)) {
		throw new ApiException(
			400,
			"invalid_file_signature",
			"File content does not match its declared type.",
		);
	}
	return {
		buffer,
		extension: expectedExtension,
		fileName: sanitizeUploadFileName(file.name, `upload${expectedExtension}`),
	};
}

export function assertSafeExternalImageUrl(value: string) {
	if (value.length > 2048)
		throw new ApiException(400, "invalid_image_url", "image_url is too long.");
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new ApiException(
			400,
			"invalid_image_url",
			"image_url must be a valid URL.",
		);
	}
	if (
		!["https:", "http:"].includes(url.protocol) ||
		url.username ||
		url.password
	) {
		throw new ApiException(
			400,
			"invalid_image_url",
			"image_url must use a safe HTTP(S) URL.",
		);
	}
	return url.toString();
}
