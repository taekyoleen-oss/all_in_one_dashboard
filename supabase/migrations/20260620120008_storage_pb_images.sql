-- 008 Storage: pb-images 비공개 버킷 + 경로 prefix 격리(§5.2/§5.3)
-- 경로: {user_id}/{instance_id}/{file}. 클라이언트는 서명 URL로만 접근.

insert into storage.buckets (id, name, public)
values ('pb-images', 'pb-images', false)
on conflict (id) do nothing;

-- storage.objects는 Supabase가 RLS를 이미 활성화. 버킷 + 경로 1번째 세그먼트 = uid 일치 시만 허용.
drop policy if exists pb_images_rw on storage.objects;
create policy pb_images_rw on storage.objects
  for all
  using (
    bucket_id = 'pb-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'pb-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
