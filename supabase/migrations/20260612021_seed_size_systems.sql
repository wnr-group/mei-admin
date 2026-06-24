INSERT INTO size_systems (name, description) VALUES
  ('MEI Standard', 'Indian numeric sizing based on bust measurement'),
  ('Blouse Sizes',  'Standard blouse sizes for choli/blouse pieces'),
  ('Free Size',     'One size fits all with adjustment allowance')
ON CONFLICT (name) DO NOTHING;

INSERT INTO size_system_entries (system_id, label, sort_order, bust_cm, waist_cm, hip_cm)
SELECT s.id, v.label, v.sort_order, v.bust, v.waist, v.hip
FROM size_systems s,
  (VALUES ('34',0,86.0,68.0,91.0),('36',1,91.0,73.0,96.0),
          ('38',2,96.0,78.0,101.0),('40',3,101.0,83.0,106.0),
          ('42',4,106.0,88.0,111.0),('44',5,111.0,93.0,116.0)) AS v(label,sort_order,bust,waist,hip)
WHERE s.name = 'MEI Standard'
ON CONFLICT (system_id, label) DO NOTHING;

INSERT INTO size_system_entries (system_id, label, sort_order)
SELECT id, 'Free Size', 0 FROM size_systems WHERE name = 'Free Size'
ON CONFLICT (system_id, label) DO NOTHING;
