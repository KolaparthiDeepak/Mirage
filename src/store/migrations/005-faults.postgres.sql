-- Plan 11: fault injection config. Additive; a project without a `faults`
-- block behaves exactly as before.
alter table project add column faults jsonb;
