alter table trades add column position_size decimal(10,2) not null default 0;
alter table trades add column result text not null default 'breakeven' check (result in ('win','loss','breakeven'));

alter table trades drop column entry_price;
alter table trades drop column exit_price;
alter table trades drop column contracts;

alter table trades alter column position_size drop default;
alter table trades alter column result drop default;
