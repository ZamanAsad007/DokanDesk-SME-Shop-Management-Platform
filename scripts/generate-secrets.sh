#!/usr/bin/env bash
set -euo pipefail

# DokanDesk Local Secret Generator
# Writes generated secrets ONLY to the gitignored .env file.
# NEVER prints secret values to stdout or logs.

ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

if [ ! -f "$EXAMPLE_FILE" ]; then
  echo "Error: $EXAMPLE_FILE not found." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE from $EXAMPLE_FILE..."
  cp "$EXAMPLE_FILE" "$ENV_FILE"
fi

echo "Generating cryptographically secure secrets for local development..."

generate_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
  fi
}

replace_or_append() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # sed in-place replacement
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# Generate secrets
JWT_ACCESS_SECRET=$(generate_hex)
JWT_REFRESH_SECRET=$(generate_hex)
DB_PASS=$(generate_hex | cut -c1-24)

# Update .env
replace_or_append "JWT_ACCESS_SECRET" "$JWT_ACCESS_SECRET"
replace_or_append "JWT_REFRESH_SECRET" "$JWT_REFRESH_SECRET"
replace_or_append "POSTGRES_PASSWORD" "$DB_PASS"

# Update DATABASE_URL with the new password
replace_or_append "DATABASE_URL" "postgresql://dokandesk_user:${DB_PASS}@localhost:5432/dokandesk_dev?schema=public"

echo "Successfully updated secrets in $ENV_FILE."
echo "Note: .env is gitignored and will never be committed or pushed."
