-- Dashboard payment badge reads deliveries.payment_status, which was derived from
-- orders.payment_method — not invoices. Dev-free / coupon / Razorpay mark invoices paid
-- without updating payment_method, so ops saw "unpaid" after successful payment.

create or replace function public.order_payment_status(o public.orders)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select case lower(i.payment_status::text)
        when 'paid' then 'paid'
        when 'free' then 'free'
        when 'partial' then 'partial'
        when 'failed' then 'unpaid'
        when 'pending' then 'unpaid'
        else null
      end
      from public.invoices i
      where i.order_id = o.id
      limit 1
    ),
    case
      when coalesce(o.total_price, 0) = 0 then 'paid'
      when lower(coalesce(o.payment_method->>'type', o.payment_method->>'method', '')) like '%coupon%' then 'paid'
      when lower(coalesce(o.payment_method->>'status', '')) in ('paid', 'success', 'completed') then 'paid'
      when lower(coalesce(o.payment_method->>'status', '')) in ('unpaid', 'pending', 'failed') then 'unpaid'
      when o.status in ('delivered', 'picked_up') then 'paid'
      else 'unpaid'
    end
  );
$$;

create or replace function public.order_payment_mode(o public.orders)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select case
        when lower(i.payment_status::text) <> 'paid' then null
        when lower(coalesce(i.provider, '')) = 'coupon' then 'coupon'
        when coalesce(o.total_price, 0) = 0 then 'coupon'
        when lower(coalesce(i.provider, '')) = 'dev' then 'online'
        when nullif(trim(lower(coalesce(i.payment_method::text, ''))), '') is not null
          then trim(lower(i.payment_method::text))
        else 'online'
      end
      from public.invoices i
      where i.order_id = o.id
      limit 1
    ),
    case
      when coalesce(o.total_price, 0) = 0 then 'coupon'
      when lower(coalesce(o.payment_method->>'type', '')) like '%coupon%' then 'coupon'
      when nullif(trim(coalesce(o.payment_method->>'method', o.payment_method->>'type', '')), '') is not null
        then lower(trim(coalesce(o.payment_method->>'method', o.payment_method->>'type', '')))
      when o.status in ('delivered', 'picked_up') and coalesce(o.total_price, 0) > 0 then 'online'
      else null
    end
  );
$$;

create or replace function public.sync_delivery_payment_from_invoice(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_status text;
  v_mode text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return; end if;

  v_status := public.order_payment_status(v_order);
  v_mode := public.order_payment_mode(v_order);

  update public.deliveries
     set payment_status = v_status,
         payment_mode = coalesce(v_mode, payment_mode)
   where app_order_id = p_order_id;
end;
$$;

create or replace function public.finalize_order_on_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_knight_name text;
  v_status text;
  v_mode text;
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    select * into v_order from public.orders where id = new.order_id for update;
    if not found then
      return new;
    end if;

    v_status := public.order_payment_status(v_order);
    v_mode := public.order_payment_mode(v_order);

    if v_order.pending_knight_id is not null and v_order.assigned_knight_id is null then
      select p.name into v_knight_name from public.profiles p where p.id = v_order.pending_knight_id;
      update public.orders
         set assigned_knight_id = v_order.pending_knight_id,
             pending_knight_id = null,
             assigned_at = coalesce(assigned_at, now()),
             rider_name = coalesce(rider_name, v_knight_name),
             rider_assigned_at = coalesce(rider_assigned_at, now()),
             payment_deadline_at = null,
             status = case
               when status::text in ('placed', 'pending', 'registered', 'accepted', 'confirmed') then 'assigned'
               else status
             end
       where id = v_order.id;
    else
      update public.orders
         set payment_deadline_at = null
       where id = new.order_id;
    end if;

    update public.deliveries d
       set fulfillment_status = case
             when d.fulfillment_status in ('booked', 'accepted') then 'accepted'
             else d.fulfillment_status
           end,
           payment_status = v_status,
           payment_mode = coalesce(v_mode, d.payment_mode),
           knight_name = coalesce(
             d.knight_name,
             (select p.name from public.orders o join public.profiles p on p.id = o.assigned_knight_id where o.id = new.order_id)
           )
     where d.app_order_id = new.order_id;
  end if;

  return new;
end;
$$;

-- Backfill app deliveries whose invoice is already paid.
update public.deliveries d
   set payment_status = public.order_payment_status(o),
       payment_mode = coalesce(public.order_payment_mode(o), d.payment_mode)
  from public.orders o
  join public.invoices i on i.order_id = o.id
 where d.app_order_id = o.id
   and lower(i.payment_status::text) = 'paid'
   and coalesce(d.payment_status, 'unpaid') <> 'paid';

do $$ begin
  alter publication supabase_realtime add table public.invoices;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
