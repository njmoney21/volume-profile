update concepts set category = 'General' where category not in
  ('Setups', 'Risk Management', 'Psychology', 'Market Structure', 'General');

alter table concepts add constraint concepts_category_check
  check (category in ('Setups', 'Risk Management', 'Psychology', 'Market Structure', 'General'));
