export function parseConsentScopes(scope?: string | string[] | null) {
	if (!scope) return new Set<string>();

	const values = Array.isArray(scope) ? scope : scope.split(/[+,\s]+/);
	return new Set(
		values.map((item) => item.trim().toUpperCase()).filter(Boolean),
	);
}

export function consentScopesToFlags(scopes: Set<string>) {
	return {
		aadhaarVerified: scopes.has("ADHAR") || scopes.has("AADHAAR"),
		dlVerified: scopes.has("DRVLC") || scopes.has("DL"),
	};
}

export function resolveKycCallbackStatus(input: {
	status?: string;
	aadhaarVerified?: boolean;
	dlVerified?: boolean;
}) {
	const normalized = String(input.status ?? "").toLowerCase();

	if (normalized === "failed" || normalized === "revoked") {
		return "failed" as const;
	}

	const authenticated =
		normalized === "authenticated" ||
		normalized === "verified" ||
		normalized === "success";

	if (authenticated) {
		return input.aadhaarVerified && input.dlVerified
			? ("verified" as const)
			: ("manual_review" as const);
	}

	if (
		normalized === "unauthenticated" ||
		normalized === "in_progress" ||
		normalized === "initiated"
	) {
		return "in_progress" as const;
	}

	return "manual_review" as const;
}

function hasSharedDocument(payload: Record<string, unknown>, docType: string) {
	const collections = [
		payload.documents,
		payload.sharedDocuments,
		payload.documentsShared,
		payload.consentDocuments,
	];
	const normalizedType = docType.toUpperCase();

	for (const collection of collections) {
		if (!Array.isArray(collection)) continue;
		if (
			collection.some((doc) => {
				if (typeof doc === "string") {
					return doc.toUpperCase() === normalizedType;
				}
				if (doc && typeof doc === "object") {
					const record = doc as Record<string, unknown>;
					const type = String(
						record.docType ?? record.doc_type ?? record.type ?? "",
					).toUpperCase();
					return type === normalizedType;
				}
				return false;
			})
		) {
			return true;
		}
	}

	return false;
}

export function parseSetuDigilockerStatus(payload: Record<string, unknown>) {
	const status = String(payload.status ?? "").toLowerCase();
	const userDetails =
		payload.digilockerUserDetails &&
		typeof payload.digilockerUserDetails === "object"
			? (payload.digilockerUserDetails as Record<string, unknown>)
			: null;

	const scopeSources = [
		payload.scope,
		payload.consentScope,
		payload.consent_scope,
		payload.consent_scopes,
	];
	const scopes = scopeSources.reduce<Set<string>>((acc, source) => {
		if (typeof source === "string") {
			parseConsentScopes(source).forEach((item) => acc.add(item));
		} else if (Array.isArray(source)) {
			source.forEach((item) => {
				if (typeof item === "string") {
					parseConsentScopes(item).forEach((scope) => acc.add(scope));
				}
			});
		}
		return acc;
	}, new Set<string>());
	const scopeFlags = consentScopesToFlags(scopes);

	const aadhaarVerified = Boolean(
		payload.aadhaarVerified ??
			payload.aadhaar_verified ??
			userDetails?.aadhaarLinked ??
			userDetails?.aadhaar_linked ??
			(hasSharedDocument(payload, "ADHAR") || scopeFlags.aadhaarVerified),
	);

	const dlVerified = Boolean(
		payload.dlVerified ??
			payload.dl_verified ??
			payload.drivingLicenseVerified ??
			payload.driving_license_verified ??
			(hasSharedDocument(payload, "DRVLC") || scopeFlags.dlVerified),
	);

	return {
		status,
		aadhaarVerified,
		dlVerified,
		consentScopes: [...scopes],
		cibilScore:
			typeof payload.cibilScore === "number"
				? payload.cibilScore
				: typeof payload.cibil_score === "number"
					? payload.cibil_score
					: undefined,
		failureReason:
			typeof payload.failureReason === "string"
				? payload.failureReason
				: typeof payload.failure_reason === "string"
					? payload.failure_reason
					: status === "revoked"
						? "DigiLocker consent was revoked."
						: undefined,
	};
}

export const parseSetuDigilockerStatusForTest = parseSetuDigilockerStatus;
export const resolveKycCallbackStatusForTest = resolveKycCallbackStatus;
