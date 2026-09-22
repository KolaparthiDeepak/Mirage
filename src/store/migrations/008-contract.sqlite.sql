-- Same as 008-contract.postgres.sql. jsonb -> text.
alter table project add column contract text;
