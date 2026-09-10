-- Plan 17: project variables + the default environment name. Additive.
alter table project add column variables jsonb;
alter table project add column default_environment text;
