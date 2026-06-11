-- 0014_wallet_binding_deactivate.sql
-- COG-009: allow wallet-binding placeholders to be DEACTIVATED.
--
-- Doctrine note: 'deactivated' is strictly MORE inert than 'placeholder'.
-- There is still no 'active' status, no activation path, no key storage, and
-- no chain activity anywhere in v1.1 (Architecture Lock §5). Widening the
-- check is a new migration — 0012 is never edited.

alter table wallet_bindings drop constraint wallet_bindings_status_check;
alter table wallet_bindings add constraint wallet_bindings_status_check
  check (status in ('placeholder', 'deactivated'));
comment on column wallet_bindings.status is
  'placeholder (inert) or deactivated (more inert). Activation does not exist in v1.1.';
