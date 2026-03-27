# api.sms4u-BackEnd

Backend API for SMS & Email service platform with payment integration.

## Features

- SMS Number Orders (WhatsApp, Telegram, Facebook, etc.)
- Email Orders (Temporary email addresses)
- User Management & Authentication (JWT & API Keys)
- Payment Integration (Heleket Payment Gateway)
- Country & Service Management
- Pricing Management
- Background Services (Order expiration, Email sync, Cache management)

## Tech Stack

- **Framework**: Fastify v5.6.0
- **Database**: MySQL with TypeORM
- **Authentication**: JWT & API Keys
- **Payment**: Heleket Payment Gateway
- **Caching**: LRU Cache & Fastify Caching
- **Background Jobs**: Node-cron

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Wael-Almuntaser/api.sms4u-BackEnd.git
cd api.sms4u-BackEnd
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file with the following variables:
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database

# JWT
JWT_SECRET=your_jwt_secret_key

# Server
PORT=3000
HOST=0.0.0.0
BASE_URL=https://api.sms4u.pro

# Heleket Payment
HELEKET_API_KEY=your_heleket_api_key
HELEKET_MERCHANT_ID=your_heleket_merchant_id
HELEKET_API_URL=https://api.heleket.com/v1
```

4. Run the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Documentation

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `GET /api/v1/auth/login` - Login with credentials
- `GET /api/v1/auth/login-with-key` - Login with API key
- `POST /api/v1/auth/refresh-token` - Refresh access token

### Payment (Heleket)
- `POST /api/v1/payment/heleket/create-invoice` - Create payment invoice
- `GET /api/v1/payment/heleket/status/:uuid` - Get payment status
- `POST /api/v1/payment/heleket/webhook` - Webhook endpoint

### Orders
- `GET /api/v1/order/get-number` - Get SMS number
- `GET /api/v1/order/get-message` - Get SMS message
- `GET /api/v1/order/get-email` - Order email
- `GET /api/v1/order/get-email-message` - Get email message

### Users
- `GET /api/v1/users/balance` - Get user balance
- `GET /api/v1/users/info` - Get user info
- `GET /api/v1/users/orders` - Get user orders

For complete API documentation, see `insomnia.yaml` or check the routes in `src/routes/`.

## Project Structure

```
src/
├── api/              # External API services
├── config/           # Configuration files
├── decorator/        # Auth & Cache decorators
├── dto/              # Data Transfer Objects
├── handler/          # Request handlers
├── models/           # Database models (TypeORM)
├── repositories/     # Data access layer
├── routes/           # API routes
├── services/         # Business logic services
├── utils/            # Utility functions
└── script/           # Setup scripts
```

## Payment Integration

This project includes Heleket Payment Gateway integration. See `HELEKET_PAYMENT_INTEGRATION.md` for detailed documentation.

## License

ISC

