insert into storage.buckets (id, name, public)
values ('charity-media', 'charity-media', true)
on conflict (id) do nothing;

drop policy if exists charity_media_admin_select on storage.objects;
create policy charity_media_admin_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'charity-media'
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

drop policy if exists charity_media_admin_insert on storage.objects;
create policy charity_media_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'charity-media'
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

drop policy if exists charity_media_admin_update on storage.objects;
create policy charity_media_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'charity-media'
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    bucket_id = 'charity-media'
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

drop policy if exists charity_media_admin_delete on storage.objects;
create policy charity_media_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'charity-media'
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );
