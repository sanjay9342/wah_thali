# Testing

Current automated coverage:

- Cart subtotal calculation
- Coupon discount
- Packaging fee
- Delivery fee
- GST
- Grand total

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Recommended next Playwright flows:

- Menu to customize to cart to COD confirmation
- Admin confirms order and customer tracking updates
- Corporate lead submission
- Delivered order review
- Restricted role denial
