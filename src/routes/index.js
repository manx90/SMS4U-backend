import { druServiceRoute } from "./service.route.js";
import { countryRoute } from "./country.route.js";
import { orderRoute } from "./order.route.js";
import { countryServicePricingRoute } from "./countryServicePricing.route.js";
import { emailAdminRoute } from "./emailAdmin.route.js";
import { emailRoute } from "./email.route.js";
import { heleketRoute } from "./heleket.route.js";
// import { paymentRoute } from "./payment.route.js";

export const Route = async (app) => {
	app.register(druServiceRoute, {
		prefix: "/service",
	});

	app.register(countryRoute, {
		prefix: "/country",
	});

	app.register(orderRoute, {
		prefix: "/order",
	});

	app.register(countryServicePricingRoute, {
		prefix: "/pricing",
	});

	app.register(emailAdminRoute, {
		prefix: "/email-admin",
	});

	app.register(emailRoute, {
		prefix: "/email",
	});

	app.register(heleketRoute, {
		prefix: "/payment/heleket",
	});

	// app.register(paymentRoute, {
	// 	prefix: "/payment",
	// });
};
