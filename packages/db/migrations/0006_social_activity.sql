CREATE TABLE commerce.product_likes(user_id uuid NOT NULL REFERENCES commerce.users(id),product_id uuid NOT NULL REFERENCES commerce.products(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,product_id));
CREATE INDEX product_likes_product ON commerce.product_likes(product_id);
CREATE TABLE commerce.product_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES commerce.products(id),author_id uuid NOT NULL REFERENCES commerce.users(id),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),deleted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX product_comments_page ON commerce.product_comments(product_id,created_at,id) WHERE deleted_at IS NULL;
