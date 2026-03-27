import User from "./User.model.js";
import Service from "./Service.model.js";
import Country from "./Country.model.js";
import Order from "./Order.model.js";
import CountryServicePricing from "./CountryServicePricing.model.js";
import EmailSite from "./EmailSite.model.js";
import EmailDomain from "./EmailDomain.model.js";
import EmailPrice from "./EmailPrice.model.js";
import OrderReorder from "./OrderReorder.model.js";
import PaymentInvoice from "./PaymentInvoice.model.js";
import Provider3AccessSnapshot from "./Provider3AccessSnapshot.model.js";

export const entities = [
	User,
	Service,
	Country,
	Order,
	OrderReorder,
	CountryServicePricing,
	EmailSite,
	EmailDomain,
	EmailPrice,
	PaymentInvoice,
	Provider3AccessSnapshot,
];
