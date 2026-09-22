START TRANSACTION;
-- Seed: Task #275 scheduled purchase listings.
-- Purpose: adds Laundry Bag, House Plant, and Small Heater listings.
-- Notes: conversations are created through "Message Seller" in the UI, not here.

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Laundry Bag', 'House Plant', 'Small Heater');

-- Insert Laundry Bag listing
INSERT INTO INVENTORY (
  title,
  categories,
  item_location,
  item_condition,
  description,
  photos,
  listing_price,
  item_status,
  trades,
  price_nego,
  date_listed,
  seller_id,
  sold
) VALUES (
  'Laundry Bag',
  JSON_ARRAY('Dorm Essentials', 'Utility'),
  'North Campus',
  'Like New',
  'Laundry bag with a drawstring closure at the top and two carry handles for when it is too full to just grab by the string. Fabric is sturdy and holds a full hamper''s worth of clothes without straining at the seams, at least based on how I used it all year.

Barely used overall since I ended up doing my wash straight out of a hamper most weeks instead of transferring everything into a bag first. It folds down flat when empty, which is nice if you do not have room for a rigid hamper taking up floor space in a small room.

This is being sold on its own, no detergent or other laundry supplies included, and there is no strap for carrying it over a shoulder, just the two handles. $12, and I am open to a lower offer if you are also picking up something else from my listings. Can meet on campus.',
  JSON_ARRAY('/images/laundry-bag-product-image.webp'),
  12.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert House Plant listing
INSERT INTO INVENTORY (
  title,
  categories,
  item_location,
  item_condition,
  description,
  photos,
  listing_price,
  item_status,
  trades,
  price_nego,
  date_listed,
  seller_id,
  sold
) VALUES (
  'House Plant',
  JSON_ARRAY('Decor', 'Dorm Essentials'),
  'North Campus',
  'Like New',
  'House plant in the pot shown in the photos, with healthy green leaves and no yellowing or dropped growth that I have noticed recently. The pot itself is included, so you will not need to find one right away after buying it.

Watering needs really depend on the specific species and the light in your room, so ask me directly about care instead of assuming a generic schedule will work for every plant. I have kept it near a window with decent indirect light, which seems to have worked fine so far without any obvious stress.

If you have pets, it is worth checking whether this particular plant is safe for them before bringing it home. $15, price is firm since I already priced it low for a plant this size. Bring something to keep it upright on the walk back if you are on foot.',
  JSON_ARRAY('/images/small-splant-product-image.jpg'),
  15.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Small Heater listing
INSERT INTO INVENTORY (
  title,
  categories,
  item_location,
  item_condition,
  description,
  photos,
  listing_price,
  item_status,
  trades,
  price_nego,
  date_listed,
  seller_id,
  sold
) VALUES (
  'Small Heater',
  JSON_ARRAY('Dorm Essentials', 'Utility'),
  'North Campus',
  'Like New',
  'Small ceramic heater with a tip over shutoff and overheat protection built in, though obviously those features do not replace using it carefully. Heats up a room within a few minutes and the controls are simple, just a dial rather than anything complicated.

Keep it on a stable, flat surface with clearance away from bedding, curtains, and anything else flammable. Before buying, double check your building''s rules, since a lot of campus housing does not allow portable space heaters at all regardless of safety features.

Selling because I will not need it again next year and do not want it taking up closet space over the summer. No extension cord or other accessories included beyond the heater itself.

Flexible on the $35 price, and happy to demonstrate that it turns on and heats up before you buy. Can meet on campus.',
  JSON_ARRAY('/images/small-heater-product-image.webp'),
  35.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






