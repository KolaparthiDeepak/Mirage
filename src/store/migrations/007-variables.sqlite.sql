-- Same as 007-variables.postgres.sql. jsonb -> text.
alter table project add column variables text;
alter table project add column default_environment text;
