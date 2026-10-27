Stripe auth flow adapted from https://github.com/t3dotgg/stripe-recommendations?tab=readme-ov-file

Instead of using a KV store, directly update backend with payment information. When the webhook
hits the backend, user state will auto change to paid and user will be able to leave and join the event at will.