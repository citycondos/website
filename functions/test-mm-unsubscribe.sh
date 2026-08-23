#!/bin/bash

# Intended to run against
# HUGO_PARAMS_SECRET_DYNAMIC_URL_PATH=helloworld npm run preview

sign_secret='devfakesecret'

payload='{"to":"61400000000","sender":"61416194459","message":"STOP","received_at":"2026-08-22 12:00:00","type":"unsubscribe","original_message_id":"test-message-id","original_custom_ref":"test-ref"}'


timestamp=$(date +%s)

signature=$(printf '%s.%s' "$timestamp" "$payload" \
  | openssl dgst -sha256 -hmac "$sign_secret" -hex \
  | awk '{print $2}')

curl -H "X-MM-Timestamp: $timestamp" -H "X-MM-Signature: $signature" -d "$payload" http://localhost:8788/dynamic/helloworld/smsinbound
