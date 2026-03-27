export const isNonEmptyString = (value) =>
	typeof value === "string" &&
	value.trim().length > 0;

export const toTrimmedLower = (value) =>
	typeof value === "string"
		? value.trim().toLowerCase()
		: value;

export const parseBoolean = (value) =>
	value === true || value === "true"
		? true
		: value === false || value === "false"
		? false
		: false;

// Simple domain/service name validator: letters, digits, dashes and dots
export const isValidDomainName = (value) => {
	if (typeof value !== "string") return false;
	const v = value.trim().toLowerCase();
	const regex =
		/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
	return regex.test(v);
};

export const parsePriceNumber = (value) => {
	const n = parseFloat(value);
	return Number.isFinite(n) && n > 0 ? n : null;
};
