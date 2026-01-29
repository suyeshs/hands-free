#!/bin/bash

echo "==================================="
echo "Provisioning Endpoint Diagnostics"
echo "==================================="
echo ""

# Test 1: Check handsfree-restaurant-provisioning worker
echo "1. Testing handsfree-restaurant-provisioning.suyesh.workers.dev"
echo "   Endpoint: /api/provision"
echo "   Method: POST"
echo ""
curl -X POST https://handsfree-restaurant-provisioning.suyesh.workers.dev/api/provision \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Restaurant","email":"test@test.com","phone":"+1234567890","city":"Mumbai","pincode":"400001","tenantId":"test-restaurant-1234","businessCategory":"RESTAURANT","restaurantType":"CASUAL_DINING"}' \
  --max-time 10 \
  -w "\n\nHTTP Status: %{http_code}\n" \
  2>&1 | head -30

echo ""
echo "-----------------------------------"
echo ""

# Test 2: Check handsfree-admin.pages.dev
echo "2. Testing handsfree-admin.pages.dev"
echo "   Endpoint: /api/tenants"
echo "   Method: POST"
echo ""
curl -X POST https://handsfree-admin.pages.dev/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Restaurant","email":"test@test.com","phone":"+1234567890","city":"Mumbai","pincode":"400001","tenantId":"test-restaurant-1234","businessCategory":"RESTAURANT","restaurantType":"CASUAL_DINING"}' \
  --max-time 10 \
  -w "\n\nHTTP Status: %{http_code}\n" \
  2>&1 | head -30

echo ""
echo "-----------------------------------"
echo ""

# Test 3: Check if there's a domain-service worker
echo "3. Testing potential domain-service endpoint"
echo "   Endpoint: https://domain-service.suyesh.workers.dev/api/provision"
echo "   Method: POST"
echo ""
curl -X POST https://domain-service.suyesh.workers.dev/api/provision \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Restaurant","email":"test@test.com","phone":"+1234567890","city":"Mumbai","pincode":"400001","tenantId":"test-restaurant-1234","businessCategory":"RESTAURANT","restaurantType":"CASUAL_DINING"}' \
  --max-time 10 \
  -w "\n\nHTTP Status: %{http_code}\n" \
  2>&1 | head -30

echo ""
echo "-----------------------------------"
echo ""

# Test 4: Check handsfree-restaurant-client worker
echo "4. Testing handsfree-restaurant-client.suyesh.workers.dev"
echo "   Endpoint: /api/provision or /api/tenants"
echo ""
curl -X POST https://handsfree-restaurant-client.suyesh.workers.dev/api/provision \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Restaurant","email":"test@test.com","phone":"+1234567890","city":"Mumbai","pincode":"400001","tenantId":"test-restaurant-1234","businessCategory":"RESTAURANT","restaurantType":"CASUAL_DINING"}' \
  --max-time 10 \
  -w "\n\nHTTP Status: %{http_code}\n" \
  2>&1 | head -30

echo ""
echo "==================================="
echo "Diagnosis Complete"
echo "==================================="
echo ""
echo "Summary:"
echo "- If all endpoints return 404: Provisioning workers not deployed"
echo "- If any endpoint returns 500: Server error, check worker logs"
echo "- If any endpoint returns 200: That's the working endpoint!"
echo ""
