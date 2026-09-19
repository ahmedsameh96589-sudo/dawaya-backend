# 💊 DAWAYA Backend API — v2.0

Full-featured RESTful backend for the DAWAYA Smart Pharmacy app.
Built with **Node.js**, **Express**, and **MongoDB**.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env — fill in MONGO_URI, JWT_SECRET, email & Twilio credentials,
# NEWS_API_KEY (newsapi.org) and optionally CORS_ORIGINS

# 3. Seed sample data
npm run seed

# 4. Start dev server
npm run dev
```

Server: `http://localhost:5000`
Health: `http://localhost:5000/api/health`

```bash
# Run the tests (Jest + Supertest)
npm test
```

---

## ⚡ Real-time chat (Socket.IO)

The server also speaks Socket.IO on the same port. Connect with the REST JWT:

```js
const socket = io("http://localhost:5000", { auth: { token } });
socket.on("consultation:message", ({ consultationId, message, status }) => { /* new message */ });
socket.on("consultation:updated", ({ consultationId, status }) => { /* closed / activated */ });
```

Each connection joins a room for its account (`user:<id>` or `doctor:<id>`); the consultation controllers emit to both participants whenever a message is sent or a consultation is closed. Sending still goes through `POST /api/consultations/:id/messages`.

---

## 📁 Project Structure

```
src/
├── config/
│   ├── db.js              # MongoDB connection
│   └── seeder.js          # Sample data seed script
├── controllers/
│   ├── authController.js       # Auth + addresses
│   ├── categoryController.js   # Categories + subcategories
│   ├── brandController.js
│   ├── medicineController.js
│   ├── cartController.js
│   ├── orderController.js
│   └── adminController.js
├── middlewares/
│   ├── auth.js            # JWT protect + role restrictTo
│   ├── errorHandler.js    # Global error handler
│   ├── upload.js          # Multer image upload
│   └── validate.js        # express-validator rules
├── models/
│   ├── User.js            # Includes OTP + reset token fields
│   ├── Category.js
│   ├── Subcategory.js
│   ├── Brand.js
│   ├── Medicine.js
│   ├── Cart.js
│   └── Order.js
├── routes/
│   ├── authRoutes.js
│   ├── categoryRoutes.js
│   ├── subcategoryRoutes.js
│   ├── brandRoutes.js
│   ├── medicineRoutes.js
│   ├── cartRoutes.js
│   ├── orderRoutes.js
│   └── adminRoutes.js
├── utils/
│   ├── jwt.js             # Token generation
│   ├── otp.js             # OTP + reset token generators
│   ├── email.js           # Nodemailer (OTP + reset link emails)
│   ├── sms.js             # Twilio SMS OTPs
│   └── apiFeatures.js     # Search, filter, sort, paginate
└── server.js
```

---

## 🔐 Auth Flows

### Register → Verify
```
POST /api/auth/register       → sends OTP to email + phone
POST /api/auth/verify-otp     → { userId, otp, purpose: "verification" } → returns JWT
```

### Login (2FA)
```
POST /api/auth/login          → credentials check → sends OTP
POST /api/auth/verify-otp     → { userId, otp, purpose: "login" } → returns JWT
```

### Forgot Password
```
POST /api/auth/forgot-password  → sends OTP + reset link email
                                   (OTP path)  POST /api/auth/verify-otp { purpose: "forgot_password" } → returns resetToken
                                   (link path) click link in email
POST /api/auth/reset-password   → { userId, resetToken, newPassword }
```

### Resend OTP
```
POST /api/auth/resend-otp     → { userId, purpose }   (1 minute cooldown)
```

### Change Password (logged in)
```
PUT  /api/auth/change-password → { currentPassword, newPassword }   Bearer token required
```

---

## 📡 API Reference

### 🔑 Auth  `/api/auth`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/register` | Public | Register (sends OTP) |
| POST | `/login` | Public | Login step 1 (sends OTP) |
| POST | `/verify-otp` | Public | Verify OTP (all purposes) |
| POST | `/resend-otp` | Public | Resend OTP |
| POST | `/forgot-password` | Public | Forgot password (OTP + link) |
| POST | `/reset-password` | Public | Reset password via token |
| GET | `/me` | Private | Get my profile |
| PUT | `/me` | Private | Update profile + avatar |
| PUT | `/change-password` | Private | Change password |
| GET | `/addresses` | Private | Get my addresses |
| POST | `/addresses` | Private | Add address |
| PUT | `/addresses/:id` | Private | Update address |
| DELETE | `/addresses/:id` | Private | Delete address |
| PUT | `/addresses/:id/set-default` | Private | Set default address |

