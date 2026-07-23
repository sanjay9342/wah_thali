# Customer Flow

The customer can browse `/`, open `/menu`, add products to `/cart`, see coupon and fee calculations, continue to `/checkout`, place a COD demo order, and track it at `/order/WT-10021/track`.

Production persistence should store guest carts by session ID, merge carts after login, and recalculate all totals on the server before order creation.
