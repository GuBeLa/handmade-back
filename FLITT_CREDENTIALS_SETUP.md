# Flitt Credentials Setup

## Environment Variables

დაამატეთ შემდეგი credentials `.env` ფაილში:

```env
# Flitt Payment Gateway
FLITT_MERCHANT_ID=4055448
FLITT_PAYMENT_KEY=oPz62f3vprXXdW5RUH1L4COmbBxUr1Si
FLITT_CREDIT_PRIVATE_KEY=rQBeJQm2kcvF9S0JOamlzXKe7Us1DQ6O
FLITT_BASE_URL=https://api.flitt.ge
FLITT_TEST_MODE=true
```

## Production

Production-ში:
- Set `FLITT_TEST_MODE=false`
- Use production credentials (same Merchant ID, but different keys if provided)

## Security Notes

- **NEVER** commit `.env` file to git
- Keep credentials secure
- Rotate keys regularly
- Use different credentials for test and production
