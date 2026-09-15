# Backend Unit Tests

## Ownership

- **Person 1**: Auth tests, database tests, API endpoint tests
- **Person 4**: `test_matching.py` - matching algorithm unit tests
- **Person 6**: Test infrastructure, CI configuration, `test_health.py`

## What Person 1 Should Create

Person 1 should add unit tests covering:

1. **Authentication** (`test_auth.py`):
   - User registration
   - Login/logout
   - Token generation and validation
   - Password hashing
   - Role-based access control

2. **Database** (`test_database.py`):
   - Model CRUD operations
   - Database migrations
   - Connection pooling
   - Transaction handling

3. **API Endpoints** (`test_api.py`):
   - Request validation
   - Response formatting
   - Error handling
   - Rate limiting

## What Person 4 Should Create

Person 4 should add `test_matching.py` covering:

1. Matching algorithm correctness
2. Candidate scoring logic
3. Capacity constraint handling
4. Expiry time validation
5. Category filtering
6. Edge cases and error conditions

## Running Tests

From the `backend/` directory:

```bash
# Run all backend unit tests
poetry run pytest tests/ -v

# Run with coverage
poetry run pytest tests/ -v --cov=app --cov-report=term-missing

# Run specific test file
poetry run pytest tests/test_health.py -v
```

## CI Behavior

The GitHub Actions workflow runs these tests from `backend/` working directory:
```bash
poetry run pytest tests/ -v --cov=app --cov-report=xml
```

Integration tests live at project root: `../tests/integration/`
