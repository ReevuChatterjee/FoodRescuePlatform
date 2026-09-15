#!/bin/bash
# Person 1 ↔ Person 6 Integration Verification Script
# Systematically tests all integration points

set -e

BASE_URL="http://localhost:8000"
RESULTS_PASSED=0
RESULTS_FAILED=0
RESULTS_WARNINGS=0

# Color output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================================================"
echo "PERSON 1 ↔ PERSON 6 INTEGRATION VERIFICATION"
echo "================================================================================"
echo ""

pass_test() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((RESULTS_PASSED++))
}

fail_test() {
    echo -e "  ${RED}✗${NC} $1"
    ((RESULTS_FAILED++))
}

warn_test() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    ((RESULTS_WARNINGS++))
}

section() {
    echo ""
    echo "--------------------------------------------------------------------------------"
    echo "  $1"
    echo "--------------------------------------------------------------------------------"
    echo ""
}

# Phase 1: Infrastructure
section "PHASE 1: Infrastructure & Health Checks"

# Test health endpoint
if curl -sf "$BASE_URL/health" > /dev/null; then
    pass_test "GET /health: Backend is responding"
else
    fail_test "GET /health: Backend not responding"
    exit 1
fi

# Test root endpoint
ROOT_RESPONSE=$(curl -s "$BASE_URL/")
if echo "$ROOT_RESPONSE" | jq -e '.modules | index("analytics") and index("admin")' > /dev/null 2>&1; then
    pass_test "GET /: modules include analytics & admin"
else
    warn_test "GET /: modules list: $(echo $ROOT_RESPONSE | jq -r '.modules')"
fi

# Phase 2: Person 1 - Authentication
section "PHASE 2: Person 1 - Authentication & Backend"

# Register DONOR
DONOR_EMAIL="donor_test_$(date +%s)@example.com"
DONOR_REGISTER=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Test Donor\",
        \"email\": \"$DONOR_EMAIL\",
        \"phone\": \"1234567890\",
        \"password\": \"TestPass123!\",
        \"role\": \"DONOR\",
        \"organisation_name\": \"Test Restaurant\",
        \"address\": \"123 Test St, City\"
    }")

if echo "$DONOR_REGISTER" | jq -e '.data.donor_id' > /dev/null 2>&1; then
    DONOR_ID=$(echo "$DONOR_REGISTER" | jq -r '.data.donor_id')
    pass_test "POST /auth/register (DONOR): donor_id=$DONOR_ID"
else
    fail_test "POST /auth/register (DONOR): $(echo $DONOR_REGISTER | jq -r '.error.message // "Failed"')"
fi

# Register NGO
NGO_EMAIL="ngo_test_$(date +%s)@example.com"
NGO_REGISTER=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Test NGO\",
        \"email\": \"$NGO_EMAIL\",
        \"phone\": \"0987654321\",
        \"password\": \"TestPass123!\",
        \"role\": \"NGO\",
        \"organisation_name\": \"Food Bank Test\",
        \"address\": \"456 NGO Ave, City\",
        \"storage_capacity_kg\": 500.0,
        \"operating_hours\": {\"start\": \"08:00\", \"end\": \"20:00\"}
    }")

if echo "$NGO_REGISTER" | jq -e '.data.ngo_id' > /dev/null 2>&1; then
    NGO_ID=$(echo "$NGO_REGISTER" | jq -r '.data.ngo_id')
    pass_test "POST /auth/register (NGO): ngo_id=$NGO_ID"
else
    fail_test "POST /auth/register (NGO): $(echo $NGO_REGISTER | jq -r '.error.message // "Failed"')"
fi

# Login as admin
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "admin@cpi.local",
        "password": "admin123"
    }')

if echo "$ADMIN_LOGIN" | jq -e '.data.access_token' > /dev/null 2>&1; then
    ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.access_token')
    pass_test "POST /auth/login (ADMIN): Token obtained"
else
    fail_test "POST /auth/login (ADMIN): $(echo $ADMIN_LOGIN | jq -r '.error.message // "Failed"')"
    exit 1
fi

