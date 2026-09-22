-- Same as 006-callback-direction.postgres.sql.
alter table traffic add column direction text not null default 'inbound';
