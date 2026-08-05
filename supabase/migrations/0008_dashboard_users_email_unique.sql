-- One account per email (case-insensitive). Drop duplicate rows first.

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(email)
      order by (role = 'admin') desc, created_at asc, id asc
    ) as rn
  from dashboard_users
)
delete from dashboard_users
where id in (select id from ranked where rn > 1);

create unique index if not exists dashboard_users_email_lower_unique
  on dashboard_users (lower(email));
