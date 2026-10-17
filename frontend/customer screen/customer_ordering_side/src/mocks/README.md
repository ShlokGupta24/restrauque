# Mock data boundary

Place all illustrative data fixtures here, for example:
- `restaurant.mock.ts`
- `menu.mock.ts`
- `order.mock.ts`
- `feedback.mock.ts`

Never import fixture files directly inside UI components. Implement a `CustomerDataService` interface with separate mock and API adapters; select mock mode explicitly in development. Production must fail loudly with a configuration error if API mode is required but not configured. Mock content must not be presented as verified live restaurant data.
