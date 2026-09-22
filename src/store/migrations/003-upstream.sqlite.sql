-- Same as 003-upstream.postgres.sql. jsonb -> text (JSON.stringify'd), boolean
-- -> integer 0/1. Additive only.
alter table project add column upstream text;
alter table traffic add column via_upstream integer not null default 0;
