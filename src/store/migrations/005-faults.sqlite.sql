-- Same as 005-faults.postgres.sql. jsonb -> text (JSON.stringify'd).
alter table project add column faults text;
