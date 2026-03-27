import { decode } from "html-entities";

/**
 * Strip HTML tags and decode HTML entities from a string
 * @param {string} html - The HTML string to process
 * @returns {string} - Plain text without HTML tags
 */
export const stripHtml = (html) => {
	if (!html || typeof html !== "string") {
		return "";
	}

	// First decode HTML entities (e.g., &#1605; → Arabic characters)
	let text = decode(html);

	// Remove script and style tags with their content
	text = text.replace(
		/<script[^>]*>[\s\S]*?<\/script>/gi,
		"",
	);
	text = text.replace(
		/<style[^>]*>[\s\S]*?<\/style>/gi,
		"",
	);

	// Remove all HTML tags
	text = text.replace(/<[^>]+>/g, "");

	// Replace multiple whitespace/newlines with single space
	text = text.replace(/\s+/g, " ");

	// Trim leading/trailing whitespace
	text = text.trim();

	return text;
};

/**
 * Extract verification code and clean message from email response
 * @param {Object} response - The provider response object
 * @returns {Object} - Object containing code and cleanMessage
 */
export const extractEmailContent = (response) => {
	const result = {
		code: null,
		message: null,
	};

	// Extract the verification code from 'value' field
	if (response.value) {
		result.code = response.value;
	}

	// Extract and clean the message from HTML
	if (response.message) {
		result.message = stripHtml(response.message);
	}

	return result;
};
