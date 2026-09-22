-- Plan 12: outbound callback deliveries are recorded as traffic rows too,
-- distinguished by direction. Additive; existing rows default to 'inbound'.
alter table traffic add column direction text not null default 'inbound';
