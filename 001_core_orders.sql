-- KiranaX core schema (subset) + atomic order creation.
-- Prices and totals are computed from the DB, never from caller input.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  full_name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, phone)
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  name text NOT NULL,
  normalized_name text NOT NULL,
  category text,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  product_id uuid NOT NULL UNIQUE REFERENCES products(id),
  stock_quantity integer NOT NULL CHECK (stock_quantity >= 0),  -- DB-level oversell guard
  low_stock_threshold integer NOT NULL DEFAULT 5,
  selling_price numeric(10,2) NOT NULL CHECK (selling_price >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES stores(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  status text NOT NULL DEFAULT 'CONFIRMED',
  subtotal numeric(10,2) NOT NULL,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  loyalty_benefit text,
  total numeric(10,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'NOT_IMPLEMENTED',
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- duplicate requests from the same customer can never create two orders
  UNIQUE (store_id, customer_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  order_id uuid REFERENCES orders(id),
  transaction_type text NOT NULL,
  quantity_change integer NOT NULL,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- p_items: [{"product_id": "<uuid>", "quantity": 2}, ...]
-- Raises INSUFFICIENT_STOCK (SQLSTATE 'KX409') so the API can map it to HTTP 409.
-- Delivery fee / discount / loyalty come from the service layer's rule evaluation.
CREATE OR REPLACE FUNCTION create_order_atomic(
  p_store_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_delivery_fee numeric,
  p_discount numeric,
  p_loyalty_benefit text,
  p_idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_item record;
  v_inv record;
BEGIN
  -- Idempotency: return the existing order if this key was already used.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_order_id FROM orders
    WHERE store_id = p_store_id AND customer_id = p_customer_id
      AND idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_order_id; END IF;
  END IF;

  INSERT INTO orders (order_number, store_id, customer_id, subtotal, total, idempotency_key)
  VALUES ('KX-' || nextval('order_number_seq'), p_store_id, p_customer_id, 0, 0, p_idempotency_key)
  RETURNING id INTO v_order_id;

  -- Lock inventory rows in a fixed order (product_id) to avoid deadlocks
  -- when two orders contain the same products in different sequence.
  FOR v_item IN
    SELECT (e->>'product_id')::uuid AS product_id, sum((e->>'quantity')::int) AS qty
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1 ORDER BY 1
  LOOP
    SELECT i.*, p.name INTO v_inv
    FROM inventory i JOIN products p ON p.id = i.product_id
    WHERE i.product_id = v_item.product_id AND i.store_id = p_store_id AND p.active
    FOR UPDATE OF i;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', v_item.product_id USING ERRCODE = 'KX404';
    END IF;
    IF v_inv.stock_quantity < v_item.qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: % has %, requested %',
        v_inv.name, v_inv.stock_quantity, v_item.qty USING ERRCODE = 'KX409';
    END IF;

    UPDATE inventory SET stock_quantity = stock_quantity - v_item.qty, updated_at = now()
    WHERE id = v_inv.id;

    INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, subtotal)
    VALUES (v_order_id, v_item.product_id, v_inv.name, v_item.qty,
            v_inv.selling_price, v_inv.selling_price * v_item.qty);

    INSERT INTO inventory_transactions
      (store_id, product_id, order_id, transaction_type, quantity_change,
       previous_quantity, new_quantity, reason)
    VALUES (p_store_id, v_item.product_id, v_order_id, 'SALE', -v_item.qty,
            v_inv.stock_quantity, v_inv.stock_quantity - v_item.qty, 'Order sale');

    v_subtotal := v_subtotal + v_inv.selling_price * v_item.qty;
  END LOOP;

  UPDATE orders
  SET subtotal = v_subtotal,
      delivery_fee = p_delivery_fee,
      discount = p_discount,
      loyalty_benefit = p_loyalty_benefit,
      total = v_subtotal + p_delivery_fee - p_discount
  WHERE id = v_order_id;

  RETURN v_order_id;  -- any RAISE above aborts the whole function: order, items, stock all roll back
END;
$$;
