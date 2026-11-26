'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

// The printable invoice must use the same pricing rules and totals as the order ledger.
test('invoice matches order pricing for HSN slab and discount before GST', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  const order = { items: items, coupon: 'SAVE10' };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    lines: [{
      id: 1, name: 'Rice', hsn: '1006', gstPercent: 5,
      gross: 1000, discount: 100, taxable: 900, tax: 45, net: 945
    }]
  });
  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.discount, 100);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 45);
  assert.equal(figures.tax, 45);
  assert.equal(figures.total, 945);
});

test('invoice uses HSN slab when stored line has no gstRate', function () {
  const order = {
    id: 1,
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }],
    coupon: '',
    total: 1050
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 50);
  assert.equal(figures.cgst, 25);
  assert.equal(figures.sgst, 25);
  assert.equal(figures.total, order.total);
});

test('invoice applies capped coupon to subtotal and matches order ledger', function () {
  const order = {
    id: 2,
    items: [{ id: 2, name: 'Rice', hsn: '1006', price: 10000, qty: 1 }],
    coupon: 'WELCOME',
    total: 10395
  };

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 100); // Pricing honors WELCOME's maxDiscount.
  assert.equal(billed.tax, 495); // HSN 1006 is taxed at 5% after discount.
  assert.equal(billed.total, 10395);
  assert.equal(invoiced.discount, 100);
  assert.equal(invoiced.tax, 495);
  assert.equal(invoiced.total, order.total);
});

test('invoice interprets decimal gstRate the same way as order pricing', function () {
  const item = { id: 3, name: 'Custom rate item', price: 100, qty: 1, gstRate: 0.05 };

  assert.equal(pricing.computeTotals([item], '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures({ items: [item], coupon: '' }).tax, 5);
});

test('printable invoice includes line rows using the ledger tax rate', function () {
  const html = invoice.render({
    id: 4,
    date: '01/01/2026',
    customer: 'Walk-in',
    items: [{ id: 4, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    total: 118
  });

  assert.match(html, /<td><strong>Rice<\/strong>/);
  assert.match(html, /5%/);
});
