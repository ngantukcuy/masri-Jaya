-- POS carts are stored in one draft row per customer (id = "cart:<customer id>").
-- Remove the legacy singleton-only check if it still exists in this database.
alter table public.pos_cart_drafts
  drop constraint if exists pos_cart_drafts_id_check;
