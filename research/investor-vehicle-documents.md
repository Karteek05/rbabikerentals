# Investor–vehicle attribution and private documents

**Research checked:** 2026-10-17. Sources below are first-party PostgreSQL and Supabase documentation; recommendations are application design decisions, not requirements imposed by those sources.

## Recommended model

Represent investor-to-vehicle attribution with a relational join table (for example, `investor_vehicles`) containing non-null foreign keys to the investor and vehicle records. Use a composite primary key/unique constraint on `(investor_id, vehicle_id)` if only one current attribution row per pair is allowed. PostgreSQL documents this join-table pattern for many-to-many relationships and supports enforcing valid references with foreign keys and duplicate-pair prevention with a composite primary key【1】.

**App decision:** This is preferable to arrays/JSON or duplicating investor IDs on vehicle rows: both sides remain independently addressable, referential integrity is database-enforced, and relationship-specific fields can live on the relationship. Add fields such as allocation percentage, attribution type, or effective dates only when the product's business rules define them. If allocations are percentage-based, enforce per-row bounds in the database; do not assume percentages sum to 100% without deciding whether partial/unallocated shares are allowed and how concurrent changes are validated. If historical attribution must be auditable, preserve dated attribution records rather than overwriting the sole relationship row; decide explicitly how to prevent overlapping effective periods. These are app/domain decisions, not behaviors supplied by the cited PostgreSQL constraints.

Use `ON DELETE RESTRICT`/default `NO ACTION` for independent investors and vehicles when historical or financial attribution must not disappear implicitly; consider `CASCADE` only for dependent join rows when deleting a parent is explicitly allowed. PostgreSQL explains these referential actions and their differing semantics【1】. The composite key supports lookups by investor-first key order; add an index beginning with `vehicle_id` if vehicle-centric reverse lookups need it—PostgreSQL does not automatically index referencing foreign-key columns【1】.

**Selected project model:** This codebase already stores one `vehicles.owner_id` foreign key to the partner/investor account and uses it to scope the investor's fleet, documents, and analytics. Keep that single-investor-per-vehicle model; do not duplicate the investor's display name or add a join table until co-investment shares, allocation percentages, and historical ownership rules are defined. Add an index on `vehicles(owner_id)` for the investor fleet/analytics queries. This is an explicit current product assumption, not a general recommendation for multi-investor ownership.


## Private vehicle/investor documents

Store sensitive agreements, identity/ownership evidence, and similar files in a **private Supabase Storage bucket**. Private buckets apply RLS to downloads; access is via an authorized download request or a time-limited signed URL. Public buckets bypass access control for serving/retrieval, so they are not appropriate for these records【2】. Keep document metadata in an app-owned table linked to its investor, vehicle, or attribution record (as applicable); store a bucket and object path, not a public URL. Treat the Storage schema as read-only and use Storage APIs for object operations: deleting Storage metadata through SQL can orphan the actual provider object【3】.

**App decision:** Put authorization at the relationship boundary: permit access only to authenticated staff/roles or the investor who is entitled to that specific record, using policies that verify the document's associated investor/vehicle relationship—not merely that the requester is signed in or knows a path. Keep service-role credentials on trusted server code only; Supabase states they bypass RLS entirely【4】. Generate signed URLs only after that app-level authorization check and use a short expiration appropriate to the viewing flow; a signed URL is a time-bounded bearer link, not a replacement for checking who may obtain one【2】【5】. Define retention, auditability, file type/size limits, and access for staff as explicit product/security policy.

For replacement, **upload the new file to a fresh, non-reused object path first**, then update the app metadata pointer, and only after that succeeds remove the old object through the Storage API. This ordering avoids destroying the current document before its replacement is stored. Supabase's upload API supports `upsert`, but overwriting requires `SELECT` and `UPDATE` Storage RLS permissions in addition to upload's `INSERT`; separate paths avoid granting broader overwrite rights merely for replacement【4】【6】. If metadata update or old-object removal fails, record enough state to retry cleanup; this compensation/retry bookkeeping is an app decision because the database and object store are not one transaction. Do not delete `storage.objects` rows directly. Supabase warns Storage removal is permanent and not recoverable, so confirm the new pointer before cleanup【3】.

## Sources (checked 2026-10-17)

1. PostgreSQL Global Development Group, *PostgreSQL 18 Documentation, 5.5 Constraints* (published 2026-08-13): https://www.postgresql.org/docs/18/ddl-constraints.html — join tables, primary/foreign keys, deletion actions, and referencing-column indexes.
2. Supabase, *Storage Buckets*: https://supabase.com/docs/guides/storage/buckets/fundamentals — private/public access models and signed URL access for private objects.
3. Supabase, *The Storage Schema*: https://supabase.com/docs/guides/storage/schema/design — storage metadata versus underlying objects; use the API rather than SQL for object operations.
4. Supabase, *Storage Access Control*: https://supabase.com/docs/guides/storage/security/access-control — default-deny policy model, required permissions for upload/upsert, and service-key RLS bypass.
5. Supabase, *JavaScript: createSignedUrl*: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl — expiration duration for a signed URL.
6. Supabase, *JavaScript: upload*: https://supabase.com/docs/reference/javascript/storage-from-upload — upload path, `upsert` option, and upload behavior.
7. Supabase, *Delete Objects*: https://supabase.com/docs/guides/storage/management/delete-objects — permanent removal, Storage API `remove`, and warning against SQL deletion.

Supabase pages do not expose a publication/update date in the documentation content reviewed; their citations are therefore dated by this research check date, not presented as publication dates.
