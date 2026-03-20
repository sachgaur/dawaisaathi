-- Enable storage policies (Storage schema normally exists if Supabase sets it up)
-- We need to allow inserts and selects for the prescriptions bucket.

-- 1. Allow authenticated users to upload to the "prescriptions" bucket
create policy "Authenticated users can upload prescription images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'prescriptions'
);

-- 2. Allow public/authenticated users to view the images
create policy "Anyone can view prescription images"
on storage.objects for select to public
using ( bucket_id = 'prescriptions' );
