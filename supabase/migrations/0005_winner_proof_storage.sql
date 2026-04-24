insert into storage.buckets (id, name, public)
values ('winner-proofs', 'winner-proofs', false)
on conflict (id) do nothing;

drop policy if exists winner_proofs_owner_select on storage.objects;
create policy winner_proofs_owner_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists winner_proofs_owner_insert on storage.objects;
create policy winner_proofs_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists winner_proofs_owner_update on storage.objects;
create policy winner_proofs_owner_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists winner_proofs_owner_delete on storage.objects;
create policy winner_proofs_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
