import type {
	MapsDistanceRequest,
	MapsReverseGeocodeRequest,
} from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";

function createGoogleMapsUrl(pathname: string) {
	try {
		return new URL(`https://maps.googleapis.com${pathname}`);
	} catch {
		throw new ApiException(
			500,
			"google_maps_url_invalid",
			"Google Maps endpoint is invalid.",
		);
	}
}

function getGoogleMapsKey() {
	const key = process.env.GOOGLE_MAPS_API_KEY;
	if (!key) {
		throw new ApiException(
			500,
			"google_maps_env_missing",
			"GOOGLE_MAPS_API_KEY is missing.",
		);
	}
	return key;
}

function assertCoordinates(latitude: number, longitude: number) {
	if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
		throw new ApiException(
			400,
			"invalid_latitude",
			"Latitude must be between -90 and 90.",
		);
	}
	if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
		throw new ApiException(
			400,
			"invalid_longitude",
			"Longitude must be between -180 and 180.",
		);
	}
}

export async function reverseGeocode(input: MapsReverseGeocodeRequest) {
	assertCoordinates(input.latitude, input.longitude);
	const url = createGoogleMapsUrl("/maps/api/geocode/json");
	url.searchParams.set("latlng", `${input.latitude},${input.longitude}`);
	url.searchParams.set("key", getGoogleMapsKey());

	const response = await fetch(url);
	if (!response.ok) {
		throw new ApiException(
			502,
			"google_maps_reverse_geocode_failed",
			"Google Maps reverse geocode request failed.",
		);
	}

	const payload = (await response.json()) as {
		status: string;
		results?: Array<{
			formatted_address?: string;
			place_id?: string;
			types?: string[];
			geometry?: {
				location?: {
					lat: number;
					lng: number;
				};
			};
		}>;
		error_message?: string;
	};

	if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
		throw new ApiException(
			502,
			"google_maps_reverse_geocode_failed",
			payload.error_message ?? `Google Maps returned ${payload.status}.`,
		);
	}

	return {
		status: payload.status,
		results: payload.results ?? [],
	};
}

export async function distanceMatrix(input: MapsDistanceRequest) {
	assertCoordinates(input.origin.latitude, input.origin.longitude);
	assertCoordinates(input.destination.latitude, input.destination.longitude);
	const mode = input.mode ?? "driving";
	if (!["driving", "walking", "bicycling", "transit"].includes(mode)) {
		throw new ApiException(400, "invalid_mode", "Unsupported travel mode.");
	}
	const url = createGoogleMapsUrl("/maps/api/distancematrix/json");
	url.searchParams.set(
		"origins",
		`${input.origin.latitude},${input.origin.longitude}`,
	);
	url.searchParams.set(
		"destinations",
		`${input.destination.latitude},${input.destination.longitude}`,
	);
	url.searchParams.set("mode", mode);
	url.searchParams.set("units", "metric");
	url.searchParams.set("key", getGoogleMapsKey());

	const response = await fetch(url);
	if (!response.ok) {
		throw new ApiException(
			502,
			"google_maps_distance_failed",
			"Google Maps distance request failed.",
		);
	}

	const payload = (await response.json()) as {
		status: string;
		rows?: Array<{
			elements?: Array<{
				status: string;
				distance?: { text: string; value: number };
				duration?: { text: string; value: number };
			}>;
		}>;
		error_message?: string;
	};

	if (payload.status !== "OK") {
		throw new ApiException(
			502,
			"google_maps_distance_failed",
			payload.error_message ?? `Google Maps returned ${payload.status}.`,
		);
	}

	const element = payload.rows?.[0]?.elements?.[0];
	if (!element || element.status !== "OK") {
		throw new ApiException(
			422,
			"route_unavailable",
			"No route is available for the requested coordinates.",
		);
	}

	return {
		mode,
		distance: element.distance,
		duration: element.duration,
	};
}