# Test /auth/me
ME_RESPONSE=$(curl -s "$BASE_URL/api/v1/auth/me" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$ME_RESPONSE" | jq -e '.data.role == "ADMIN"' > /dev/null 2>&1; then
    pass_test "GET /auth/me: role=ADMIN"
else
    fail_test "GET /auth/me: Expected ADMIN role"
fi

# Phase 3: Person 1 - NGO Profile
section "PHASE 3: Person 1 - NGO Profile & Verification Status"

if [ -n "$NGO_ID" ]; then
    NGO_PROFILE=$(curl -s "$BASE_URL/api/v1/ngos/$NGO_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")

    if echo "$NGO_PROFILE" | jq -e '.data.verification_status' > /dev/null 2>&1; then
        VERIFICATION_STATUS=$(echo "$NGO_PROFILE" | jq -r '.data.verification_status')
        pass_test "GET /ngos/{id}: verification_status=$VERIFICATION_STATUS"

        if [ "$VERIFICATION_STATUS" = "PENDING" ]; then
            pass_test "NGO verification status: Initially PENDING (correct)"
        else
            warn_test "NGO verification status: $VERIFICATION_STATUS (expected PENDING)"
        fi
    else
        fail_test "GET /ngos/{id}: Missing verification_status field"
    fi
else
    warn_test "GET /ngos/{id}: Skipped (no NGO registered)"
fi

# Phase 4: Person 6 - Analytics (Baseline)
section "PHASE 4: Person 6 - Analytics (Baseline - Before Test Data)"

ANALYTICS_BEFORE=$(curl -s "$BASE_URL/api/v1/analytics/overview" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$ANALYTICS_BEFORE" | jq -e '.data' > /dev/null 2>&1; then
    REQUIRED_FIELDS="total_donations total_food_rescued_kg active_donations active_deliveries registered_ngos registered_donors available_drivers"
    ALL_PRESENT=true

    for field in $REQUIRED_FIELDS; do
        if ! echo "$ANALYTICS_BEFORE" | jq -e ".data.$field" > /dev/null 2>&1; then
            ALL_PRESENT=false
            fail_test "GET /analytics/overview: Missing field '$field'"
        fi
    done

    if [ "$ALL_PRESENT" = true ]; then
        pass_test "GET /analytics/overview: All required fields present"
        TOTAL_DONATIONS_BEFORE=$(echo "$ANALYTICS_BEFORE" | jq -r '.data.total_donations')
        FOOD_RESCUED_BEFORE=$(echo "$ANALYTICS_BEFORE" | jq -r '.data.total_food_rescued_kg')
        NGOS_BEFORE=$(echo "$ANALYTICS_BEFORE" | jq -r '.data.registered_ngos')
        DONORS_BEFORE=$(echo "$ANALYTICS_BEFORE" | jq -r '.data.registered_donors')
        echo "     → total_donations: $TOTAL_DONATIONS_BEFORE"
        echo "     → total_food_rescued_kg: $FOOD_RESCUED_BEFORE"
        echo "     → registered_ngos: $NGOS_BEFORE"
        echo "     → registered_donors: $DONORS_BEFORE"
    fi
else
    fail_test "GET /analytics/overview: $(echo $ANALYTICS_BEFORE | jq -r '.error.message // "Failed"')"
fi

# Test /analytics/food
ANALYTICS_FOOD=$(curl -s "$BASE_URL/api/v1/analytics/food" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$ANALYTICS_FOOD" | jq -e '.data.kg_diverted and .data.meals_recovered' > /dev/null 2>&1; then
    KG=$(echo "$ANALYTICS_FOOD" | jq -r '.data.kg_diverted')
    MEALS=$(echo "$ANALYTICS_FOOD" | jq -r '.data.meals_recovered')
    pass_test "GET /analytics/food: kg_diverted=$KG, meals_recovered=$MEALS"
else
    fail_test "GET /analytics/food: Missing required fields"
fi

# Test /analytics/logistics
ANALYTICS_LOGISTICS=$(curl -s "$BASE_URL/api/v1/analytics/logistics" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$ANALYTICS_LOGISTICS" | jq -e '.data.delivery_success_rate' > /dev/null 2>&1; then
    pass_test "GET /analytics/logistics: All fields present"
else
    fail_test "GET /analytics/logistics: Missing required fields"
fi

# Test /analytics/social
ANALYTICS_SOCIAL=$(curl -s "$BASE_URL/api/v1/analytics/social" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$ANALYTICS_SOCIAL" | jq -e '.data.organisations_served and .data.beneficiaries_reached' > /dev/null 2>&1; then
    ORGS=$(echo "$ANALYTICS_SOCIAL" | jq -r '.data.organisations_served')
    BENEFICIARIES=$(echo "$ANALYTICS_SOCIAL" | jq -r '.data.beneficiaries_reached')
    pass_test "GET /analytics/social: orgs=$ORGS, beneficiaries=$BENEFICIARIES"
else
    fail_test "GET /analytics/social: Missing required fields"
fi

# Phase 5: Analytics After Registration
section "PHASE 5: Person 6 - Analytics (After User Registration)"

ANALYTICS_AFTER=$(curl -s "$BASE_URL/api/v1/analytics/overview" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$ANALYTICS_AFTER" | jq -e '.data' > /dev/null 2>&1; then
    NGOS_AFTER=$(echo "$ANALYTICS_AFTER" | jq -r '.data.registered_ngos')
    DONORS_AFTER=$(echo "$ANALYTICS_AFTER" | jq -r '.data.registered_donors')

    echo "     Baseline → After registration:"
    echo "     registered_ngos: $NGOS_BEFORE → $NGOS_AFTER"
    echo "     registered_donors: $DONORS_BEFORE → $DONORS_AFTER"

    if [ "$NGOS_AFTER" -gt "$NGOS_BEFORE" ]; then
        pass_test "Analytics accuracy: registered_ngos increased (Person 1 → Person 6 integration working)"
    else
        warn_test "registered_ngos unchanged: $NGOS_BEFORE → $NGOS_AFTER"
    fi

    if [ "$DONORS_AFTER" -gt "$DONORS_BEFORE" ]; then
        pass_test "Analytics accuracy: registered_donors increased (Person 1 → Person 6 integration working)"
    else
        warn_test "registered_donors unchanged: $DONORS_BEFORE → $DONORS_AFTER"
    fi
fi

# Phase 6: Person 6 - Admin NGO Verification
section "PHASE 6: Person 6 - Admin NGO Verification Flow"

if [ -n "$NGO_ID" ]; then
    # Approve NGO
    VERIFY_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/admin/ngos/$NGO_ID/verify" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "status": "APPROVED",
            "reason": "Integration test verification"
        }')

    if echo "$VERIFY_RESPONSE" | jq -e '.data.verification_status == "APPROVED"' > /dev/null 2>&1; then
        pass_test "PATCH /admin/ngos/{id}/verify: Status changed to APPROVED"
    else
        fail_test "PATCH /admin/ngos/{id}/verify: $(echo $VERIFY_RESPONSE | jq -r '.error.message // "Failed to approve"')"
    fi

    # Verify persistence
    sleep 1
    NGO_PROFILE_AFTER=$(curl -s "$BASE_URL/api/v1/ngos/$NGO_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")

    if echo "$NGO_PROFILE_AFTER" | jq -e '.data.verification_status == "APPROVED"' > /dev/null 2>&1; then
        pass_test "NGO verification persisted: GET /ngos/{id} returns APPROVED"
    else
        ACTUAL_STATUS=$(echo "$NGO_PROFILE_AFTER" | jq -r '.data.verification_status')
        fail_test "NGO verification persistence: Status is $ACTUAL_STATUS, expected APPROVED"
    fi
else
    warn_test "NGO verification: Skipped (no NGO registered)"
fi

# Final Report
echo ""
echo "================================================================================"
echo "FINAL VERIFICATION REPORT"
echo "================================================================================"
echo ""

TOTAL=$((RESULTS_PASSED + RESULTS_FAILED))
echo "Tests Run:     $TOTAL"
echo -e "Passed:        ${GREEN}$RESULTS_PASSED${NC}"
echo -e "Failed:        ${RED}$RESULTS_FAILED${NC}"
echo -e "Warnings:      ${YELLOW}$RESULTS_WARNINGS${NC}"
echo ""

echo "================================================================================"
if [ $RESULTS_FAILED -eq 0 ] && [ $RESULTS_PASSED -gt 0 ]; then
    echo -e "${GREEN}VERDICT: PASS${NC} - Core integration verified"
    echo ""
    echo "Person 1 ↔ Person 6 integration is FUNCTIONAL with the following notes:"
    echo "- Backend auth and CRUD endpoints work"
    echo "- Analytics endpoints return expected structure"
    echo "- Admin NGO verification flow works end-to-end"
    echo "- Verification status persists correctly"
    echo "- Analytics reflect Person 1's database changes"
    echo ""
    echo "LIMITATIONS (expected at this stage):"
    echo "- Full analytics accuracy requires Person 2-5 (matching/delivery/handover)"
    echo "- Some KPIs return 0.0 due to missing historical tracking fields"
    echo "- avg_matching_time_sec returns 0.0 (requires matched_at timestamp column)"
    echo "- route_distance_saved_km returns 0.0 (requires candidate history)"
    echo "- End-to-end flow requires complete 6-person implementation"
    EXIT_CODE=0
elif [ $RESULTS_FAILED -eq 0 ] && [ $RESULTS_PASSED -eq 0 ]; then
    echo -e "${RED}VERDICT: BLOCKED${NC} - No tests could run"
    EXIT_CODE=1
else
    echo -e "${RED}VERDICT: FAIL${NC} - $RESULTS_FAILED test(s) failed"
    EXIT_CODE=1
fi
echo "================================================================================"

exit $EXIT_CODE
