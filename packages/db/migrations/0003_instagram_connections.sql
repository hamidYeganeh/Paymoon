CREATE TABLE commerce.instagram_oauth_states (
 state_hash text PRIMARY KEY,
 browser_hash text NOT NULL,
 organization_id uuid NOT NULL REFERENCES commerce.organizations(id),
 user_id uuid NOT NULL REFERENCES commerce.users(id),
 session_hash text NOT NULL REFERENCES commerce.sessions(token_hash) ON DELETE CASCADE,
 scopes text[] NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX instagram_oauth_expiry ON commerce.instagram_oauth_states(expires_at);
CREATE TABLE commerce.instagram_connections (
 organization_id uuid PRIMARY KEY REFERENCES commerce.organizations(id),
 account_id text NOT NULL UNIQUE,
 username text NOT NULL,
 token_ciphertext text NOT NULL,
 scopes text[] NOT NULL,
 expires_at timestamptz NOT NULL,
 refreshed_at timestamptz NOT NULL DEFAULT now(),
 connected_by uuid NOT NULL REFERENCES commerce.users(id),
 connected_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1,
 subscribed_fields text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE commerce.instagram_media (
 organization_id uuid NOT NULL REFERENCES commerce.instagram_connections(organization_id) ON DELETE CASCADE,
 media_id text NOT NULL,
 account_id text NOT NULL,
 payload jsonb NOT NULL,
 synced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,media_id)
);
CREATE TABLE commerce.instagram_deliveries (
 inbox_id uuid NOT NULL REFERENCES commerce.instagram_inbox(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES commerce.instagram_connections(organization_id) ON DELETE CASCADE,
 entry_index integer NOT NULL,
 payload jsonb NOT NULL,
 PRIMARY KEY(inbox_id,entry_index)
);
CREATE INDEX instagram_deliveries_org ON commerce.instagram_deliveries(organization_id);