---

### 📂 Categories  `/api/categories`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/?withSubcategories=true` | Public | All categories (optionally with subcategories) |
| GET | `/:id` | Public | Single category |
| GET | `/:categoryId/subcategories` | Public | Subcategories of a category |
| POST | `/` | Admin | Create category |
| PUT | `/:id` | Admin | Update category |
| DELETE | `/:id` | Admin | Deactivate category |

### 📂 Subcategories  `/api/subcategories`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | All subcategories |
| GET | `/:id` | Public | Single subcategory |
| POST | `/` | Admin | Create |
| PUT | `/:id` | Admin | Update |
| DELETE | `/:id` | Admin | Deactivate |

---

### 🏷 Brands  `/api/brands`

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/` | Public |
| GET | `/:id` | Public |
| POST | `/` | Admin |
| PUT | `/:id` | Admin |
| DELETE | `/:id` | Admin |

---

### 💊 Medicines  `/api/medicines`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | List (search, filter, paginate) |
| GET | `/featured` | Public | Featured medicines |
| GET | `/:id` | Public | Single medicine |
| GET | `/:id/alternatives` | Public | Alternative medicines |
| POST | `/` | Admin | Create (up to 5 images) |
| PUT | `/:id` | Admin | Update |
| DELETE | `/:id` | Admin | Deactivate |
| PATCH | `/:id/stock` | Admin | Update stock |

**Medicine query params:**
```
?search=panadol
?category=<id>
?subcategory=<id>
?brand=<id>
?price[gte]=10&price[lte]=100
?requiresPrescription=false
?sort=price   or   ?sort=-price
?page=1&limit=12
```

---

### 🛒 Cart  `/api/cart`  *(all Private)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get my cart (with totals) |
| POST | `/add` | Add item `{ medicineId, quantity }` |
| PUT | `/update` | Update quantity `{ medicineId, quantity }` |
| DELETE | `/remove/:medicineId` | Remove item |
| DELETE | `/clear` | Clear entire cart |
| POST | `/coupon` | Apply coupon `{ couponCode }` |
| DELETE | `/coupon` | Remove coupon |

**Demo coupons:** `DAWAYA10` (−10 EGP) · `PHARMA20` (−20 EGP) · `SAVE50` (−50 EGP)

---

### 📦 Orders  `/api/orders`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Private | Place order from cart |
| GET | `/` | Private | My orders |
| GET | `/:id` | Private | Order detail + tracking |
| PUT | `/:id/cancel` | Private | Cancel order |
| GET | `/admin/all` | Admin | All orders |
| PUT | `/:id/status` | Admin | Update status |

**Order status flow:**
```
pending → confirmed → preparing → out_for_delivery → delivered
any non-final → cancelled
```

---

### ⚙️ Admin  `/api/admin`  *(all Admin)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Stats overview |
| GET | `/stats/revenue` | Monthly revenue + top medicines |
| GET | `/users` | All users (search, filter) |
| GET | `/users/:id` | User detail + order history |
| PUT | `/users/:id` | Update user (role, status) |
| DELETE | `/users/:id` | Deactivate user |

---

## 📝 Request Examples

**Register**
```json
POST /api/auth/register
{ "name": "Ahmed", "email": "ahmed@example.com", "phone": "01012345678", "password": "Pass@123" }
```

**Verify OTP**
```json
POST /api/auth/verify-otp
{ "userId": "<id>", "otp": "847291", "purpose": "verification" }
```

**Add to Cart**
```json
POST /api/cart/add
Authorization: Bearer <token>
{ "medicineId": "<id>", "quantity": 2 }
```

**Place Order**
```json
POST /api/orders
Authorization: Bearer <token>
{
  "deliveryAddress": { "street": "123 Tahrir St", "city": "Cairo" },
  "paymentMethod": "cash_on_delivery"
}
```

---

## ⚙️ Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| OTP Email | Nodemailer |
| OTP SMS | Twilio |
| File Upload | Multer |
| Validation | express-validator |
| Rate Limiting | express-rate-limit |

---

## 🔒 Security Features
- Passwords hashed with bcrypt (12 rounds)
- OTPs hashed with SHA-256 before storage
- Reset tokens hashed with SHA-256
- Rate limiting on all auth endpoints (10 req / 15 min)
- Email enumeration prevention on forgot-password
- Role-based access control (user / admin)
- OTP throttle (1 minute between resends)
- OTP expiry (configurable, default 10 min)
- Reset token expiry (30 min)
