insert into branches (code, name) values
  ('hoang-gia', 'Cơ sở Hoàng Gia'),
  ('ho-xuong-rong', 'Cơ sở Hồ Xương Rồng');

insert into desks (branch_id, label)
select b.id, 'Chỗ ' || n
from branches b, generate_series(1, 10) n;
