-- Plan 18: the public docs portal config. Additive; off by default.
alter table project add column docs jsonb;
