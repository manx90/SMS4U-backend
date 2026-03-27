import { orderRepository } from "../repositories/order.repo.js";
import { balanceChange } from "../repositories/user.repo.js";
import { LessThan } from "typeorm";
import { getTimeoutMinutes } from "../config/timeout.js";

class RefundService {
	constructor() {
		this.TIMEOUT_MINUTES = getTimeoutMinutes(
			"ORDER_EXPIRATION",
		);
		// Maximum orders to process in one database batch
		this.BATCH_SIZE = 500;
		// Maximum orders to load from DB at once (pagination)
		this.PAGE_SIZE = 5000;
	}

	/**
	 * Process refunds for orders - MEMORY OPTIMIZED VERSION
	 * Loads orders in pages, processes them, then loads next page
	 * Works for both number orders and email orders
	 */
	async processPendingRefunds() {
		try {
			const timeoutDate = new Date();
			timeoutDate.setMinutes(
				timeoutDate.getMinutes() -
					this.TIMEOUT_MINUTES,
			);

			let totalProcessed = 0;
			let totalUsers = new Set();
			let page = 0;
			let hasMore = true;

			console.log(
				`🔄 Starting refund process (Page size: ${this.PAGE_SIZE})`,
			);

			// ========================================
			// PAGINATION LOOP - Process in chunks
			// ========================================
			while (hasMore) {
				page++;
				
				console.log(
					`\n📄 Loading page ${page} (max ${this.PAGE_SIZE} orders)...`,
				);

				// Load ONE page of orders
				const ordersToRefund =
					await orderRepository.find({
						where: {
							status: "pending",
							refundProcessed: false,
							financialLocked: false,
							createdAt: LessThan(timeoutDate),
						},
						relations: {
							user: true,
						},
						take: this.PAGE_SIZE,
						order: {
							createdAt: 'ASC', // Process oldest first
						},
					});

				// Check if we have more pages
				hasMore = ordersToRefund.length === this.PAGE_SIZE;

				if (ordersToRefund.length === 0) {
					console.log('✅ No more orders to refund');
					break;
				}

				console.log(
					`📦 Loaded ${ordersToRefund.length} orders from page ${page}`,
				);

				// ========================================
				// GROUP BY USER
				// ========================================
				const refundsByUser = new Map();
				
				for (const order of ordersToRefund) {
					// Skip email orders with messages
					if (
						order.typeServe === "email" &&
						order.message
					) {
						console.log(
							`Skipping email order #${order.id} - message received`,
						);
						continue;
					}

					const userId = order.user.id;
					totalUsers.add(userId);
					
					if (!refundsByUser.has(userId)) {
						refundsByUser.set(userId, {
							user: order.user,
							orders: [],
							totalAmount: 0,
						});
					}

					const userRefund = refundsByUser.get(userId);
					userRefund.orders.push(order);
					userRefund.totalAmount += parseFloat(order.price);
				}

				console.log(
					`👥 Page ${page}: Grouped into ${refundsByUser.size} users`,
				);

				// ========================================
				// PROCESS THIS PAGE
				// ========================================
				for (const [userId, refundData] of refundsByUser) {
					const processedCount = await this.refundOrdersForUser(refundData);
					totalProcessed += processedCount;
				}

				console.log(
					`✅ Page ${page} completed: ${refundsByUser.size} users processed`,
				);

				// ========================================
				// CLEAR MEMORY (Important!)
				// ========================================
				refundsByUser.clear();
				ordersToRefund.length = 0;

				// Small delay before next page
				if (hasMore) {
					console.log('⏸️  Waiting 1 second before next page...');
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			console.log(
				`\n🎉 Refund process complete!`,
			);
			console.log(
				`   Total orders processed: ${totalProcessed}`,
			);
			console.log(
				`   Total users affected: ${totalUsers.size}`,
			);

			return {
				success: true,
				refundedCount: totalProcessed,
				usersProcessed: totalUsers.size,
				pagesProcessed: page,
			};

		} catch (error) {
			console.error(
				"Error processing refunds:",
				error,
			);
			throw error;
		}
	}

	/**
	 * Refund all orders for a user - processes in batches if needed
	 */
	async refundOrdersForUser(refundData) {
		const { user, orders, totalAmount } = refundData;
		
		console.log(
			`💰 User #${user.id}: ${orders.length} orders, Total: $${totalAmount.toFixed(2)}`,
		);

		// If orders are too many, split into batches
		if (orders.length > this.BATCH_SIZE) {
			return await this.refundOrdersInBatches(refundData);
		}

		// Process all at once if small enough
		return await this.refundOrdersBatch(refundData);
	}

	/**
	 * Process large number of orders in smaller batches
	 */
	async refundOrdersInBatches(refundData) {
		const { user, orders } = refundData;
		let processedCount = 0;
		let totalRefunded = 0;

		// Split orders into batches
		for (let i = 0; i < orders.length; i += this.BATCH_SIZE) {
			const batchOrders = orders.slice(i, i + this.BATCH_SIZE);
			const batchTotal = batchOrders.reduce(
				(sum, order) => sum + parseFloat(order.price),
				0
			);

			const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
			const totalBatches = Math.ceil(orders.length / this.BATCH_SIZE);

			console.log(
				`   📦 Batch ${batchNum}/${totalBatches}: ${batchOrders.length} orders, $${batchTotal.toFixed(2)}`,
			);

			try {
				const count = await this.refundOrdersBatch({
					user,
					orders: batchOrders,
					totalAmount: batchTotal,
				});

				processedCount += count;
				totalRefunded += batchTotal;

				// Small delay between batches
				if (i + this.BATCH_SIZE < orders.length) {
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			} catch (error) {
				console.error(
					`   ❌ Error in batch ${batchNum}:`,
					error.message,
				);
				// Continue with next batch
			}
		}

		console.log(
			`   ✅ User #${user.id}: ${processedCount} orders, $${totalRefunded.toFixed(2)}`,
		);

		return processedCount;
	}

	/**
	 * Refund a batch of orders in one transaction
	 */
	async refundOrdersBatch(refundData) {
		const { user, orders, totalAmount } = refundData;
		
		try {
			const { AppDataSource } = await import(
				"../config/database.js"
			);

			let processedCount = 0;

			await AppDataSource.transaction(
				async (manager) => {
					const orderIds = orders.map(o => o.id);
					
					// Mark orders as refunded
					const updateResult = await manager
						.createQueryBuilder()
						.update("Order")
						.set({
							status: "failed",
							refundProcessed: true,
							financialLocked: false,
						})
						.where("id IN (:...ids)", { ids: orderIds })
						.andWhere("status = :status", {
							status: "pending",
						})
						.andWhere("refundProcessed = :rp", {
							rp: false,
						})
						.andWhere("financialLocked = :locked", {
							locked: false,
						})
						.execute();

					processedCount = updateResult.affected || 0;

					// Refund total amount
					if (processedCount > 0) {
						await manager
							.createQueryBuilder()
							.update("User")
							.set({
								balance: () =>
									"balance + :amount",
							})
							.where("id = :id", {
								id: user.id,
							})
							.setParameters({
								amount: totalAmount,
							})
							.execute();
					}
				},
			);

			return processedCount;

		} catch (error) {
			console.error(
				`❌ Error refunding for user ${user.id}:`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Refund a specific order
	 */
	async refundOrder(order) {
		try {
			const orderType = order.typeServe || "number";
			
			console.log(
				`💰 Single refund: ${orderType} order #${order.id}, User: ${order.user.id}, Amount: $${order.price}`,
			);

			await this.refundOrdersBatch({
				user: order.user,
				orders: [order],
				totalAmount: parseFloat(order.price),
			});

			console.log(
				`✅ Refunded order #${order.id}`,
			);
		} catch (error) {
			console.error(
				`❌ Error refunding order ${order.id}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Check if an order should be refunded
	 */
	shouldRefundOrder(order) {
		if (
			order.status !== "pending" ||
			order.refundProcessed
		) {
			return false;
		}

		if (
			order.typeServe === "email" &&
			order.message
		) {
			return false;
		}

		const now = new Date();
		const orderAge =
			now.getTime() -
			new Date(order.createdAt).getTime();
		const timeoutMs =
			this.TIMEOUT_MINUTES * 60 * 1000;

		return orderAge > timeoutMs;
	}

	/**
	 * Get count of orders eligible for refund (without loading them all)
	 */
	async getRefundableOrdersCount() {
		const timeoutDate = new Date();
		timeoutDate.setMinutes(
			timeoutDate.getMinutes() -
				this.TIMEOUT_MINUTES,
		);

		return await orderRepository.count({
			where: {
				status: "pending",
				refundProcessed: false,
				financialLocked: false,
				createdAt: LessThan(timeoutDate),
			},
		});
	}

	/**
	 * Get orders eligible for refund (paginated)
	 */
	async getOrdersEligibleForRefund(page = 0, limit = 100) {
		const timeoutDate = new Date();
		timeoutDate.setMinutes(
			timeoutDate.getMinutes() -
				this.TIMEOUT_MINUTES,
		);

		return await orderRepository.find({
			where: {
				status: "pending",
				refundProcessed: false,
				financialLocked: false,
				createdAt: LessThan(timeoutDate),
			},
			relations: {
				user: true,
				country: true,
				service: true,
			},
			take: limit,
			skip: page * limit,
		});
	}
}

export default new RefundService();
