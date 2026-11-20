# 🛒 PlayShop – a Playwright practice store

PlayShop is a small, fake e-commerce site (think a tiny Amazon) built to practice end-to-end testing with
[Playwright](https://playwright.dev/docs/intro). It runs entirely on your machine. Nothing is real: no payments,
no emails, and all data lives in memory.

- **Frontend:** React 19 + React Router + TypeScript, built with Vite (http://localhost:5173)
- **Backend:** Express REST API with in-memory data (http://localhost:3001, proxied as `/api` by Vite)
- **Tests:** `@playwright/test`, preconfigured in `playwright.config.ts`, with starter tests in `tests/`

---

## Quick start

```bash
npm install                    # once
npx playwright install chromium   # once – downloads the test browser
npm run dev                    # starts the API + website → open http://localhost:5173
```

Run the tests in another terminal, or let Playwright start the servers for you:

```bash
npm test             # headless run
npm run test:ui      # UI mode: watch mode, time-travel debugging
npm run test:headed  # watch the browser
npm run report       # open the last HTML report
npm run codegen      # record a test by clicking around
```

> Node 20+ works. The Playwright docs recommend Node 22/24, and `.nvmrc` pins 24 (`nvm use`).

Production-like mode on a single port: `npm start`, then open http://localhost:3000.

---

## Test data

### User accounts

| Email                | Password       | Behaviour                                       |
| -------------------- | -------------- | ----------------------------------------------- |
| `alice@example.com`  | `Password123!` | Customer with a saved address and one past order (`ORD-1001`) |
| `bob@example.com`    | `Password123!` | Customer with no address and no orders          |
| `locked@example.com` | `Password123!` | Locked account: sign-in fails with an error     |
| `slow@example.com`   | `Password123!` | Every authenticated request takes ~2.5 s        |
| `admin@example.com`  | `Admin123!`    | Admin: can open `/admin`                        |

You can also register new users at `/register`. They exist until the server restarts or the data is reset.

### Payment cards (any future expiry such as `12/30`, any 3-digit CVC)

| Card number           | Result                          |
| --------------------- | ------------------------------- |
| `4242 4242 4242 4242` | ✅ Payment succeeds             |
| `4000 0000 0000 0002` | ❌ "Your card was declined."    |
| `4000 0000 0000 9995` | ❌ "Insufficient funds."        |
| `1234 5678 9012 3456` | ❌ "Invalid card number" (fails the Luhn check) |

Other Luhn-valid numbers, such as `5555 5555 5555 4444`, also succeed.

### Promo codes (case-insensitive)

| Code          | Effect                                              |
| ------------- | --------------------------------------------------- |
| `SAVE10`      | 10% off the subtotal                                |
| `WELCOME20`   | 20% off, only when the subtotal is $100 or more     |
| `FREESHIP`    | Free shipping                                       |
| `EXPIRED2024` | Error: "This promo code has expired"                |
| anything else | Error: "Invalid promo code"                         |

### Pricing rules

- Standard shipping is **$5.99**, free when the subtotal is **$50 or more**. Express shipping is always **$14.99**.
- Tax is **8%** of (subtotal − discount), rounded to cents.
- You can buy at most 10 of one item per order, and never more than the stock.

### Catalog: 10 products in 5 categories

| ID | Product                            | Category          | Price   | Stock | Special                     |
| -- | ---------------------------------- | ----------------- | ------- | ----- | --------------------------- |
| 1  | Aurora Wireless Headphones         | Electronics       | $129.99 | 15    | On sale (was $159.99), featured |
| 2  | Pulse Smartwatch Series 5          | Electronics       | $249.00 | **0** | Out of stock                |
| 3  | Boom Mini Bluetooth Speaker        | Electronics       | $49.99  | 30    |                             |
| 4  | Testing in Practice: A Field Guide | Books             | $34.50  | 50    | Featured                    |
| 5  | The Midnight Garden                | Books             | $14.99  | **3** | Low stock ("Only 3 left")   |
| 6  | BrewMaster Drip Coffee Maker       | Home & Kitchen    | $89.00  | 12    | Featured                    |
| 7  | Forge Chef's Knife 8"              | Home & Kitchen    | $59.95  | 20    |                             |
| 8  | Stride Running Shoes               | Fashion           | $94.99  | 25    | **Size required**, on sale, featured |
| 9  | Classic Denim Jacket               | Fashion           | $74.00  | 8     | **Size required**           |
| 10 | FlexGrip Yoga Mat                  | Sports & Outdoors | $29.99  | 40    |                             |

---

## What's on the site

| Page                | URL                     | Notes |
| ------------------- | ----------------------- | ----- |
| Home                | `/`                     | Category tiles, featured products, and a "Deal of the day" countdown to midnight |
| Catalog             | `/products`             | Category, price range, in-stock filter, sorting, search (`?q=`), and pagination (6 per page). All state lives in the URL. |
| Product             | `/products/:id`         | Quantity stepper, size picker, stock status, Description/Reviews tabs, 404 for unknown IDs |
| Cart                | `/cart`                 | Change quantity, remove (native `confirm()` dialog), clear the cart, apply promo codes, server-calculated totals. Saved in `localStorage`. |
| Sign in / Register  | `/login`, `/register`   | Client and server validation, a `?redirect=` return URL, and a "Demo accounts" helper |
| Checkout 🔒         | `/checkout`             | 3 steps: shipping (prefilled from your profile), payment, review. Terms open in a new tab. |
| Order 🔒            | `/orders/:id`           | Confirmation banner, **Download invoice** (a file download), **Cancel order** (`confirm()` dialog) |
| Orders 🔒           | `/orders`               | Order history table |
| Account 🔒          | `/account`              | Edit your profile and default address, **upload an avatar** (file input) |
| Admin 🔒👑          | `/admin`                | Stats, all orders, inventory editing, users, **Reset sandbox data** |
| Terms               | `/terms`                | Static page |
| 404                 | anything else           |  |

🔒 requires sign-in: guests are sent to `/login?redirect=…`. 👑 requires the admin role; other users see "403 – Access denied".

### Testing hooks

- **Reset all data:** `POST /api/test/reset`. Use it in `beforeEach` or global setup:
  `await request.post('/api/test/reset')`.
- **Auth token** is stored in `localStorage` under `playshop.token`, and the **cart** under `playshop.cart`.
  Both are included in Playwright's `storageState`.
- The site has accessible roles and labels, so prefer `getByRole` / `getByLabel`. Where those aren't enough, use the
  `data-testid` attributes: `product-card`, `cart-count`, `cart-item`, `summary-total`, `order-number`, `toast`, and others.

### REST API (all under `/api`)

```
GET    /health
GET    /categories
GET    /products?category=&q=&sort=featured|price-asc|price-desc|rating|name&minPrice=&maxPrice=&inStock=true&page=&limit=
GET    /products/:id
POST   /auth/login            { email, password }          → { token, user }   (401 bad credentials, 403 locked)
POST   /auth/register         { name, email, password }    → 201 { token, user } (400 validation, 409 duplicate email)
POST   /auth/logout
GET    /auth/me                                            🔒
PUT    /account               { name, phone, address, avatar } 🔒
POST   /cart/quote            { items:[{productId, qty, option}], promoCode, shippingMethod } → totals
POST   /orders                { items, shipping, payment, shippingMethod, promoCode } 🔒 → 201 order (400/402/409 errors)
GET    /orders                                             🔒
GET    /orders/:id                                         🔒
POST   /orders/:id/cancel                                  🔒 (409 unless status is Processing)
GET    /admin/orders | /admin/users                        🔒👑
PATCH  /admin/products/:id    { stock }                    🔒👑
POST   /test/reset
```

Authenticated endpoints expect the header `Authorization: Bearer <token>`.

---

## What Playwright can do, and where to practice it here

A short map of the Playwright docs (https://playwright.dev/docs/intro) to concrete exercises on this site.

| Playwright feature | Docs | Practice on PlayShop |
| ------------------ | ---- | -------------------- |
| **Locators** (`getByRole`, `getByLabel`, `getByTestId`, `filter`, `nth`) | [Locators](https://playwright.dev/docs/locators) | Find a product card by its name, then click its "Add to cart" button |
| **Web-first assertions** (`toHaveText`, `toHaveCount`, `toHaveURL`, `toBeDisabled`) | [Assertions](https://playwright.dev/docs/test-assertions) | Check the cart badge, the results count, and that the out-of-stock button is disabled |
| **Auto-waiting** | [Auto-waiting](https://playwright.dev/docs/actionability) | `slow@example.com`: assertions should pass without any `waitForTimeout` |
| **Actions** (`fill`, `selectOption`, `check`, `press`) | [Actions](https://playwright.dev/docs/input) | Checkout forms, size dropdown, sort select, shipping radios, terms checkbox |
| **Dialogs** | [Dialogs](https://playwright.dev/docs/dialogs) | Removing a cart item and cancelling an order both open `confirm()`. Try accepting and dismissing. |
| **Downloads** | [Downloads](https://playwright.dev/docs/downloads) | "Download invoice": check the file name and its contents |
| **File upload** | [Input → upload](https://playwright.dev/docs/input#upload-files) | Upload an avatar on `/account` with `setInputFiles`; try a non-image file and a file over 1 MB |
| **New tabs / popups** | [Pages](https://playwright.dev/docs/pages) | The "Terms & Conditions" link at checkout opens a new tab |
| **Authentication & storageState** | [Auth](https://playwright.dev/docs/auth) | Sign in once in a setup project, save `playwright/.auth/alice.json`, and reuse it. Use one state per role (alice, admin). |
| **API testing** (`request` fixture) | [API testing](https://playwright.dev/docs/api-testing) | Test `/api/auth/login` status codes; create an order through the API, then check it in the UI |
| **Network mocking** (`page.route`) | [Mock APIs](https://playwright.dev/docs/mock) | Make `/api/products` return an empty list or a 500 and check the UI; slow down `/api/cart/quote` |
| **Clock** | [Clock](https://playwright.dev/docs/clock) | Set the time with `page.clock` and check the deal countdown, e.g. 23:59:00 → `00:01:00` |
| **Fixtures** | [Fixtures](https://playwright.dev/docs/test-fixtures) | Write a `loggedInPage` or `cartWithItems` fixture |
| **Page Object Model** | [POM](https://playwright.dev/docs/pom) | `LoginPage`, `ProductPage`, `CartPage`, `CheckoutPage` classes |
| **Parameterized tests** | [Parameterize](https://playwright.dev/docs/test-parameterize) | Loop over all promo codes, test cards, or sort options |
| **Projects / browsers / emulation** | [Projects](https://playwright.dev/docs/test-projects), [Emulation](https://playwright.dev/docs/emulation) | Run on Firefox, WebKit, and `Pixel 7`. On mobile the layout collapses. |
| **Visual comparisons** | [Snapshots](https://playwright.dev/docs/test-snapshots) | `toHaveScreenshot()` of the product page. Mask the countdown! |
| **Aria snapshots** | [Aria snapshots](https://playwright.dev/docs/aria-snapshots) | `toMatchAriaSnapshot` on the order summary or the header |
| **Accessibility testing** | [Accessibility](https://playwright.dev/docs/accessibility-testing) | Add `@axe-core/playwright` and scan each page |
| **Trace viewer / UI mode / codegen** | [Trace viewer](https://playwright.dev/docs/trace-viewer) | `npm run test:ui`, `npm run codegen`, `npx playwright show-trace` |
| **Retries, parallelism, sharding, CI** | [Parallelism](https://playwright.dev/docs/test-parallel) | See "Isolation" below |

### Exercise ideas, from easy to hard

1. A guest searches for "coffee" and sees exactly 1 result.
2. Sort by "Price: Low to High"; the first card is "The Midnight Garden".
3. The Smartwatch shows "Out of stock" and its button is disabled.
4. Adding running shoes without a size shows "Please select a size".
5. Pagination: page 1 has 6 cards, page 2 has 4.
6. Sign in as `locked@example.com` and check the error message.
7. A guest who opens `/checkout` is redirected to sign in, then sent back after signing in.
8. Cart math: add 2 × Yoga Mat and 1 × Book, then check subtotal, shipping, tax, and total.
9. `WELCOME20` is rejected under $100 and accepted at $100 or more.
10. Full checkout as Bob with Express shipping and `SAVE10`. The confirmation shows a new order ID, and the cart is empty.
11. A declined card shows an error and leaves you on the review step.
12. Cancel an order: accept the dialog and check that the status is "Cancelled" and stock is back.
13. Check the downloaded invoice's text contents.
14. Admin sets a product's stock to 0, then a customer sees it as out of stock.
15. Run the purchase flow on mobile emulation (`devices['iPhone 15']`).
16. Mock `/api/orders` to return 500, then check the error alert at checkout.
17. Build a POM + fixtures + `storageState` setup that runs the suite in parallel without flakiness.

### Isolation tips (the server is stateful!)

All data is held in one in-memory store shared by every test. That is great practice for thinking about isolation:

- `workers: 1` is the default in `playwright.config.ts`. Increase it once your tests don't step on each other.
- Calling `/api/test/reset` while other tests are running in parallel will surprise them. Prefer creating fresh data (for
  example, register a unique user per test with `Date.now()` in the email) over resetting.
- Stock is shared. Two parallel tests buying the last 3 copies of "The Midnight Garden" will collide.
- Restarting the server (or saving a file in `server/`) also resets all data.

---

## Project structure

```
playshop/
├── server/
│   ├── index.js        # Express API (auth, products, cart quote, orders, admin, test reset)
│   └── data.js         # Seed data: products, categories, users, promo codes
├── src/
│   ├── api.ts          # fetch wrapper + types
│   ├── context/        # Auth, Cart (localStorage), Toast providers
│   ├── components/     # Header, Footer, ProductCard, OrderSummary, ProtectedRoute
│   └── pages/          # Home, Products, ProductDetail, Cart, Login, Register, Checkout, Orders, OrderDetail, Account, Admin
├── tests/
│   └── example.spec.ts # Starter tests – add yours here
├── playwright.config.ts
└── vite.config.ts
```

⚠️ This is a training sandbox. Passwords are stored in plain text and tokens are signed with a hard-coded secret. Never use this
code as a real authentication system.
