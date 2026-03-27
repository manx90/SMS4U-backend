import NumberServices from "../../api/Number.service.js";
import UserService from "../../services/User.service.js";
import CountryService from "../../services/Country.service.js";
import OrderService from "../../services/Order.service.js";
import OrderNumberService from "../../services/OrderNumber.service.js";
import SiteService from "../../services/Site.service.js";
import DomainService from "../../services/Domain.service.js";
import SiteDomainService from "../../services/SiteDomain.service.js";
import OrderChecks from "../../utils/OrderChecks.js";

class NumberHandler {
	constructor() {
		this.userService = UserService;
		this.countryService = CountryService;
		this.orderService = OrderService;
		this.siteService = SiteService;
		this.domainService = DomainService;
		this.siteDomainService = SiteDomainService;
		this.numberService = NumberServices; // already an instantiated default export
		this.orderChecks = new OrderChecks();
	}
	async getNumber(apiKey, isoCode) {
		const user =
			await this.userService.getOneByApi(apiKey);
		if (!user) throw new Error("Invalid API key");
		const countryObj =
			await this.countryService.findByIsoCode(
				isoCode,
			);
		if (!countryObj)
			throw new Error("Invalid country code");
		if (
			user.balance <
			countryObj.pricing.pricePerMessage
		)
			throw new Error("Insufficient balance");
		const response =
			await this.numberService.getMobileNumber(
				isoCode,
				1,
			);
		if (
			response?.code === 200 &&
			response?.data
		) {
			const order = {
				user: user,
				price: countryObj.pricing.pricePerMessage,
				status: "pending",
				type: "number",
			};
			await this.orderService.create(order);
			await this.userService.decreseBalance(
				user.id,
				countryObj.pricing.pricePerMessage,
			);
			return response;
		}
		throw new Error(
			response?.msg ||
				"Failed to get mobile number",
		);
	}
	async getMsg(apiKey, mobileNumber) {
		const user =
			await this.userService.getOneByApi(apiKey);
		if (!user) throw new Error("Invalid API key");
		return await this.numberService.getMsg(
			mobileNumber,
		);
	}
	async passMobileNumber(apiKey, mobileNumber) {
		const user =
			await this.userService.getOneByApi(apiKey);
		if (!user) throw new Error("Invalid API key");
		return await this.numberService.passMobileNumber(
			mobileNumber,
		);
	}
	async getStatus(apiKey, mobileNumber) {
		const user =
			await this.userService.getOneByApi(apiKey);
		if (!user) throw new Error("Invalid API key");
		return await this.numberService.getStatus(
			mobileNumber,
		);
	}
	async getBlack(apiKey, mobileNumber) {
		const user =
			await this.userService.getOneByApi(apiKey);
		if (!user) throw new Error("Invalid API key");
		return await this.numberService.getBlack(
			mobileNumber,
		);
	}
	async getCountryPhoneNum(apiKey) {
		const user =
			await this.userService.getOneByApi(apiKey);
		if (!user) throw new Error("Invalid API key");
		return await this.numberService.getCountryPhoneNum();
	}
}

export default new NumberHandler();
