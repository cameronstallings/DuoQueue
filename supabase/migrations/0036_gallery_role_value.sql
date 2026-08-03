-- Six-photo gallery, part 1 of 2: the enum value alone.
--
-- This lives in its own migration file deliberately. PG 12+ allows ALTER TYPE ... ADD
-- VALUE inside a transaction block, but the new value still cannot be USED in the same
-- transaction that added it ("unsafe use of new value" — the lifted restriction was
-- only on running ADD VALUE transactionally, not on using the result). Each migration
-- file runs in its own transaction, so splitting the ADD VALUE from the DDL that
-- references 'gallery' (0037) makes both the hosted apply and a fresh `db reset` work.
alter type photo_role_enum add value if not exists 'gallery';
