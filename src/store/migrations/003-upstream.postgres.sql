-- Plan 07: proxy & record from upstream. Additive only — old code that never
-- reads `project.upstream` or `traffic.via_upstream` keeps working unchanged.
alter table project add column upstream jsonb;
alter table traffic add column via_upstream boolean not null default false;
