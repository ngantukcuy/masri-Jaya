-- =============================================================================
-- Pindahin data dari skema lama (tabel legacy_*) ke tabel per kolom.
-- DIGENERATE oleh generate-schema.mjs. Jalankan SETELAH schema.sql.
-- Aman diulang (on conflict do nothing) dan tidak menghapus tabel legacy_*.
-- =============================================================================
do $$
begin
  if to_regclass('public.legacy_products') is not null then
    insert into public."products" ("sku", "name", "category", "unit", "retail_price", "wholesale_price", "project_price", "stock", "stock_status", "last_restock", "supplier", "last_restock_qty", "lead_time", "warehouse_location", "image", "product_type", "alias", "brand", "category1", "category2", "category3", "barcode", "cost_price", "min_sell_price", "standard_sell_price", "show_low_stock_alert", "min_stock_qty", "show_in_deadstock", "deadstock_period_months", "sku_location_id", "parent_sku", "conversion_value", "allow_decimal_qty", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), (l.data -> 'category' #>> '{}'), (l.data -> 'unit' #>> '{}'), case when jsonb_typeof(l.data -> 'retailPrice') = 'number' then (l.data -> 'retailPrice' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'wholesalePrice') = 'number' then (l.data -> 'wholesalePrice' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'projectPrice') = 'number' then (l.data -> 'projectPrice' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'stock') = 'number' then (l.data -> 'stock' #>> '{}')::numeric end, (l.data -> 'stockStatus' #>> '{}'), (l.data -> 'lastRestock' #>> '{}'), (l.data -> 'supplier' #>> '{}'), case when jsonb_typeof(l.data -> 'lastRestockQty') = 'number' then (l.data -> 'lastRestockQty' #>> '{}')::numeric end, (l.data -> 'leadTime' #>> '{}'), (l.data -> 'warehouseLocation' #>> '{}'), (l.data -> 'image' #>> '{}'), (l.data -> 'productType' #>> '{}'), (l.data -> 'alias' #>> '{}'), (l.data -> 'brand' #>> '{}'), (l.data -> 'category1' #>> '{}'), (l.data -> 'category2' #>> '{}'), (l.data -> 'category3' #>> '{}'), (l.data -> 'barcode' #>> '{}'), case when jsonb_typeof(l.data -> 'costPrice') = 'number' then (l.data -> 'costPrice' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'minSellPrice') = 'number' then (l.data -> 'minSellPrice' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'standardSellPrice') = 'number' then (l.data -> 'standardSellPrice' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'showLowStockAlert') = 'boolean' then (l.data -> 'showLowStockAlert' #>> '{}')::boolean end, case when jsonb_typeof(l.data -> 'minStockQty') = 'number' then (l.data -> 'minStockQty' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'showInDeadstock') = 'boolean' then (l.data -> 'showInDeadstock' #>> '{}')::boolean end, case when jsonb_typeof(l.data -> 'deadstockPeriodMonths') = 'number' then (l.data -> 'deadstockPeriodMonths' #>> '{}')::numeric end, (l.data -> 'skuLocationId' #>> '{}'), (l.data -> 'parentSku' #>> '{}'), case when jsonb_typeof(l.data -> 'conversionValue') = 'number' then (l.data -> 'conversionValue' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'allowDecimalQty') = 'boolean' then (l.data -> 'allowDecimalQty' #>> '{}')::boolean end, l.created_at, l.updated_at from public.legacy_products l
    on conflict ("sku") do nothing;
    if not exists (select 1 from public."product_sell_units" limit 1) then
      insert into public."product_sell_units" (parent_key, position, "label", "factor", "price")
      select l.key, (e.ord - 1)::int, (e.elem -> 'label' #>> '{}'), case when jsonb_typeof(e.elem -> 'factor') = 'number' then (e.elem -> 'factor' #>> '{}')::numeric end, case when jsonb_typeof(e.elem -> 'price') = 'number' then (e.elem -> 'price' #>> '{}')::numeric end
      from public.legacy_products l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'sellUnits') = 'array' then l.data -> 'sellUnits' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."products" p where p."sku" = l.key);
    end if;
  end if;

  if to_regclass('public.legacy_purchase_orders') is not null then
    insert into public."purchase_orders" ("po_number", "supplier", "total", "status", "created_date", "logistics_note", "payment_method", "delivery_note_number", "tax_included", "total_discount", "additional_cost", "additional_cost_name", "received_at", "due_date", "paid_at", "paid_amount", "paid_method", "dropship", "dropship_note", "direct_to_customer", "direct_to_customer_name", db_created_at, db_updated_at)
    select l.key, (l.data -> 'supplier' #>> '{}'), case when jsonb_typeof(l.data -> 'total') = 'number' then (l.data -> 'total' #>> '{}')::numeric end, (l.data -> 'status' #>> '{}'), (l.data -> 'createdDate' #>> '{}'), (l.data -> 'logisticsNote' #>> '{}'), (l.data -> 'paymentMethod' #>> '{}'), (l.data -> 'deliveryNoteNumber' #>> '{}'), case when jsonb_typeof(l.data -> 'taxIncluded') = 'boolean' then (l.data -> 'taxIncluded' #>> '{}')::boolean end, case when jsonb_typeof(l.data -> 'totalDiscount') = 'number' then (l.data -> 'totalDiscount' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'additionalCost') = 'number' then (l.data -> 'additionalCost' #>> '{}')::numeric end, (l.data -> 'additionalCostName' #>> '{}'), (l.data -> 'receivedAt' #>> '{}'), (l.data -> 'dueDate' #>> '{}'), (l.data -> 'paidAt' #>> '{}'), case when jsonb_typeof(l.data -> 'paidAmount') = 'number' then (l.data -> 'paidAmount' #>> '{}')::numeric end, (l.data -> 'paidMethod' #>> '{}'), case when jsonb_typeof(l.data -> 'dropship') = 'boolean' then (l.data -> 'dropship' #>> '{}')::boolean end, (l.data -> 'dropshipNote' #>> '{}'), case when jsonb_typeof(l.data -> 'directToCustomer') = 'boolean' then (l.data -> 'directToCustomer' #>> '{}')::boolean end, (l.data -> 'directToCustomerName' #>> '{}'), l.created_at, l.updated_at from public.legacy_purchase_orders l
    on conflict ("po_number") do nothing;
    if not exists (select 1 from public."purchase_order_items" limit 1) then
      insert into public."purchase_order_items" (parent_key, position, "name", "sku", "quantity", "price", "tax_included", "discount_per_unit", "total_discount", "location_id", "bonus")
      select l.key, (e.ord - 1)::int, (e.elem -> 'name' #>> '{}'), (e.elem -> 'sku' #>> '{}'), case when jsonb_typeof(e.elem -> 'quantity') = 'number' then (e.elem -> 'quantity' #>> '{}')::numeric end, case when jsonb_typeof(e.elem -> 'price') = 'number' then (e.elem -> 'price' #>> '{}')::numeric end, case when jsonb_typeof(e.elem -> 'taxIncluded') = 'boolean' then (e.elem -> 'taxIncluded' #>> '{}')::boolean end, case when jsonb_typeof(e.elem -> 'discountPerUnit') = 'number' then (e.elem -> 'discountPerUnit' #>> '{}')::numeric end, case when jsonb_typeof(e.elem -> 'totalDiscount') = 'number' then (e.elem -> 'totalDiscount' #>> '{}')::numeric end, (e.elem -> 'locationId' #>> '{}'), case when jsonb_typeof(e.elem -> 'bonus') = 'boolean' then (e.elem -> 'bonus' #>> '{}')::boolean end
      from public.legacy_purchase_orders l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'items') = 'array' then l.data -> 'items' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."purchase_orders" p where p."po_number" = l.key);
    end if;
    if not exists (select 1 from public."purchase_order_payments" limit 1) then
      insert into public."purchase_order_payments" (parent_key, position, "id", "amount", "method", "date", "proof_url", "by")
      select l.key, (e.ord - 1)::int, (e.elem -> 'id' #>> '{}'), case when jsonb_typeof(e.elem -> 'amount') = 'number' then (e.elem -> 'amount' #>> '{}')::numeric end, (e.elem -> 'method' #>> '{}'), (e.elem -> 'date' #>> '{}'), (e.elem -> 'proofUrl' #>> '{}'), (e.elem -> 'by' #>> '{}')
      from public.legacy_purchase_orders l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'paymentHistory') = 'array' then l.data -> 'paymentHistory' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."purchase_orders" p where p."po_number" = l.key);
    end if;
    if not exists (select 1 from public."purchase_order_paid_history" limit 1) then
      insert into public."purchase_order_paid_history" (parent_key, position, "date", "amount", "method", "receipt_name")
      select l.key, (e.ord - 1)::int, (e.elem -> 'date' #>> '{}'), case when jsonb_typeof(e.elem -> 'amount') = 'number' then (e.elem -> 'amount' #>> '{}')::numeric end, (e.elem -> 'method' #>> '{}'), (e.elem -> 'receiptName' #>> '{}')
      from public.legacy_purchase_orders l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'paidHistory') = 'array' then l.data -> 'paidHistory' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."purchase_orders" p where p."po_number" = l.key);
    end if;
  end if;

  if to_regclass('public.legacy_customers') is not null then
    insert into public."customers" ("id", "name", "loyalty_tier", "points", "current_debt", "total_purchases", "debt_status", "overdue_amount", "pending_amount", "logo_letters", "customer_type", "phone", "address", "payment_terms", "tempo_days", "credit_limit", "deposit_balance", "next_due_date", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), (l.data -> 'loyaltyTier' #>> '{}'), case when jsonb_typeof(l.data -> 'points') = 'number' then (l.data -> 'points' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'currentDebt') = 'number' then (l.data -> 'currentDebt' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'totalPurchases') = 'number' then (l.data -> 'totalPurchases' #>> '{}')::numeric end, (l.data -> 'debtStatus' #>> '{}'), case when jsonb_typeof(l.data -> 'overdueAmount') = 'number' then (l.data -> 'overdueAmount' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'pendingAmount') = 'number' then (l.data -> 'pendingAmount' #>> '{}')::numeric end, (l.data -> 'logoLetters' #>> '{}'), (l.data -> 'customerType' #>> '{}'), (l.data -> 'phone' #>> '{}'), (l.data -> 'address' #>> '{}'), (l.data -> 'paymentTerms' #>> '{}'), case when jsonb_typeof(l.data -> 'tempoDays') = 'number' then (l.data -> 'tempoDays' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'creditLimit') = 'number' then (l.data -> 'creditLimit' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'depositBalance') = 'number' then (l.data -> 'depositBalance' #>> '{}')::numeric end, (l.data -> 'nextDueDate' #>> '{}'), l.created_at, l.updated_at from public.legacy_customers l
    on conflict ("id") do nothing;
    if not exists (select 1 from public."customer_transactions" limit 1) then
      insert into public."customer_transactions" (parent_key, position, "order_name", "date", "amount", "created_at")
      select l.key, (e.ord - 1)::int, (e.elem -> 'orderName' #>> '{}'), (e.elem -> 'date' #>> '{}'), case when jsonb_typeof(e.elem -> 'amount') = 'number' then (e.elem -> 'amount' #>> '{}')::numeric end, (e.elem -> 'createdAt' #>> '{}')
      from public.legacy_customers l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'lastTransactions') = 'array' then l.data -> 'lastTransactions' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."customers" p where p."id" = l.key);
    end if;
    if not exists (select 1 from public."customer_deposit_transactions" limit 1) then
      insert into public."customer_deposit_transactions" (parent_key, position, "id", "type", "amount", "method", "date")
      select l.key, (e.ord - 1)::int, (e.elem -> 'id' #>> '{}'), (e.elem -> 'type' #>> '{}'), case when jsonb_typeof(e.elem -> 'amount') = 'number' then (e.elem -> 'amount' #>> '{}')::numeric end, (e.elem -> 'method' #>> '{}'), (e.elem -> 'date' #>> '{}')
      from public.legacy_customers l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'depositHistory') = 'array' then l.data -> 'depositHistory' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."customers" p where p."id" = l.key);
    end if;
  end if;

  if to_regclass('public.legacy_suppliers') is not null then
    insert into public."suppliers" ("name", "rating", "recent_po", "debt", "lead_time_stability", "logo_letters", "phone", "npwp", "address", "sales_name", "sales_phone", "top_days", db_created_at, db_updated_at)
    select l.key, case when jsonb_typeof(l.data -> 'rating') = 'number' then (l.data -> 'rating' #>> '{}')::numeric end, (l.data -> 'recentPO' #>> '{}'), case when jsonb_typeof(l.data -> 'debt') = 'number' then (l.data -> 'debt' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'leadTimeStability') = 'number' then (l.data -> 'leadTimeStability' #>> '{}')::numeric end, (l.data -> 'logoLetters' #>> '{}'), (l.data -> 'phone' #>> '{}'), (l.data -> 'npwp' #>> '{}'), (l.data -> 'address' #>> '{}'), (l.data -> 'salesName' #>> '{}'), (l.data -> 'salesPhone' #>> '{}'), case when jsonb_typeof(l.data -> 'topDays') = 'number' then (l.data -> 'topDays' #>> '{}')::numeric end, l.created_at, l.updated_at from public.legacy_suppliers l
    on conflict ("name") do nothing;
    if not exists (select 1 from public."supplier_sales_contacts" limit 1) then
      insert into public."supplier_sales_contacts" (parent_key, position, "name", "phone")
      select l.key, (e.ord - 1)::int, (e.elem -> 'name' #>> '{}'), (e.elem -> 'phone' #>> '{}')
      from public.legacy_suppliers l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'additionalSales') = 'array' then l.data -> 'additionalSales' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."suppliers" p where p."name" = l.key);
    end if;
  end if;

  if to_regclass('public.legacy_expenses') is not null then
    insert into public."expenses" ("id", "date", "category", "description", "submitted_by", "amount", "receipt_name", "receipt_url", "status", "payment_method", "expense_date", "receipt_file", "approved_by", "approved_at", db_created_at, db_updated_at)
    select l.key, (l.data -> 'date' #>> '{}'), (l.data -> 'category' #>> '{}'), (l.data -> 'description' #>> '{}'), (l.data -> 'submittedBy' #>> '{}'), case when jsonb_typeof(l.data -> 'amount') = 'number' then (l.data -> 'amount' #>> '{}')::numeric end, (l.data -> 'receiptName' #>> '{}'), (l.data -> 'receiptUrl' #>> '{}'), (l.data -> 'status' #>> '{}'), (l.data -> 'paymentMethod' #>> '{}'), (l.data -> 'expenseDate' #>> '{}'), (l.data -> 'receiptFile' #>> '{}'), (l.data -> 'approvedBy' #>> '{}'), (l.data -> 'approvedAt' #>> '{}'), l.created_at, l.updated_at from public.legacy_expenses l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_activities') is not null then
    insert into public."activities" ("id", "title", "subtitle", "amount", "time", "created_at", "type", "audience", db_created_at, db_updated_at)
    select l.key, (l.data -> 'title' #>> '{}'), (l.data -> 'subtitle' #>> '{}'), case when jsonb_typeof(l.data -> 'amount') = 'number' then (l.data -> 'amount' #>> '{}')::numeric end, (l.data -> 'time' #>> '{}'), (l.data -> 'createdAt' #>> '{}'), (l.data -> 'type' #>> '{}'), (l.data -> 'audience' #>> '{}'), l.created_at, l.updated_at from public.legacy_activities l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_branches') is not null then
    insert into public."branches" ("name", "location", "manager", "manager_initials", "hw_ok", "hw_error", "address", "city", "branch_code", "phone", "postal_code", "receipt_note", "image_url", "allow_negative_stock", "show_stock_in_digital", "use_daily_cash", "opening_hours", db_created_at, db_updated_at)
    select l.key, (l.data -> 'location' #>> '{}'), (l.data -> 'manager' #>> '{}'), (l.data -> 'managerInitials' #>> '{}'), case when jsonb_typeof(l.data -> 'hwOk') = 'number' then (l.data -> 'hwOk' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'hwError') = 'number' then (l.data -> 'hwError' #>> '{}')::numeric end, (l.data -> 'address' #>> '{}'), (l.data -> 'city' #>> '{}'), (l.data -> 'branchCode' #>> '{}'), (l.data -> 'phone' #>> '{}'), (l.data -> 'postalCode' #>> '{}'), (l.data -> 'receiptNote' #>> '{}'), (l.data -> 'imageUrl' #>> '{}'), case when jsonb_typeof(l.data -> 'allowNegativeStock') = 'boolean' then (l.data -> 'allowNegativeStock' #>> '{}')::boolean end, case when jsonb_typeof(l.data -> 'showStockInDigital') = 'boolean' then (l.data -> 'showStockInDigital' #>> '{}')::boolean end, case when jsonb_typeof(l.data -> 'useDailyCash') = 'boolean' then (l.data -> 'useDailyCash' #>> '{}')::boolean end, l.data -> 'openingHours', l.created_at, l.updated_at from public.legacy_branches l
    on conflict ("name") do nothing;
  end if;

  if to_regclass('public.legacy_sales_invoices') is not null then
    insert into public."sales_invoices" ("invoice_number", "customer_name", "customer_id", "date", "created_at", "total", "payment_method", "subtotal", "discount_amount", "discount_type", "discount_value", "additional_fee_name", "additional_fee", "fulfillment_method", "delivery_address", "driver_name", "deletion_status", "deletion_requested_at", "cash_received", "change_amount", "split_paid_amount", "split_remaining_debt", "split_due_date", "pay_on_delivery", "payment_account_name", "payment_account_number", "payment_account_holder", db_created_at, db_updated_at)
    select l.key, (l.data -> 'customerName' #>> '{}'), (l.data -> 'customerId' #>> '{}'), (l.data -> 'date' #>> '{}'), (l.data -> 'createdAt' #>> '{}'), case when jsonb_typeof(l.data -> 'total') = 'number' then (l.data -> 'total' #>> '{}')::numeric end, (l.data -> 'paymentMethod' #>> '{}'), case when jsonb_typeof(l.data -> 'subtotal') = 'number' then (l.data -> 'subtotal' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'discountAmount') = 'number' then (l.data -> 'discountAmount' #>> '{}')::numeric end, (l.data -> 'discountType' #>> '{}'), case when jsonb_typeof(l.data -> 'discountValue') = 'number' then (l.data -> 'discountValue' #>> '{}')::numeric end, (l.data -> 'additionalFeeName' #>> '{}'), case when jsonb_typeof(l.data -> 'additionalFee') = 'number' then (l.data -> 'additionalFee' #>> '{}')::numeric end, (l.data -> 'fulfillmentMethod' #>> '{}'), (l.data -> 'deliveryAddress' #>> '{}'), (l.data -> 'driverName' #>> '{}'), (l.data -> 'deletionStatus' #>> '{}'), (l.data -> 'deletionRequestedAt' #>> '{}'), case when jsonb_typeof(l.data -> 'cashReceived') = 'number' then (l.data -> 'cashReceived' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'changeAmount') = 'number' then (l.data -> 'changeAmount' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'splitPaidAmount') = 'number' then (l.data -> 'splitPaidAmount' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'splitRemainingDebt') = 'number' then (l.data -> 'splitRemainingDebt' #>> '{}')::numeric end, (l.data -> 'splitDueDate' #>> '{}'), case when jsonb_typeof(l.data -> 'payOnDelivery') = 'boolean' then (l.data -> 'payOnDelivery' #>> '{}')::boolean end, (l.data -> 'paymentAccountName' #>> '{}'), (l.data -> 'paymentAccountNumber' #>> '{}'), (l.data -> 'paymentAccountHolder' #>> '{}'), l.created_at, l.updated_at from public.legacy_sales_invoices l
    on conflict ("invoice_number") do nothing;
    if not exists (select 1 from public."sales_invoice_items" limit 1) then
      insert into public."sales_invoice_items" (parent_key, position, "sku", "name", "quantity", "price", "original_price", "unit", "bonus", "delivered_quantity")
      select l.key, (e.ord - 1)::int, (e.elem -> 'sku' #>> '{}'), (e.elem -> 'name' #>> '{}'), case when jsonb_typeof(e.elem -> 'quantity') = 'number' then (e.elem -> 'quantity' #>> '{}')::numeric end, case when jsonb_typeof(e.elem -> 'price') = 'number' then (e.elem -> 'price' #>> '{}')::numeric end, case when jsonb_typeof(e.elem -> 'originalPrice') = 'number' then (e.elem -> 'originalPrice' #>> '{}')::numeric end, (e.elem -> 'unit' #>> '{}'), case when jsonb_typeof(e.elem -> 'bonus') = 'boolean' then (e.elem -> 'bonus' #>> '{}')::boolean end, case when jsonb_typeof(e.elem -> 'deliveredQuantity') = 'number' then (e.elem -> 'deliveredQuantity' #>> '{}')::numeric end
      from public.legacy_sales_invoices l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'items') = 'array' then l.data -> 'items' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."sales_invoices" p where p."invoice_number" = l.key);
    end if;
    if not exists (select 1 from public."sales_invoice_fees" limit 1) then
      insert into public."sales_invoice_fees" (parent_key, position, "name", "amount")
      select l.key, (e.ord - 1)::int, (e.elem -> 'name' #>> '{}'), case when jsonb_typeof(e.elem -> 'amount') = 'number' then (e.elem -> 'amount' #>> '{}')::numeric end
      from public.legacy_sales_invoices l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'additionalFees') = 'array' then l.data -> 'additionalFees' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."sales_invoices" p where p."invoice_number" = l.key);
    end if;
  end if;

  if to_regclass('public.legacy_returns') is not null then
    insert into public."returns" ("id", "type", "ref_number", "party_name", "discount", "total_refund", "refund_method", "status", "created_at", "approved_at_iso", db_created_at, db_updated_at)
    select l.key, (l.data -> 'type' #>> '{}'), (l.data -> 'refNumber' #>> '{}'), (l.data -> 'partyName' #>> '{}'), case when jsonb_typeof(l.data -> 'discount') = 'number' then (l.data -> 'discount' #>> '{}')::numeric end, case when jsonb_typeof(l.data -> 'totalRefund') = 'number' then (l.data -> 'totalRefund' #>> '{}')::numeric end, (l.data -> 'refundMethod' #>> '{}'), (l.data -> 'status' #>> '{}'), (l.data -> 'createdAt' #>> '{}'), (l.data -> 'approvedAtISO' #>> '{}'), l.created_at, l.updated_at from public.legacy_returns l
    on conflict ("id") do nothing;
    if not exists (select 1 from public."return_items" limit 1) then
      insert into public."return_items" (parent_key, position, "sku", "name", "quantity", "condition", "price")
      select l.key, (e.ord - 1)::int, (e.elem -> 'sku' #>> '{}'), (e.elem -> 'name' #>> '{}'), case when jsonb_typeof(e.elem -> 'quantity') = 'number' then (e.elem -> 'quantity' #>> '{}')::numeric end, (e.elem -> 'condition' #>> '{}'), case when jsonb_typeof(e.elem -> 'price') = 'number' then (e.elem -> 'price' #>> '{}')::numeric end
      from public.legacy_returns l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'items') = 'array' then l.data -> 'items' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."returns" p where p."id" = l.key);
    end if;
  end if;

  if to_regclass('public.legacy_digital_orders') is not null then
    insert into public."digital_orders" ("id", "buyer_name", "phone", "address", "total", "status", "created_at", db_created_at, db_updated_at)
    select l.key, (l.data -> 'buyerName' #>> '{}'), (l.data -> 'phone' #>> '{}'), (l.data -> 'address' #>> '{}'), case when jsonb_typeof(l.data -> 'total') = 'number' then (l.data -> 'total' #>> '{}')::numeric end, (l.data -> 'status' #>> '{}'), (l.data -> 'createdAt' #>> '{}'), l.created_at, l.updated_at from public.legacy_digital_orders l
    on conflict ("id") do nothing;
    if not exists (select 1 from public."digital_order_items" limit 1) then
      insert into public."digital_order_items" (parent_key, position, "sku", "name", "quantity", "price")
      select l.key, (e.ord - 1)::int, (e.elem -> 'sku' #>> '{}'), (e.elem -> 'name' #>> '{}'), case when jsonb_typeof(e.elem -> 'quantity') = 'number' then (e.elem -> 'quantity' #>> '{}')::numeric end, case when jsonb_typeof(e.elem -> 'price') = 'number' then (e.elem -> 'price' #>> '{}')::numeric end
      from public.legacy_digital_orders l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'items') = 'array' then l.data -> 'items' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."digital_orders" p where p."id" = l.key);
    end if;
  end if;

  if to_regclass('public.legacy_banners') is not null then
    insert into public."banners" ("id", "image_url", "title", "active", db_created_at, db_updated_at)
    select l.key, (l.data -> 'imageUrl' #>> '{}'), (l.data -> 'title' #>> '{}'), case when jsonb_typeof(l.data -> 'active') = 'boolean' then (l.data -> 'active' #>> '{}')::boolean end, l.created_at, l.updated_at from public.legacy_banners l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_sku_locations') is not null then
    insert into public."sku_locations" ("id", "name", "city", "address", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), (l.data -> 'city' #>> '{}'), (l.data -> 'address' #>> '{}'), l.created_at, l.updated_at from public.legacy_sku_locations l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_staff_list') is not null then
    insert into public."staff_list" ("id", "name", "phone", "role", "permissions", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), (l.data -> 'phone' #>> '{}'), (l.data -> 'role' #>> '{}'), case when jsonb_typeof(l.data -> 'permissions') = 'array' then array(select jsonb_array_elements_text(l.data -> 'permissions')) end, l.created_at, l.updated_at from public.legacy_staff_list l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_bank_accounts') is not null then
    insert into public."bank_accounts" ("id", "name", "type", "account_number", "holder_name", "notes", "qris_image_url", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), (l.data -> 'type' #>> '{}'), (l.data -> 'accountNumber' #>> '{}'), (l.data -> 'holderName' #>> '{}'), (l.data -> 'notes' #>> '{}'), (l.data -> 'qrisImageUrl' #>> '{}'), l.created_at, l.updated_at from public.legacy_bank_accounts l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_printers') is not null then
    insert into public."printers" ("id", "name", "connection_type", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), (l.data -> 'connectionType' #>> '{}'), l.created_at, l.updated_at from public.legacy_printers l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_opname_submissions') is not null then
    insert into public."opname_submissions" ("id", "product_sku", "product_name", "type", "amount", "notes", "submitted_by", "date", "status", db_created_at, db_updated_at)
    select l.key, (l.data -> 'productSku' #>> '{}'), (l.data -> 'productName' #>> '{}'), (l.data -> 'type' #>> '{}'), case when jsonb_typeof(l.data -> 'amount') = 'number' then (l.data -> 'amount' #>> '{}')::numeric end, (l.data -> 'notes' #>> '{}'), (l.data -> 'submittedBy' #>> '{}'), (l.data -> 'date' #>> '{}'), (l.data -> 'status' #>> '{}'), l.created_at, l.updated_at from public.legacy_opname_submissions l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_product_categories') is not null then
    insert into public."product_categories" ("id", "name", "level", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), case when jsonb_typeof(l.data -> 'level') = 'number' then (l.data -> 'level' #>> '{}')::numeric end, l.created_at, l.updated_at from public.legacy_product_categories l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_product_brands') is not null then
    insert into public."product_brands" ("id", "name", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), l.created_at, l.updated_at from public.legacy_product_brands l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_product_units') is not null then
    insert into public."product_units" ("id", "name", "level", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), case when jsonb_typeof(l.data -> 'level') = 'number' then (l.data -> 'level' #>> '{}')::numeric end, l.created_at, l.updated_at from public.legacy_product_units l
    on conflict ("id") do nothing;
  end if;

  if to_regclass('public.legacy_product_bundles') is not null then
    insert into public."product_bundles" ("id", "name", "bundle_price", db_created_at, db_updated_at)
    select l.key, (l.data -> 'name' #>> '{}'), case when jsonb_typeof(l.data -> 'bundlePrice') = 'number' then (l.data -> 'bundlePrice' #>> '{}')::numeric end, l.created_at, l.updated_at from public.legacy_product_bundles l
    on conflict ("id") do nothing;
    if not exists (select 1 from public."product_bundle_items" limit 1) then
      insert into public."product_bundle_items" (parent_key, position, "sku", "name", "quantity")
      select l.key, (e.ord - 1)::int, (e.elem -> 'sku' #>> '{}'), (e.elem -> 'name' #>> '{}'), case when jsonb_typeof(e.elem -> 'quantity') = 'number' then (e.elem -> 'quantity' #>> '{}')::numeric end
      from public.legacy_product_bundles l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> 'items') = 'array' then l.data -> 'items' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public."product_bundles" p where p."id" = l.key);
    end if;
  end if;

  if to_regclass('public.legacy_push_tokens') is not null then
    insert into public."push_tokens" ("token", "platform", "device_label", "role", "updated_at", db_created_at, db_updated_at)
    select l.key, (l.data -> 'platform' #>> '{}'), (l.data -> 'deviceLabel' #>> '{}'), (l.data -> 'role' #>> '{}'), (l.data -> 'updatedAt' #>> '{}'), l.created_at, l.updated_at from public.legacy_push_tokens l
    on conflict ("token") do nothing;
  end if;

  -- store_owner -> store_profile
  if to_regclass('public.legacy_store_owner') is not null then
    insert into public.store_profile (id, store_name, owner_name, email, address, phone, receipt_note, tax_id)
    select 'main', value->>'storeName', value->>'ownerName', value->>'email',
           value->>'address', value->>'phone', value->>'receiptNote', value->>'taxId'
    from public.legacy_store_owner where jsonb_typeof(value) = 'object'
    on conflict (id) do nothing;
  end if;

  -- ecommerce_username / default_customer_id / total_sales / total_orders_count -> store_settings
  insert into public.store_settings (id) values ('main') on conflict (id) do nothing;
  if to_regclass('public.legacy_ecommerce_username') is not null then
    update public.store_settings set ecommerce_username = (select value #>> '{}' from public.legacy_ecommerce_username limit 1)
    where ecommerce_username is null;
  end if;
  if to_regclass('public.legacy_default_customer_id') is not null then
    update public.store_settings set default_customer_id = (select nullif(value #>> '{}', 'null') from public.legacy_default_customer_id limit 1)
    where default_customer_id is null;
  end if;
  if to_regclass('public.legacy_total_sales') is not null then
    update public.store_settings set total_sales = (select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric end from public.legacy_total_sales limit 1)
    where total_sales is null;
  end if;
  if to_regclass('public.legacy_total_orders_count') is not null then
    update public.store_settings set total_orders_count = (select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric end from public.legacy_total_orders_count limit 1)
    where total_orders_count is null;
  end if;

  -- cash_session_current + cash_session_history -> cash_sessions (+ cash_mutations)
  if to_regclass('public.legacy_cash_session_current') is not null or to_regclass('public.legacy_cash_session_history') is not null then
    create temp table _legacy_sessions on commit drop as
    select s.elem as s, (s.ord + 1000) as ord from (
      select e.elem, e.ord from public.legacy_cash_session_history h,
        jsonb_array_elements(case when jsonb_typeof(h.value) = 'array' then h.value else '[]'::jsonb end) with ordinality e(elem, ord)
    ) s
    union all
    select c.value, 0 from public.legacy_cash_session_current c where jsonb_typeof(c.value) = 'object';
    insert into public.cash_sessions (id, "date", "opened_at", "closed_at", "opened_at_iso", "closed_at_iso", "cashier_name", "status", "opening_balance", "total_invoices_cash", "total_stocks_sold_cash", "total_invoices_non_cash", "closing_actual", db_created_at)
    select s->>'id', (s -> 'date' #>> '{}'), (s -> 'openedAt' #>> '{}'), (s -> 'closedAt' #>> '{}'), (s -> 'openedAtISO' #>> '{}'), (s -> 'closedAtISO' #>> '{}'), (s -> 'cashierName' #>> '{}'), (s -> 'status' #>> '{}'), case when jsonb_typeof(s -> 'openingBalance') = 'number' then (s -> 'openingBalance' #>> '{}')::numeric end, case when jsonb_typeof(s -> 'totalInvoicesCash') = 'number' then (s -> 'totalInvoicesCash' #>> '{}')::numeric end, case when jsonb_typeof(s -> 'totalStocksSoldCash') = 'number' then (s -> 'totalStocksSoldCash' #>> '{}')::numeric end, case when jsonb_typeof(s -> 'totalInvoicesNonCash') = 'number' then (s -> 'totalInvoicesNonCash' #>> '{}')::numeric end, case when jsonb_typeof(s -> 'closingActual') = 'number' then (s -> 'closingActual' #>> '{}')::numeric end, now() - (ord || ' seconds')::interval from _legacy_sessions
    on conflict (id) do nothing;
    insert into public.cash_mutations (parent_key, position, "id", "type", "category", "amount", "note", "time")
    select s->>'id', (e.ord - 1)::int, (e.elem -> 'id' #>> '{}'), (e.elem -> 'type' #>> '{}'), (e.elem -> 'category' #>> '{}'), case when jsonb_typeof(e.elem -> 'amount') = 'number' then (e.elem -> 'amount' #>> '{}')::numeric end, (e.elem -> 'note' #>> '{}'), (e.elem -> 'time' #>> '{}')
    from _legacy_sessions,
         jsonb_array_elements(case when jsonb_typeof(s -> 'mutations') = 'array' then s -> 'mutations' else '[]'::jsonb end) with ordinality e(elem, ord)
    where not exists (select 1 from public.cash_mutations m where m.parent_key = s->>'id');
  end if;
end $$;
