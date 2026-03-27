// dto/createInvoiceDto.js
export const createInvoiceDto = {
	type: "object",
	required: ["amount"],
	properties: {
		amount: { type: "number", minimum: 0.01 },
	},
};
