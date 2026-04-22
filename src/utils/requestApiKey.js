function resolveApiKeyFromHeadersAndBody(request) {
	const h =
		request.headers["x-api-key"] ||
		request.headers["x-apikey"] ||
		request.headers["api-key"];
	if (h != null && String(h).trim() !== "") {
		return String(h).trim();
	}

	const auth = request.headers.authorization;
	if (auth && /^ApiKey\s+/i.test(auth)) {
		return auth.replace(/^ApiKey\s+/i, "").trim();
	}

	const bk = request.body?.apiKey;
	if (bk != null && String(bk).trim() !== "") {
		return String(bk).trim();
	}

	return undefined;
}

export function getApiKeyFromRequest(request) {
	const q = request.query?.apiKey;
	if (q != null && String(q).trim() !== "") {
		return String(q).trim();
	}
	return resolveApiKeyFromHeadersAndBody(request);
}

export function injectApiKeyIntoQuery(request) {
	const existing = request.query?.apiKey;
	if (existing != null && String(existing).trim() !== "") {
		return;
	}
	const key = resolveApiKeyFromHeadersAndBody(request);
	if (!key) return;
	if (!request.query) request.query = {};
	request.query.apiKey = key;
}
