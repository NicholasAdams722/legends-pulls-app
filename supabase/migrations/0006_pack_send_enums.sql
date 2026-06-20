-- Pack/Send flow, part 1: add enum values and timestamp columns.
-- Split from the RPC migration because ALTER TYPE ... ADD VALUE
-- must commit before the new values can be referenced.

alter type pull_status add value if not exists 'packed';
alter type pull_status add value if not exists 'sent';

alter table pulls
  add column if not exists packed_at timestamptz,
  add column if not exists sent_at   timestamptz;

create index if not exists pulls_sent_at_idx on pulls(sent_at desc);
