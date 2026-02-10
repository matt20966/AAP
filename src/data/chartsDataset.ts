// src/data/chartDatasets.ts

import { Dataset } from '../types/charts';

export const CHART_DATASETS: Dataset[] = [
  // ─── 1. ORDERS ──────────────────────────────────────────────────────
  {
    id: 'orders',
    name: 'Orders',
    description: 'Monthly order data by region and product category',
    fields: [
      { id: 'month', name: 'Month', type: 'date' },
      { id: 'region', name: 'Region', type: 'string' },
      { id: 'category', name: 'Category', type: 'string' },
      { id: 'orders', name: 'Orders', type: 'number' },
      { id: 'revenue', name: 'Revenue', type: 'number' },
      { id: 'avgOrderValue', name: 'Avg Order Value', type: 'number' },
    ],
    defaultMappings: { x: 'month', y: 'revenue', series: 'region' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const regions = ['North', 'South', 'East', 'West'];
      const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books'];
      const avgValues: Record<string, number> = { Electronics: 200, Clothing: 60, 'Home & Garden': 95, Sports: 75, Books: 25 };
      const baseOrders: Record<string, Record<string, number>> = {
        Electronics: { North: 142, South: 98, East: 120, West: 110 },
        Clothing: { North: 180, South: 160, East: 210, West: 175 },
        'Home & Garden': { North: 95, South: 110, East: 88, West: 102 },
        Sports: { North: 70, South: 85, East: 65, West: 90 },
        Books: { North: 220, South: 195, East: 240, West: 210 },
      };
      for (let m = 1; m <= 12; m++) {
        const month = `2024-${m.toString().padStart(2, '0')}`;
        const seasonMult = 1 + 0.15 * Math.sin(((m - 3) / 12) * 2 * Math.PI);
        regions.forEach(region => {
          categories.forEach(category => {
            const base = baseOrders[category][region];
            const orders = Math.floor(base * seasonMult + (m - 1) * 3 + Math.random() * 30 - 15);
            const aov = avgValues[category] + Math.floor(Math.random() * 20 - 10);
            rows.push({ month, region, category, orders, revenue: orders * aov, avgOrderValue: aov });
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 2. REVENUE ─────────────────────────────────────────────────────
  {
    id: 'revenue',
    name: 'Revenue',
    description: 'Daily revenue breakdown with costs and margins',
    fields: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'channel', name: 'Channel', type: 'string' },
      { id: 'revenue', name: 'Revenue', type: 'number' },
      { id: 'cost', name: 'Cost', type: 'number' },
      { id: 'profit', name: 'Profit', type: 'number' },
      { id: 'transactions', name: 'Transactions', type: 'number' },
    ],
    defaultMappings: { x: 'date', y: 'revenue', series: 'channel' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const channels = ['Online', 'In-Store', 'Wholesale', 'Marketplace', 'Mobile App'];
      const seed = (i: number) => Math.abs(Math.sin(i * 9301 + 4927) * 16807 % 1);
      let idx = 0;
      for (let m = 1; m <= 3; m++) {
        const daysInMonth = [31, 29, 31][m - 1];
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `2024-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
          const dayOfWeek = new Date(2024, m - 1, d).getDay();
          const weekendMult = dayOfWeek === 0 || dayOfWeek === 6 ? 1.3 : 1.0;
          channels.forEach(ch => {
            idx++;
            const base = ch === 'Online' ? 4500 : ch === 'In-Store' ? 3200 : ch === 'Wholesale' ? 2800 : ch === 'Marketplace' ? 3800 : 2200;
            const rev = Math.floor((base + seed(idx) * 2000 - 500) * weekendMult);
            const costRatio = 0.55 + seed(idx + 1000) * 0.1;
            const cost = Math.floor(rev * costRatio);
            rows.push({
              date: dateStr,
              channel: ch,
              revenue: rev,
              cost,
              profit: rev - cost,
              transactions: Math.floor(rev / (40 + seed(idx + 2000) * 30)),
            });
          });
        }
      }
      return rows;
    })(),
  },

  // ─── 3. WAREHOUSE PICKS ─────────────────────────────────────────────
  {
    id: 'warehouse',
    name: 'Warehouse Picks',
    description: 'Warehouse picking efficiency by zone and shift',
    fields: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'zone', name: 'Zone', type: 'string' },
      { id: 'shift', name: 'Shift', type: 'string' },
      { id: 'picks', name: 'Picks', type: 'number' },
      { id: 'errors', name: 'Errors', type: 'number' },
      { id: 'efficiency', name: 'Efficiency %', type: 'number' },
    ],
    defaultMappings: { x: 'date', y: 'picks', series: 'zone' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const zones = ['A', 'B', 'C', 'D', 'E', 'F'];
      const shifts = ['Morning', 'Afternoon', 'Night'];
      const seed = (i: number) => Math.abs(Math.sin(i * 7919 + 1031) * 16807 % 1);
      let idx = 0;
      for (let d = 1; d <= 30; d++) {
        const dateStr = `2024-06-${d.toString().padStart(2, '0')}`;
        zones.forEach(z => {
          shifts.forEach(s => {
            idx++;
            const base = z === 'A' ? 320 : z === 'B' ? 280 : z === 'C' ? 250 : z === 'D' ? 200 : z === 'E' ? 310 : 270;
            const shiftMult = s === 'Morning' ? 1.1 : s === 'Afternoon' ? 1.0 : 0.8;
            const picks = Math.floor(base * shiftMult + seed(idx) * 60 - 30);
            const errors = Math.floor(seed(idx + 500) * 8);
            rows.push({
              date: dateStr,
              zone: `Zone ${z}`,
              shift: s,
              picks,
              errors,
              efficiency: Math.round(((picks - errors) / picks) * 100 * 10) / 10,
            });
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 4. SALES PEOPLE ────────────────────────────────────────────────
  {
    id: 'salespeople',
    name: 'Sales People',
    description: 'Individual sales performance with quotas and pipeline',
    fields: [
      { id: 'name', name: 'Name', type: 'string' },
      { id: 'team', name: 'Team', type: 'string' },
      { id: 'region', name: 'Region', type: 'string' },
      { id: 'deals', name: 'Deals Closed', type: 'number' },
      { id: 'revenue', name: 'Revenue', type: 'number' },
      { id: 'quota', name: 'Quota', type: 'number' },
      { id: 'pipeline', name: 'Pipeline', type: 'number' },
      { id: 'winRate', name: 'Win Rate %', type: 'number' },
      { id: 'avgDealSize', name: 'Avg Deal Size', type: 'number' },
      { id: 'daysToClose', name: 'Avg Days to Close', type: 'number' },
    ],
    defaultMappings: { x: 'name', y: 'revenue' },
    rows: [
      { name: 'Sarah Chen', team: 'Enterprise', region: 'West', deals: 12, revenue: 245000, quota: 200000, pipeline: 380000, winRate: 68, avgDealSize: 20417, daysToClose: 45 },
      { name: 'Marcus Johnson', team: 'Enterprise', region: 'East', deals: 9, revenue: 198000, quota: 200000, pipeline: 310000, winRate: 55, avgDealSize: 22000, daysToClose: 52 },
      { name: 'Emily Park', team: 'Mid-Market', region: 'West', deals: 18, revenue: 156000, quota: 150000, pipeline: 220000, winRate: 72, avgDealSize: 8667, daysToClose: 28 },
      { name: 'David Kim', team: 'Mid-Market', region: 'North', deals: 15, revenue: 132000, quota: 150000, pipeline: 195000, winRate: 62, avgDealSize: 8800, daysToClose: 32 },
      { name: 'Lisa Zhang', team: 'SMB', region: 'South', deals: 28, revenue: 89000, quota: 100000, pipeline: 145000, winRate: 78, avgDealSize: 3179, daysToClose: 14 },
      { name: 'Alex Rivera', team: 'SMB', region: 'West', deals: 22, revenue: 76000, quota: 100000, pipeline: 120000, winRate: 65, avgDealSize: 3455, daysToClose: 18 },
      { name: 'Rachel Moore', team: 'Enterprise', region: 'North', deals: 14, revenue: 280000, quota: 250000, pipeline: 420000, winRate: 71, avgDealSize: 20000, daysToClose: 40 },
      { name: 'Tom Wilson', team: 'Mid-Market', region: 'East', deals: 20, revenue: 168000, quota: 150000, pipeline: 250000, winRate: 69, avgDealSize: 8400, daysToClose: 25 },
      { name: 'Jessica Hall', team: 'Enterprise', region: 'South', deals: 11, revenue: 220000, quota: 200000, pipeline: 350000, winRate: 64, avgDealSize: 20000, daysToClose: 48 },
      { name: 'Brian Foster', team: 'SMB', region: 'North', deals: 35, revenue: 105000, quota: 100000, pipeline: 160000, winRate: 82, avgDealSize: 3000, daysToClose: 12 },
      { name: 'Amanda Lee', team: 'Mid-Market', region: 'South', deals: 17, revenue: 144000, quota: 150000, pipeline: 210000, winRate: 66, avgDealSize: 8471, daysToClose: 30 },
      { name: 'Kevin Brown', team: 'Enterprise', region: 'West', deals: 10, revenue: 310000, quota: 250000, pipeline: 480000, winRate: 59, avgDealSize: 31000, daysToClose: 55 },
      { name: 'Nicole Davis', team: 'SMB', region: 'East', deals: 30, revenue: 96000, quota: 100000, pipeline: 140000, winRate: 75, avgDealSize: 3200, daysToClose: 16 },
      { name: 'Chris Taylor', team: 'Mid-Market', region: 'North', deals: 22, revenue: 176000, quota: 150000, pipeline: 265000, winRate: 73, avgDealSize: 8000, daysToClose: 22 },
      { name: 'Megan White', team: 'Enterprise', region: 'East', deals: 8, revenue: 192000, quota: 200000, pipeline: 290000, winRate: 50, avgDealSize: 24000, daysToClose: 60 },
      { name: 'Ryan Clark', team: 'SMB', region: 'West', deals: 26, revenue: 83000, quota: 100000, pipeline: 130000, winRate: 70, avgDealSize: 3192, daysToClose: 15 },
    ],
  },

  // ─── 5. FULFILLMENT FLOW ────────────────────────────────────────────
  {
    id: 'fulfillment-flow',
    name: 'Fulfillment Flow',
    description: 'Order fulfillment pipeline stages for Sankey diagrams',
    fields: [
      { id: 'source', name: 'Source', type: 'string' },
      { id: 'target', name: 'Target', type: 'string' },
      { id: 'value', name: 'Value', type: 'number' },
    ],
    defaultMappings: { x: 'source', y: 'target', value: 'value' },
    rows: [
      { source: 'Web Orders', target: 'Received', value: 520 },
      { source: 'Mobile Orders', target: 'Received', value: 310 },
      { source: 'Phone Orders', target: 'Received', value: 140 },
      { source: 'Received', target: 'Pick', value: 850 },
      { source: 'Received', target: 'Backorder', value: 120 },
      { source: 'Pick', target: 'Pack', value: 800 },
      { source: 'Pick', target: 'Quality Hold', value: 50 },
      { source: 'Pack', target: 'Ship Ground', value: 420 },
      { source: 'Pack', target: 'Ship Express', value: 250 },
      { source: 'Pack', target: 'Ship Overnight', value: 80 },
      { source: 'Pack', target: 'Returns', value: 50 },
      { source: 'Quality Hold', target: 'Pack', value: 35 },
      { source: 'Quality Hold', target: 'Returns', value: 15 },
      { source: 'Backorder', target: 'Pick', value: 90 },
      { source: 'Backorder', target: 'Cancelled', value: 30 },
      { source: 'Ship Ground', target: 'Delivered', value: 400 },
      { source: 'Ship Ground', target: 'In Transit', value: 20 },
      { source: 'Ship Express', target: 'Delivered', value: 245 },
      { source: 'Ship Express', target: 'In Transit', value: 5 },
      { source: 'Ship Overnight', target: 'Delivered', value: 78 },
      { source: 'Ship Overnight', target: 'In Transit', value: 2 },
    ],
  },

  // ─── 6. WEBSITE TRAFFIC ─────────────────────────────────────────────
  {
    id: 'website-traffic',
    name: 'Website Traffic',
    description: 'Daily website analytics with sessions, bounce rate, and conversions',
    fields: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'source', name: 'Traffic Source', type: 'string' },
      { id: 'sessions', name: 'Sessions', type: 'number' },
      { id: 'pageViews', name: 'Page Views', type: 'number' },
      { id: 'bounceRate', name: 'Bounce Rate %', type: 'number' },
      { id: 'avgDuration', name: 'Avg Duration (s)', type: 'number' },
      { id: 'conversions', name: 'Conversions', type: 'number' },
      { id: 'conversionRate', name: 'Conversion Rate %', type: 'number' },
    ],
    defaultMappings: { x: 'date', y: 'sessions', series: 'source' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const sources = ['Organic Search', 'Paid Search', 'Social Media', 'Direct', 'Email', 'Referral'];
      const baseSessions: Record<string, number> = { 'Organic Search': 3200, 'Paid Search': 1800, 'Social Media': 2400, Direct: 1500, Email: 900, Referral: 600 };
      const baseConvRate: Record<string, number> = { 'Organic Search': 3.2, 'Paid Search': 4.5, 'Social Media': 1.8, Direct: 5.1, Email: 6.2, Referral: 2.9 };
      const seed = (i: number) => Math.abs(Math.sin(i * 5381 + 2719) * 16807 % 1);
      let idx = 0;
      for (let d = 1; d <= 90; d++) {
        const dayNum = d - 1;
        const m = Math.floor(dayNum / 31);
        const dayInMonth = (dayNum % 31) + 1;
        const month = (m + 1).toString().padStart(2, '0');
        const dateStr = `2024-${month}-${Math.min(dayInMonth, [31, 29, 31][m]).toString().padStart(2, '0')}`;
        const dayOfWeek = new Date(2024, m, Math.min(dayInMonth, [31, 29, 31][m])).getDay();
        const weekendMult = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0;
        const trendMult = 1 + d * 0.002;
        sources.forEach(src => {
          idx++;
          const sessions = Math.floor(baseSessions[src] * weekendMult * trendMult + seed(idx) * 600 - 300);
          const pagesPerSession = 2.5 + seed(idx + 100) * 2;
          const bounceRate = Math.round((35 + seed(idx + 200) * 30) * 10) / 10;
          const avgDuration = Math.floor(120 + seed(idx + 300) * 180);
          const convRate = baseConvRate[src] + (seed(idx + 400) * 2 - 1);
          const conversions = Math.floor(sessions * convRate / 100);
          rows.push({
            date: dateStr,
            source: src,
            sessions,
            pageViews: Math.floor(sessions * pagesPerSession),
            bounceRate,
            avgDuration,
            conversions,
            conversionRate: Math.round(convRate * 100) / 100,
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 7. CUSTOMER DEMOGRAPHICS ───────────────────────────────────────
  {
    id: 'customer-demographics',
    name: 'Customer Demographics',
    description: 'Customer segmentation by age, income, and spending patterns',
    fields: [
      { id: 'ageGroup', name: 'Age Group', type: 'string' },
      { id: 'gender', name: 'Gender', type: 'string' },
      { id: 'incomeLevel', name: 'Income Level', type: 'string' },
      { id: 'customerCount', name: 'Customer Count', type: 'number' },
      { id: 'avgSpend', name: 'Avg Annual Spend', type: 'number' },
      { id: 'avgOrders', name: 'Avg Orders/Year', type: 'number' },
      { id: 'retention', name: 'Retention Rate %', type: 'number' },
      { id: 'nps', name: 'NPS Score', type: 'number' },
    ],
    defaultMappings: { x: 'ageGroup', y: 'customerCount', series: 'gender' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const ageGroups = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
      const genders = ['Male', 'Female', 'Non-Binary'];
      const incomeLevels = ['Low', 'Medium', 'High'];
      const baseCount: Record<string, number> = { '18-24': 1200, '25-34': 2800, '35-44': 3200, '45-54': 2600, '55-64': 1800, '65+': 900 };
      const genderSplit: Record<string, number> = { Male: 0.46, Female: 0.48, 'Non-Binary': 0.06 };
      const incomeSplit: Record<string, number> = { Low: 0.3, Medium: 0.45, High: 0.25 };
      const avgSpendByIncome: Record<string, number> = { Low: 450, Medium: 1200, High: 3500 };
      const seed = (i: number) => Math.abs(Math.sin(i * 3571 + 8923) * 16807 % 1);
      let idx = 0;
      ageGroups.forEach(age => {
        genders.forEach(gender => {
          incomeLevels.forEach(income => {
            idx++;
            const count = Math.floor(baseCount[age] * genderSplit[gender] * incomeSplit[income] + seed(idx) * 50);
            const spend = Math.floor(avgSpendByIncome[income] * (0.8 + seed(idx + 100) * 0.4));
            const orders = Math.floor(spend / (60 + seed(idx + 200) * 40));
            const retention = Math.round((55 + seed(idx + 300) * 35) * 10) / 10;
            const nps = Math.floor(20 + seed(idx + 400) * 60);
            rows.push({ ageGroup: age, gender, incomeLevel: income, customerCount: count, avgSpend: spend, avgOrders: orders, retention, nps });
          });
        });
      });
      return rows;
    })(),
  },

  // ─── 8. PRODUCT INVENTORY ──────────────────────────────────────────
  {
    id: 'product-inventory',
    name: 'Product Inventory',
    description: 'Current inventory levels with reorder points and turnover rates',
    fields: [
      { id: 'sku', name: 'SKU', type: 'string' },
      { id: 'productName', name: 'Product Name', type: 'string' },
      { id: 'category', name: 'Category', type: 'string' },
      { id: 'warehouse', name: 'Warehouse', type: 'string' },
      { id: 'onHand', name: 'On Hand', type: 'number' },
      { id: 'reorderPoint', name: 'Reorder Point', type: 'number' },
      { id: 'unitCost', name: 'Unit Cost', type: 'number' },
      { id: 'unitPrice', name: 'Unit Price', type: 'number' },
      { id: 'turnoverRate', name: 'Turnover Rate', type: 'number' },
      { id: 'daysOfSupply', name: 'Days of Supply', type: 'number' },
    ],
    defaultMappings: { x: 'productName', y: 'onHand', series: 'warehouse' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const products = [
        { sku: 'EL-001', name: 'Wireless Mouse', cat: 'Electronics', cost: 12, price: 29.99 },
        { sku: 'EL-002', name: 'USB-C Hub', cat: 'Electronics', cost: 18, price: 44.99 },
        { sku: 'EL-003', name: 'Bluetooth Speaker', cat: 'Electronics', cost: 25, price: 59.99 },
        { sku: 'EL-004', name: 'Webcam HD', cat: 'Electronics', cost: 22, price: 54.99 },
        { sku: 'EL-005', name: 'Mechanical Keyboard', cat: 'Electronics', cost: 35, price: 89.99 },
        { sku: 'CL-001', name: 'Cotton T-Shirt', cat: 'Clothing', cost: 5, price: 19.99 },
        { sku: 'CL-002', name: 'Denim Jeans', cat: 'Clothing', cost: 15, price: 49.99 },
        { sku: 'CL-003', name: 'Winter Jacket', cat: 'Clothing', cost: 40, price: 119.99 },
        { sku: 'CL-004', name: 'Running Shoes', cat: 'Clothing', cost: 28, price: 79.99 },
        { sku: 'HG-001', name: 'Throw Pillow', cat: 'Home & Garden', cost: 8, price: 24.99 },
        { sku: 'HG-002', name: 'Table Lamp', cat: 'Home & Garden', cost: 15, price: 39.99 },
        { sku: 'HG-003', name: 'Plant Pot Set', cat: 'Home & Garden', cost: 10, price: 29.99 },
        { sku: 'SP-001', name: 'Yoga Mat', cat: 'Sports', cost: 12, price: 34.99 },
        { sku: 'SP-002', name: 'Resistance Bands', cat: 'Sports', cost: 6, price: 18.99 },
        { sku: 'SP-003', name: 'Water Bottle', cat: 'Sports', cost: 4, price: 14.99 },
        { sku: 'BK-001', name: 'Bestseller Novel', cat: 'Books', cost: 3, price: 14.99 },
        { sku: 'BK-002', name: 'Cookbook', cat: 'Books', cost: 5, price: 24.99 },
        { sku: 'BK-003', name: 'Tech Manual', cat: 'Books', cost: 8, price: 39.99 },
      ];
      const warehouses = ['Chicago DC', 'Dallas DC', 'Portland DC', 'Atlanta DC'];
      const seed = (i: number) => Math.abs(Math.sin(i * 6271 + 3947) * 16807 % 1);
      let idx = 0;
      products.forEach(p => {
        warehouses.forEach(wh => {
          idx++;
          const baseStock = Math.floor(200 + seed(idx) * 800);
          const reorder = Math.floor(baseStock * 0.25);
          const onHand = Math.floor(baseStock * (0.3 + seed(idx + 100) * 0.9));
          const turnover = Math.round((2 + seed(idx + 200) * 10) * 10) / 10;
          const daysOfSupply = Math.floor(onHand / (baseStock * turnover / 365));
          rows.push({
            sku: p.sku,
            productName: p.name,
            category: p.cat,
            warehouse: wh,
            onHand,
            reorderPoint: reorder,
            unitCost: p.cost,
            unitPrice: p.price,
            turnoverRate: turnover,
            daysOfSupply: Math.max(daysOfSupply, 1),
          });
        });
      });
      return rows;
    })(),
  },

  // ─── 9. EMPLOYEE PERFORMANCE ────────────────────────────────────────
  {
    id: 'employee-performance',
    name: 'Employee Performance',
    description: 'Quarterly employee metrics across departments',
    fields: [
      { id: 'quarter', name: 'Quarter', type: 'string' },
      { id: 'department', name: 'Department', type: 'string' },
      { id: 'headcount', name: 'Headcount', type: 'number' },
      { id: 'avgRating', name: 'Avg Performance Rating', type: 'number' },
      { id: 'trainingHours', name: 'Training Hours', type: 'number' },
      { id: 'turnoverRate', name: 'Turnover Rate %', type: 'number' },
      { id: 'satisfaction', name: 'Satisfaction Score', type: 'number' },
      { id: 'productivity', name: 'Productivity Index', type: 'number' },
    ],
    defaultMappings: { x: 'quarter', y: 'productivity', series: 'department' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const quarters = ['2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1', '2024-Q2'];
      const departments = ['Engineering', 'Sales', 'Marketing', 'Operations', 'Customer Support', 'Finance', 'HR', 'Product'];
      const baseHeadcount: Record<string, number> = { Engineering: 85, Sales: 45, Marketing: 25, Operations: 60, 'Customer Support': 40, Finance: 15, HR: 12, Product: 20 };
      const seed = (i: number) => Math.abs(Math.sin(i * 4217 + 6829) * 16807 % 1);
      let idx = 0;
      quarters.forEach((q, qi) => {
        departments.forEach(dept => {
          idx++;
          const hc = baseHeadcount[dept] + Math.floor(qi * 2 + seed(idx) * 5 - 2);
          rows.push({
            quarter: q,
            department: dept,
            headcount: hc,
            avgRating: Math.round((3.2 + seed(idx + 100) * 1.5) * 10) / 10,
            trainingHours: Math.floor(12 + seed(idx + 200) * 28),
            turnoverRate: Math.round((5 + seed(idx + 300) * 15) * 10) / 10,
            satisfaction: Math.round((6 + seed(idx + 400) * 3.5) * 10) / 10,
            productivity: Math.round((70 + seed(idx + 500) * 25) * 10) / 10,
          });
        });
      });
      return rows;
    })(),
  },

  // ─── 10. MARKETING CAMPAIGNS ────────────────────────────────────────
  {
    id: 'marketing-campaigns',
    name: 'Marketing Campaigns',
    description: 'Campaign performance metrics across channels',
    fields: [
      { id: 'campaign', name: 'Campaign', type: 'string' },
      { id: 'channel', name: 'Channel', type: 'string' },
      { id: 'startDate', name: 'Start Date', type: 'date' },
      { id: 'spend', name: 'Spend', type: 'number' },
      { id: 'impressions', name: 'Impressions', type: 'number' },
      { id: 'clicks', name: 'Clicks', type: 'number' },
      { id: 'conversions', name: 'Conversions', type: 'number' },
      { id: 'cpa', name: 'Cost Per Acquisition', type: 'number' },
      { id: 'roas', name: 'ROAS', type: 'number' },
      { id: 'ctr', name: 'CTR %', type: 'number' },
    ],
    defaultMappings: { x: 'campaign', y: 'roas', series: 'channel' },
    rows: [
      { campaign: 'Spring Sale', channel: 'Google Ads', startDate: '2024-03-01', spend: 15000, impressions: 850000, clicks: 25500, conversions: 510, cpa: 29.41, roas: 4.2, ctr: 3.0 },
      { campaign: 'Spring Sale', channel: 'Facebook', startDate: '2024-03-01', spend: 12000, impressions: 1200000, clicks: 18000, conversions: 324, cpa: 37.04, roas: 3.5, ctr: 1.5 },
      { campaign: 'Spring Sale', channel: 'Instagram', startDate: '2024-03-01', spend: 8000, impressions: 900000, clicks: 13500, conversions: 216, cpa: 37.04, roas: 3.1, ctr: 1.5 },
      { campaign: 'Spring Sale', channel: 'Email', startDate: '2024-03-01', spend: 2000, impressions: 150000, clicks: 12000, conversions: 840, cpa: 2.38, roas: 12.5, ctr: 8.0 },
      { campaign: 'Summer Launch', channel: 'Google Ads', startDate: '2024-06-01', spend: 22000, impressions: 1100000, clicks: 38500, conversions: 770, cpa: 28.57, roas: 5.1, ctr: 3.5 },
      { campaign: 'Summer Launch', channel: 'Facebook', startDate: '2024-06-01', spend: 18000, impressions: 1800000, clicks: 27000, conversions: 486, cpa: 37.04, roas: 3.8, ctr: 1.5 },
      { campaign: 'Summer Launch', channel: 'Instagram', startDate: '2024-06-01', spend: 14000, impressions: 1500000, clicks: 22500, conversions: 405, cpa: 34.57, roas: 3.6, ctr: 1.5 },
      { campaign: 'Summer Launch', channel: 'TikTok', startDate: '2024-06-01', spend: 10000, impressions: 2200000, clicks: 44000, conversions: 352, cpa: 28.41, roas: 4.0, ctr: 2.0 },
      { campaign: 'Summer Launch', channel: 'Email', startDate: '2024-06-01', spend: 3000, impressions: 200000, clicks: 18000, conversions: 1260, cpa: 2.38, roas: 14.2, ctr: 9.0 },
      { campaign: 'Back to School', channel: 'Google Ads', startDate: '2024-08-01', spend: 18000, impressions: 950000, clicks: 30400, conversions: 608, cpa: 29.61, roas: 4.5, ctr: 3.2 },
      { campaign: 'Back to School', channel: 'Facebook', startDate: '2024-08-01', spend: 14000, impressions: 1400000, clicks: 21000, conversions: 378, cpa: 37.04, roas: 3.3, ctr: 1.5 },
      { campaign: 'Back to School', channel: 'TikTok', startDate: '2024-08-01', spend: 12000, impressions: 2800000, clicks: 56000, conversions: 448, cpa: 26.79, roas: 4.3, ctr: 2.0 },
      { campaign: 'Back to School', channel: 'Email', startDate: '2024-08-01', spend: 2500, impressions: 180000, clicks: 15300, conversions: 1071, cpa: 2.33, roas: 13.8, ctr: 8.5 },
      { campaign: 'Holiday Promo', channel: 'Google Ads', startDate: '2024-11-15', spend: 35000, impressions: 1800000, clicks: 63000, conversions: 1260, cpa: 27.78, roas: 6.2, ctr: 3.5 },
      { campaign: 'Holiday Promo', channel: 'Facebook', startDate: '2024-11-15', spend: 28000, impressions: 3000000, clicks: 45000, conversions: 810, cpa: 34.57, roas: 4.8, ctr: 1.5 },
      { campaign: 'Holiday Promo', channel: 'Instagram', startDate: '2024-11-15', spend: 20000, impressions: 2200000, clicks: 33000, conversions: 594, cpa: 33.67, roas: 4.2, ctr: 1.5 },
      { campaign: 'Holiday Promo', channel: 'TikTok', startDate: '2024-11-15', spend: 16000, impressions: 3800000, clicks: 76000, conversions: 608, cpa: 26.32, roas: 5.1, ctr: 2.0 },
      { campaign: 'Holiday Promo', channel: 'Email', startDate: '2024-11-15', spend: 5000, impressions: 350000, clicks: 31500, conversions: 2205, cpa: 2.27, roas: 18.5, ctr: 9.0 },
      { campaign: 'Holiday Promo', channel: 'Affiliate', startDate: '2024-11-15', spend: 10000, impressions: 500000, clicks: 15000, conversions: 450, cpa: 22.22, roas: 7.2, ctr: 3.0 },
      { campaign: 'Brand Awareness', channel: 'YouTube', startDate: '2024-04-01', spend: 25000, impressions: 5000000, clicks: 50000, conversions: 250, cpa: 100.00, roas: 1.8, ctr: 1.0 },
      { campaign: 'Brand Awareness', channel: 'Display', startDate: '2024-04-01', spend: 15000, impressions: 8000000, clicks: 24000, conversions: 120, cpa: 125.00, roas: 1.2, ctr: 0.3 },
      { campaign: 'Brand Awareness', channel: 'Podcast', startDate: '2024-04-01', spend: 8000, impressions: 200000, clicks: 4000, conversions: 80, cpa: 100.00, roas: 2.1, ctr: 2.0 },
    ],
  },

  // ─── 11. SUPPORT TICKETS ────────────────────────────────────────────
  {
    id: 'support-tickets',
    name: 'Support Tickets',
    description: 'Customer support ticket data with resolution times and satisfaction',
    fields: [
      { id: 'week', name: 'Week', type: 'date' },
      { id: 'category', name: 'Category', type: 'string' },
      { id: 'priority', name: 'Priority', type: 'string' },
      { id: 'ticketsOpened', name: 'Tickets Opened', type: 'number' },
      { id: 'ticketsClosed', name: 'Tickets Closed', type: 'number' },
      { id: 'avgResolutionHrs', name: 'Avg Resolution (hrs)', type: 'number' },
      { id: 'firstResponseMin', name: 'First Response (min)', type: 'number' },
      { id: 'csat', name: 'CSAT Score', type: 'number' },
      { id: 'escalated', name: 'Escalated', type: 'number' },
    ],
    defaultMappings: { x: 'week', y: 'ticketsOpened', series: 'category' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const categories = ['Billing', 'Technical', 'Shipping', 'Returns', 'Account', 'Product Info'];
      const priorities = ['Low', 'Medium', 'High', 'Critical'];
      const seed = (i: number) => Math.abs(Math.sin(i * 8123 + 4567) * 16807 % 1);
      let idx = 0;
      for (let w = 1; w <= 26; w++) {
        const weekDate = `2024-W${w.toString().padStart(2, '0')}`;
        categories.forEach(cat => {
          priorities.forEach(pri => {
            idx++;
            const baseTix = cat === 'Billing' ? 25 : cat === 'Technical' ? 40 : cat === 'Shipping' ? 30 : cat === 'Returns' ? 20 : cat === 'Account' ? 15 : 10;
            const priMult = pri === 'Critical' ? 0.1 : pri === 'High' ? 0.25 : pri === 'Medium' ? 0.4 : 0.25;
            const opened = Math.floor(baseTix * priMult + seed(idx) * 8 - 4);
            const closed = Math.floor(opened * (0.85 + seed(idx + 100) * 0.15));
            const baseResolution = pri === 'Critical' ? 4 : pri === 'High' ? 12 : pri === 'Medium' ? 24 : 48;
            rows.push({
              week: weekDate,
              category: cat,
              priority: pri,
              ticketsOpened: Math.max(opened, 1),
              ticketsClosed: Math.max(closed, 0),
              avgResolutionHrs: Math.round((baseResolution + seed(idx + 200) * baseResolution * 0.5) * 10) / 10,
              firstResponseMin: Math.floor(5 + seed(idx + 300) * (pri === 'Critical' ? 10 : pri === 'High' ? 30 : 60)),
              csat: Math.round((3.5 + seed(idx + 400) * 1.5) * 10) / 10,
              escalated: Math.floor(seed(idx + 500) * (pri === 'Critical' ? 3 : pri === 'High' ? 2 : 1)),
            });
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 12. FINANCIAL STATEMENTS ───────────────────────────────────────
  {
    id: 'financial-statements',
    name: 'Financial Statements',
    description: 'Monthly P&L with detailed line items',
    fields: [
      { id: 'month', name: 'Month', type: 'date' },
      { id: 'lineItem', name: 'Line Item', type: 'string' },
      { id: 'category', name: 'Category', type: 'string' },
      { id: 'amount', name: 'Amount', type: 'number' },
      { id: 'budget', name: 'Budget', type: 'number' },
      { id: 'variance', name: 'Variance', type: 'number' },
      { id: 'variancePct', name: 'Variance %', type: 'number' },
    ],
    defaultMappings: { x: 'month', y: 'amount', series: 'lineItem' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const lineItems = [
        { name: 'Product Revenue', cat: 'Revenue', base: 450000, budget: 420000 },
        { name: 'Service Revenue', cat: 'Revenue', base: 180000, budget: 175000 },
        { name: 'Subscription Revenue', cat: 'Revenue', base: 120000, budget: 110000 },
        { name: 'COGS - Materials', cat: 'COGS', base: -180000, budget: -170000 },
        { name: 'COGS - Labor', cat: 'COGS', base: -95000, budget: -90000 },
        { name: 'COGS - Overhead', cat: 'COGS', base: -45000, budget: -42000 },
        { name: 'Sales & Marketing', cat: 'OpEx', base: -85000, budget: -80000 },
        { name: 'R&D', cat: 'OpEx', base: -110000, budget: -105000 },
        { name: 'G&A', cat: 'OpEx', base: -55000, budget: -50000 },
        { name: 'Depreciation', cat: 'OpEx', base: -22000, budget: -22000 },
        { name: 'Interest Expense', cat: 'Other', base: -8000, budget: -8000 },
        { name: 'Tax Provision', cat: 'Tax', base: -35000, budget: -32000 },
      ];
      const seed = (i: number) => Math.abs(Math.sin(i * 2903 + 7841) * 16807 % 1);
      let idx = 0;
      for (let m = 1; m <= 12; m++) {
        const month = `2024-${m.toString().padStart(2, '0')}`;
        const seasonMult = 1 + 0.1 * Math.sin(((m - 1) / 12) * 2 * Math.PI);
        lineItems.forEach(li => {
          idx++;
          const amount = Math.floor(li.base * seasonMult * (0.95 + seed(idx) * 0.1));
          const budget = Math.floor(li.budget * (1 + (m - 1) * 0.005));
          rows.push({
            month,
            lineItem: li.name,
            category: li.cat,
            amount,
            budget,
            variance: amount - budget,
            variancePct: Math.round(((amount - budget) / Math.abs(budget)) * 100 * 10) / 10,
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 13. SHIPPING & LOGISTICS ───────────────────────────────────────
  {
    id: 'shipping-logistics',
    name: 'Shipping & Logistics',
    description: 'Shipment tracking with carrier performance and delivery metrics',
    fields: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'carrier', name: 'Carrier', type: 'string' },
      { id: 'serviceLevel', name: 'Service Level', type: 'string' },
      { id: 'shipments', name: 'Shipments', type: 'number' },
      { id: 'onTime', name: 'On Time %', type: 'number' },
      { id: 'damaged', name: 'Damaged', type: 'number' },
      { id: 'lost', name: 'Lost', type: 'number' },
      { id: 'avgCost', name: 'Avg Shipping Cost', type: 'number' },
      { id: 'avgTransitDays', name: 'Avg Transit Days', type: 'number' },
    ],
    defaultMappings: { x: 'date', y: 'shipments', series: 'carrier' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const carriers = ['FedEx', 'UPS', 'USPS', 'DHL', 'Regional Express'];
      const serviceLevels = ['Ground', 'Express', 'Overnight'];
      const seed = (i: number) => Math.abs(Math.sin(i * 5501 + 3209) * 16807 % 1);
      let idx = 0;
      for (let d = 1; d <= 60; d++) {
        const m = d <= 30 ? 5 : 6;
        const day = d <= 30 ? d : d - 30;
        const dateStr = `2024-0${m}-${day.toString().padStart(2, '0')}`;
        carriers.forEach(carrier => {
          serviceLevels.forEach(sl => {
            idx++;
            const baseShipments = carrier === 'FedEx' ? 120 : carrier === 'UPS' ? 100 : carrier === 'USPS' ? 80 : carrier === 'DHL' ? 40 : 30;
            const slMult = sl === 'Ground' ? 1.0 : sl === 'Express' ? 0.5 : 0.15;
            const shipments = Math.floor(baseShipments * slMult + seed(idx) * 20 - 10);
            const baseCost = sl === 'Ground' ? 8 : sl === 'Express' ? 18 : 35;
            const transitDays = sl === 'Ground' ? 5 : sl === 'Express' ? 2 : 1;
            rows.push({
              date: dateStr,
              carrier,
              serviceLevel: sl,
              shipments: Math.max(shipments, 1),
              onTime: Math.round((88 + seed(idx + 100) * 12) * 10) / 10,
              damaged: Math.floor(seed(idx + 200) * 3),
              lost: Math.floor(seed(idx + 300) * 2),
              avgCost: Math.round((baseCost + seed(idx + 400) * 6 - 3) * 100) / 100,
              avgTransitDays: Math.round((transitDays + seed(idx + 500) * 1.5 - 0.5) * 10) / 10,
            });
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 14. ENERGY CONSUMPTION ─────────────────────────────────────────
  {
    id: 'energy-consumption',
    name: 'Energy Consumption',
    description: 'Facility energy usage by type and building',
    fields: [
      { id: 'month', name: 'Month', type: 'date' },
      { id: 'building', name: 'Building', type: 'string' },
      { id: 'energyType', name: 'Energy Type', type: 'string' },
      { id: 'consumption', name: 'Consumption (kWh)', type: 'number' },
      { id: 'cost', name: 'Cost', type: 'number' },
      { id: 'co2', name: 'CO2 Emissions (kg)', type: 'number' },
      { id: 'peakDemand', name: 'Peak Demand (kW)', type: 'number' },
    ],
    defaultMappings: { x: 'month', y: 'consumption', series: 'building' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const buildings = ['HQ Office', 'Warehouse A', 'Warehouse B', 'Data Center', 'Manufacturing Plant', 'R&D Lab'];
      const energyTypes = ['Electricity', 'Natural Gas', 'Solar'];
      const baseConsumption: Record<string, Record<string, number>> = {
        'HQ Office': { Electricity: 45000, 'Natural Gas': 12000, Solar: -5000 },
        'Warehouse A': { Electricity: 28000, 'Natural Gas': 8000, Solar: -3000 },
        'Warehouse B': { Electricity: 32000, 'Natural Gas': 9000, Solar: -2000 },
        'Data Center': { Electricity: 85000, 'Natural Gas': 2000, Solar: -8000 },
        'Manufacturing Plant': { Electricity: 120000, 'Natural Gas': 35000, Solar: -10000 },
        'R&D Lab': { Electricity: 22000, 'Natural Gas': 5000, Solar: -1500 },
      };
      const seed = (i: number) => Math.abs(Math.sin(i * 7333 + 1987) * 16807 % 1);
      let idx = 0;
      for (let m = 1; m <= 12; m++) {
        const month = `2024-${m.toString().padStart(2, '0')}`;
        const heatMult = 1 + 0.25 * Math.cos(((m - 7) / 12) * 2 * Math.PI);
        const coolMult = 1 + 0.3 * Math.sin(((m - 1) / 12) * 2 * Math.PI);
        buildings.forEach(bld => {
          energyTypes.forEach(et => {
            idx++;
            const base = baseConsumption[bld][et];
            const seasonMult = et === 'Natural Gas' ? heatMult : et === 'Solar' ? (0.5 + 0.5 * Math.sin(((m - 3) / 12) * 2 * Math.PI)) : coolMult;
            const consumption = Math.floor(Math.abs(base) * seasonMult * (0.9 + seed(idx) * 0.2));
            const sign = base < 0 ? -1 : 1;
            const costPerKwh = et === 'Electricity' ? 0.12 : et === 'Natural Gas' ? 0.04 : -0.08;
            const co2PerKwh = et === 'Electricity' ? 0.42 : et === 'Natural Gas' ? 0.18 : 0;
            rows.push({
              month,
              building: bld,
              energyType: et,
              consumption: consumption * sign,
              cost: Math.round(consumption * Math.abs(costPerKwh) * sign * 100) / 100,
              co2: Math.round(consumption * co2PerKwh * 10) / 10,
              peakDemand: et === 'Electricity' ? Math.floor(consumption / 500 + seed(idx + 100) * 20) : 0,
            });
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 15. SOCIAL MEDIA METRICS ───────────────────────────────────────
  {
    id: 'social-media',
    name: 'Social Media Metrics',
    description: 'Weekly social media performance across platforms',
    fields: [
      { id: 'week', name: 'Week', type: 'date' },
      { id: 'platform', name: 'Platform', type: 'string' },
      { id: 'followers', name: 'Followers', type: 'number' },
      { id: 'posts', name: 'Posts', type: 'number' },
      { id: 'impressions', name: 'Impressions', type: 'number' },
      { id: 'engagement', name: 'Engagements', type: 'number' },
      { id: 'engagementRate', name: 'Engagement Rate %', type: 'number' },
      { id: 'shares', name: 'Shares', type: 'number' },
      { id: 'mentions', name: 'Mentions', type: 'number' },
      { id: 'sentiment', name: 'Sentiment Score', type: 'number' },
    ],
    defaultMappings: { x: 'week', y: 'engagement', series: 'platform' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const platforms = ['Twitter/X', 'Instagram', 'LinkedIn', 'TikTok', 'Facebook', 'YouTube'];
      const baseFollowers: Record<string, number> = { 'Twitter/X': 45000, Instagram: 82000, LinkedIn: 28000, TikTok: 120000, Facebook: 65000, YouTube: 35000 };
      const seed = (i: number) => Math.abs(Math.sin(i * 4391 + 8273) * 16807 % 1);
      let idx = 0;
      for (let w = 1; w <= 52; w++) {
        const weekDate = `2024-W${w.toString().padStart(2, '0')}`;
        platforms.forEach(platform => {
          idx++;
          const followers = Math.floor(baseFollowers[platform] * (1 + w * 0.005) + seed(idx) * 500);
          const posts = Math.floor(3 + seed(idx + 100) * 12);
          const impressions = Math.floor(followers * (1.5 + seed(idx + 200) * 3) * (posts / 5));
          const engRate = 1.5 + seed(idx + 300) * 4;
          const engagement = Math.floor(impressions * engRate / 100);
          rows.push({
            week: weekDate,
            platform,
            followers,
            posts,
            impressions,
            engagement,
            engagementRate: Math.round(engRate * 100) / 100,
            shares: Math.floor(engagement * (0.1 + seed(idx + 400) * 0.15)),
            mentions: Math.floor(50 + seed(idx + 500) * 200),
            sentiment: Math.round((0.3 + seed(idx + 600) * 0.6) * 100) / 100,
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 16. SUPPLY CHAIN ──────────────────────────────────────────────
  {
    id: 'supply-chain',
    name: 'Supply Chain',
    description: 'Supplier performance and procurement metrics',
    fields: [
      { id: 'supplier', name: 'Supplier', type: 'string' },
      { id: 'country', name: 'Country', type: 'string' },
      { id: 'material', name: 'Material', type: 'string' },
      { id: 'month', name: 'Month', type: 'date' },
      { id: 'orderQty', name: 'Order Quantity', type: 'number' },
      { id: 'deliveredQty', name: 'Delivered Quantity', type: 'number' },
      { id: 'defectRate', name: 'Defect Rate %', type: 'number' },
      { id: 'leadTimeDays', name: 'Lead Time (days)', type: 'number' },
      { id: 'unitCost', name: 'Unit Cost', type: 'number' },
      { id: 'onTimeDelivery', name: 'On-Time Delivery %', type: 'number' },
    ],
    defaultMappings: { x: 'month', y: 'deliveredQty', series: 'supplier' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const suppliers = [
        { name: 'Shenzhen Electronics Co.', country: 'China', material: 'Circuit Boards', baseCost: 4.50, baseLead: 28 },
        { name: 'Bavaria Precision GmbH', country: 'Germany', material: 'Metal Components', baseCost: 12.80, baseLead: 18 },
        { name: 'Osaka Plastics Ltd.', country: 'Japan', material: 'Plastic Housings', baseCost: 2.30, baseLead: 22 },
        { name: 'Texas Materials Inc.', country: 'USA', material: 'Raw Materials', baseCost: 8.90, baseLead: 7 },
        { name: 'Mumbai Textiles', country: 'India', material: 'Fabric', baseCost: 1.80, baseLead: 32 },
        { name: 'São Paulo Packaging', country: 'Brazil', material: 'Packaging', baseCost: 0.95, baseLead: 25 },
        { name: 'Seoul Semiconductors', country: 'South Korea', material: 'Chips', baseCost: 6.20, baseLead: 20 },
        { name: 'Milan Leather Works', country: 'Italy', material: 'Leather', baseCost: 15.50, baseLead: 15 },
      ];
      const seed = (i: number) => Math.abs(Math.sin(i * 6737 + 2341) * 16807 % 1);
      let idx = 0;
      for (let m = 1; m <= 12; m++) {
        const month = `2024-${m.toString().padStart(2, '0')}`;
        suppliers.forEach(s => {
          idx++;
          const orderQty = Math.floor(5000 + seed(idx) * 15000);
          const fillRate = 0.88 + seed(idx + 100) * 0.12;
          const deliveredQty = Math.floor(orderQty * fillRate);
          rows.push({
            supplier: s.name,
            country: s.country,
            material: s.material,
            month,
            orderQty,
            deliveredQty,
            defectRate: Math.round((0.5 + seed(idx + 200) * 4) * 100) / 100,
            leadTimeDays: Math.floor(s.baseLead + seed(idx + 300) * 10 - 3),
            unitCost: Math.round((s.baseCost * (0.9 + seed(idx + 400) * 0.2)) * 100) / 100,
            onTimeDelivery: Math.round((82 + seed(idx + 500) * 18) * 10) / 10,
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 17. HEALTHCARE METRICS ─────────────────────────────────────────
  {
    id: 'healthcare-metrics',
    name: 'Healthcare Metrics',
    description: 'Hospital department performance and patient metrics',
    fields: [
      { id: 'month', name: 'Month', type: 'date' },
      { id: 'department', name: 'Department', type: 'string' },
      { id: 'admissions', name: 'Admissions', type: 'number' },
      { id: 'discharges', name: 'Discharges', type: 'number' },
      { id: 'avgLOS', name: 'Avg Length of Stay (days)', type: 'number' },
      { id: 'occupancyRate', name: 'Occupancy Rate %', type: 'number' },
      { id: 'readmissionRate', name: 'Readmission Rate %', type: 'number' },
      { id: 'patientSatisfaction', name: 'Patient Satisfaction', type: 'number' },
      { id: 'staffRatio', name: 'Staff-to-Patient Ratio', type: 'number' },
    ],
    defaultMappings: { x: 'month', y: 'admissions', series: 'department' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const departments = ['Emergency', 'Cardiology', 'Orthopedics', 'Oncology', 'Pediatrics', 'Neurology', 'ICU', 'Maternity'];
      const baseAdmissions: Record<string, number> = { Emergency: 450, Cardiology: 120, Orthopedics: 95, Oncology: 80, Pediatrics: 110, Neurology: 65, ICU: 45, Maternity: 130 };
      const baseLOS: Record<string, number> = { Emergency: 1.2, Cardiology: 4.5, Orthopedics: 3.8, Oncology: 6.2, Pediatrics: 2.1, Neurology: 5.0, ICU: 7.5, Maternity: 2.8 };
      const seed = (i: number) => Math.abs(Math.sin(i * 3617 + 9421) * 16807 % 1);
      let idx = 0;
      for (let m = 1; m <= 12; m++) {
        const month = `2024-${m.toString().padStart(2, '0')}`;
        const fluSeason = m <= 3 || m >= 11 ? 1.2 : 1.0;
        departments.forEach(dept => {
          idx++;
          const seasonMult = dept === 'Emergency' || dept === 'Pediatrics' ? fluSeason : 1.0;
          const admissions = Math.floor(baseAdmissions[dept] * seasonMult + seed(idx) * 30 - 15);
          const discharges = Math.floor(admissions * (0.9 + seed(idx + 100) * 0.12));
          rows.push({
            month,
            department: dept,
            admissions,
            discharges,
            avgLOS: Math.round((baseLOS[dept] + seed(idx + 200) * 1.5 - 0.5) * 10) / 10,
            occupancyRate: Math.round((70 + seed(idx + 300) * 25) * 10) / 10,
            readmissionRate: Math.round((3 + seed(idx + 400) * 8) * 10) / 10,
            patientSatisfaction: Math.round((3.5 + seed(idx + 500) * 1.3) * 10) / 10,
            staffRatio: Math.round((2 + seed(idx + 600) * 4) * 10) / 10,
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 18. SAAS METRICS ──────────────────────────────────────────────
  {
    id: 'saas-metrics',
    name: 'SaaS Metrics',
    description: 'Monthly SaaS business metrics: MRR, churn, CAC, LTV',
    fields: [
      { id: 'month', name: 'Month', type: 'date' },
      { id: 'plan', name: 'Plan', type: 'string' },
      { id: 'mrr', name: 'MRR', type: 'number' },
      { id: 'newMrr', name: 'New MRR', type: 'number' },
      { id: 'expansionMrr', name: 'Expansion MRR', type: 'number' },
      { id: 'churnedMrr', name: 'Churned MRR', type: 'number' },
      { id: 'customers', name: 'Customers', type: 'number' },
      { id: 'churnRate', name: 'Churn Rate %', type: 'number' },
      { id: 'arpu', name: 'ARPU', type: 'number' },
      { id: 'cac', name: 'CAC', type: 'number' },
      { id: 'ltv', name: 'LTV', type: 'number' },
    ],
    defaultMappings: { x: 'month', y: 'mrr', series: 'plan' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const plans = ['Starter', 'Professional', 'Enterprise'];
      const baseMrr: Record<string, number> = { Starter: 85000, Professional: 220000, Enterprise: 450000 };
      const baseCustomers: Record<string, number> = { Starter: 3400, Professional: 880, Enterprise: 120 };
      const seed = (i: number) => Math.abs(Math.sin(i * 8821 + 5647) * 16807 % 1);
      let idx = 0;
      for (let m = 1; m <= 18; m++) {
        const year = m <= 12 ? 2023 : 2024;
        const monthNum = m <= 12 ? m : m - 12;
        const month = `${year}-${monthNum.toString().padStart(2, '0')}`;
        plans.forEach(plan => {
          idx++;
          const growthRate = plan === 'Starter' ? 0.03 : plan === 'Professional' ? 0.05 : 0.04;
          const mrr = Math.floor(baseMrr[plan] * Math.pow(1 + growthRate, m) + seed(idx) * 5000);
          const newMrr = Math.floor(mrr * (0.06 + seed(idx + 100) * 0.04));
          const expansionMrr = Math.floor(mrr * (0.02 + seed(idx + 200) * 0.03));
          const churnedMrr = Math.floor(mrr * (0.02 + seed(idx + 300) * 0.02));
          const customers = Math.floor(baseCustomers[plan] * Math.pow(1 + growthRate * 0.8, m));
          const arpu = Math.round(mrr / customers * 100) / 100;
          const churnRate = Math.round((1.5 + seed(idx + 400) * 3) * 100) / 100;
          const cac = plan === 'Starter' ? Math.floor(50 + seed(idx + 500) * 30) : plan === 'Professional' ? Math.floor(200 + seed(idx + 500) * 100) : Math.floor(800 + seed(idx + 500) * 400);
          rows.push({
            month,
            plan,
            mrr,
            newMrr,
            expansionMrr,
            churnedMrr,
            customers,
            churnRate,
            arpu,
            cac,
            ltv: Math.floor(arpu / (churnRate / 100)),
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 19. REAL ESTATE ────────────────────────────────────────────────
  {
    id: 'real-estate',
    name: 'Real Estate',
    description: 'Property listings with prices, sizes, and market data',
    fields: [
      { id: 'neighborhood', name: 'Neighborhood', type: 'string' },
      { id: 'propertyType', name: 'Property Type', type: 'string' },
      { id: 'bedrooms', name: 'Bedrooms', type: 'number' },
      { id: 'sqft', name: 'Sq Ft', type: 'number' },
      { id: 'listPrice', name: 'List Price', type: 'number' },
      { id: 'soldPrice', name: 'Sold Price', type: 'number' },
      { id: 'pricePerSqft', name: 'Price per Sq Ft', type: 'number' },
      { id: 'daysOnMarket', name: 'Days on Market', type: 'number' },
      { id: 'yearBuilt', name: 'Year Built', type: 'number' },
      { id: 'soldDate', name: 'Sold Date', type: 'date' },
    ],
    defaultMappings: { x: 'neighborhood', y: 'soldPrice', series: 'propertyType' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const neighborhoods = ['Downtown', 'Midtown', 'Westside', 'Eastside', 'Northshore', 'Southpark', 'Riverside', 'Hillcrest', 'Lakewood', 'Old Town'];
      const types = ['Single Family', 'Condo', 'Townhouse'];
      const basePricePerSqft: Record<string, number> = { Downtown: 450, Midtown: 380, Westside: 320, Eastside: 280, Northshore: 350, Southpark: 260, Riverside: 340, Hillcrest: 400, Lakewood: 310, 'Old Town': 290 };
      const seed = (i: number) => Math.abs(Math.sin(i * 9127 + 4813) * 16807 % 1);
      let idx = 0;
      neighborhoods.forEach(hood => {
        types.forEach(type => {
          const numListings = 4 + Math.floor(seed(idx++) * 6);
          for (let i = 0; i < numListings; i++) {
            idx++;
            const bedrooms = type === 'Condo' ? Math.floor(1 + seed(idx) * 2.5) : type === 'Townhouse' ? Math.floor(2 + seed(idx) * 2) : Math.floor(2 + seed(idx) * 4);
            const baseSqft = type === 'Condo' ? 800 : type === 'Townhouse' ? 1400 : 1800;
            const sqft = Math.floor(baseSqft + bedrooms * 250 + seed(idx + 100) * 600);
            const ppsf = Math.floor(basePricePerSqft[hood] * (0.85 + seed(idx + 200) * 0.3));
            const listPrice = Math.floor(sqft * ppsf / 1000) * 1000;
            const saleRatio = 0.95 + seed(idx + 300) * 0.08;
            const soldPrice = Math.floor(listPrice * saleRatio / 1000) * 1000;
            const m = Math.floor(1 + seed(idx + 400) * 12);
            const d = Math.floor(1 + seed(idx + 500) * 28);
            rows.push({
              neighborhood: hood,
              propertyType: type,
              bedrooms,
              sqft,
              listPrice,
              soldPrice,
              pricePerSqft: ppsf,
              daysOnMarket: Math.floor(5 + seed(idx + 600) * 80),
              yearBuilt: Math.floor(1960 + seed(idx + 700) * 64),
              soldDate: `2024-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
            });
          }
        });
      });
      return rows;
    })(),
  },

  // ─── 20. MANUFACTURING QC ──────────────────────────────────────────
  {
    id: 'manufacturing-qc',
    name: 'Manufacturing QC',
    description: 'Quality control data from production lines with defect tracking',
    fields: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'productionLine', name: 'Production Line', type: 'string' },
      { id: 'product', name: 'Product', type: 'string' },
      { id: 'unitsProduced', name: 'Units Produced', type: 'number' },
      { id: 'unitsPassed', name: 'Units Passed', type: 'number' },
      { id: 'defects', name: 'Defects', type: 'number' },
      { id: 'defectRate', name: 'Defect Rate %', type: 'number' },
      { id: 'downtime', name: 'Downtime (min)', type: 'number' },
      { id: 'oee', name: 'OEE %', type: 'number' },
      { id: 'scrapCost', name: 'Scrap Cost', type: 'number' },
    ],
    defaultMappings: { x: 'date', y: 'oee', series: 'productionLine' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const lines = ['Line Alpha', 'Line Beta', 'Line Gamma', 'Line Delta'];
      const products = ['Widget A', 'Widget B', 'Assembly C', 'Component D'];
      const seed = (i: number) => Math.abs(Math.sin(i * 5279 + 7841) * 16807 % 1);
      let idx = 0;
      for (let d = 1; d <= 90; d++) {
        const m = Math.ceil(d / 31);
        const dayInMonth = ((d - 1) % 31) + 1;
        const month = Math.min(m, 3);
        const day = Math.min(dayInMonth, [31, 29, 31][month - 1]);
        const dateStr = `2024-0${month}-${day.toString().padStart(2, '0')}`;
        lines.forEach((line, li) => {
          idx++;
          const product = products[li];
          const baseUnits = 800 + li * 200;
          const unitsProduced = Math.floor(baseUnits + seed(idx) * 200 - 100);
          const defectRate = 1.5 + seed(idx + 100) * 4;
          const defects = Math.floor(unitsProduced * defectRate / 100);
          const unitsPassed = unitsProduced - defects;
          const downtime = Math.floor(seed(idx + 200) * 120);
          const availability = (480 - downtime) / 480;
          const performance = 0.85 + seed(idx + 300) * 0.12;
          const quality = unitsPassed / unitsProduced;
          const oee = Math.round(availability * performance * quality * 100 * 10) / 10;
          rows.push({
            date: dateStr,
            productionLine: line,
            product,
            unitsProduced,
            unitsPassed,
            defects,
            defectRate: Math.round(defectRate * 100) / 100,
            downtime,
            oee,
            scrapCost: Math.round(defects * (5 + li * 3) * 100) / 100,
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 21. WEATHER DATA ──────────────────────────────────────────────
  {
    id: 'weather-data',
    name: 'Weather Data',
    description: 'Daily weather observations across multiple cities',
    fields: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'city', name: 'City', type: 'string' },
      { id: 'tempHigh', name: 'High Temp (°F)', type: 'number' },
      { id: 'tempLow', name: 'Low Temp (°F)', type: 'number' },
      { id: 'humidity', name: 'Humidity %', type: 'number' },
      { id: 'precipitation', name: 'Precipitation (in)', type: 'number' },
      { id: 'windSpeed', name: 'Wind Speed (mph)', type: 'number' },
      { id: 'uvIndex', name: 'UV Index', type: 'number' },
    ],
    defaultMappings: { x: 'date', y: 'tempHigh', series: 'city' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const cities = [
        { name: 'New York', baseTemp: 55, amplitude: 25 },
        { name: 'Los Angeles', baseTemp: 70, amplitude: 10 },
        { name: 'Chicago', baseTemp: 50, amplitude: 30 },
        { name: 'Houston', baseTemp: 75, amplitude: 15 },
        { name: 'Phoenix', baseTemp: 85, amplitude: 20 },
        { name: 'Seattle', baseTemp: 55, amplitude: 12 },
        { name: 'Miami', baseTemp: 80, amplitude: 8 },
        { name: 'Denver', baseTemp: 55, amplitude: 22 },
      ];
      const seed = (i: number) => Math.abs(Math.sin(i * 3491 + 6173) * 16807 % 1);
      let idx = 0;
      for (let d = 0; d < 365; d++) {
        const date = new Date(2024, 0, 1 + d);
        const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const dayFraction = d / 365;
        cities.forEach(city => {
          idx++;
          const seasonalTemp = city.baseTemp + city.amplitude * Math.sin((dayFraction - 0.22) * 2 * Math.PI);
          const tempHigh = Math.round(seasonalTemp + seed(idx) * 10 - 3);
          const tempLow = Math.round(tempHigh - 12 - seed(idx + 100) * 8);
          const humidity = Math.round(40 + seed(idx + 200) * 45 + (city.name === 'Miami' || city.name === 'Houston' ? 15 : 0));
          const precipChance = seed(idx + 300);
          const precipitation = precipChance > 0.7 ? Math.round(seed(idx + 400) * 2 * 100) / 100 : 0;
          rows.push({
            date: dateStr,
            city: city.name,
            tempHigh,
            tempLow,
            humidity: Math.min(humidity, 100),
            precipitation,
            windSpeed: Math.round((5 + seed(idx + 500) * 20) * 10) / 10,
            uvIndex: Math.round((2 + seed(idx + 600) * 8 * Math.sin((dayFraction - 0.22) * Math.PI)) * 10) / 10,
          });
        });
      }
      return rows;
    })(),
  },

  // ─── 22. EDUCATION METRICS ─────────────────────────────────────────
  {
    id: 'education-metrics',
    name: 'Education Metrics',
    description: 'School performance data by grade and subject',
    fields: [
      { id: 'school', name: 'School', type: 'string' },
      { id: 'grade', name: 'Grade', type: 'string' },
      { id: 'subject', name: 'Subject', type: 'string' },
      { id: 'students', name: 'Students', type: 'number' },
      { id: 'avgScore', name: 'Avg Score', type: 'number' },
      { id: 'passRate', name: 'Pass Rate %', type: 'number' },
      { id: 'attendance', name: 'Attendance %', type: 'number' },
      { id: 'teacherRatio', name: 'Student-Teacher Ratio', type: 'number' },
    ],
    defaultMappings: { x: 'subject', y: 'avgScore', series: 'school' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const schools = ['Lincoln Elementary', 'Washington Middle', 'Jefferson High', 'Roosevelt Academy', 'Hamilton Prep', 'Adams Charter'];
      const grades = ['6th', '7th', '8th', '9th', '10th', '11th', '12th'];
      const subjects = ['Math', 'English', 'Science', 'History', 'Art', 'PE'];
      const seed = (i: number) => Math.abs(Math.sin(i * 7129 + 3467) * 16807 % 1);
      let idx = 0;
      schools.forEach(school => {
        grades.forEach(grade => {
          subjects.forEach(subject => {
            idx++;
            const students = Math.floor(20 + seed(idx) * 15);
            const baseScore = 65 + seed(idx + 100) * 25;
            rows.push({
              school,
              grade,
              subject,
              students,
              avgScore: Math.round(baseScore * 10) / 10,
              passRate: Math.round((70 + seed(idx + 200) * 28) * 10) / 10,
              attendance: Math.round((85 + seed(idx + 300) * 14) * 10) / 10,
              teacherRatio: Math.round((15 + seed(idx + 400) * 12) * 10) / 10,
            });
          });
        });
      });
      return rows;
    })(),
  },

  // ─── 23. CRYPTOCURRENCY ────────────────────────────────────────────
  {
    id: 'crypto-prices',
    name: 'Cryptocurrency Prices',
    description: 'Daily crypto prices with volume and market cap',
    fields: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'coin', name: 'Coin', type: 'string' },
      { id: 'open', name: 'Open', type: 'number' },
      { id: 'high', name: 'High', type: 'number' },
      { id: 'low', name: 'Low', type: 'number' },
      { id: 'close', name: 'Close', type: 'number' },
      { id: 'volume', name: 'Volume (M)', type: 'number' },
      { id: 'marketCap', name: 'Market Cap (B)', type: 'number' },
    ],
    defaultMappings: { x: 'date', y: 'close', series: 'coin' },
    rows: (() => {
      const rows: Record<string, any>[] = [];
      const coins = [
        { name: 'Bitcoin', basePrice: 42000, vol: 25000, mcap: 820 },
        { name: 'Ethereum', basePrice: 2200, vol: 12000, mcap: 265 },
        { name: 'Solana', basePrice: 95, vol: 2500, mcap: 42 },
        { name: 'Cardano', basePrice: 0.55, vol: 800, mcap: 19 },
        { name: 'Polkadot', basePrice: 7.5, vol: 500, mcap: 10 },
      ];
      const seed = (i: number) => Math.abs(Math.sin(i * 4523 + 8761) * 16807 % 1);
      let idx = 0;
      coins.forEach(coin => {
        let price = coin.basePrice;
        for (let d = 0; d < 180; d++) {
          idx++;
          const date = new Date(2024, 0, 1 + d);
          const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
          const dailyReturn = (seed(idx) - 0.48) * 0.06;
          const open = price;
          price = price * (1 + dailyReturn);
          const close = Math.round(price * 100) / 100;
          const dayRange = Math.abs(close - open) + price * seed(idx + 100) * 0.02;
          const high = Math.round(Math.max(open, close) + dayRange * seed(idx + 200) * 100) / 100;
          const low = Math.round(Math.min(open, close) - dayRange * seed(idx + 300) * 100) / 100;
          const volume = Math.round(coin.vol * (0.5 + seed(idx + 400) * 1.5) * 10) / 10;
          rows.push({
            date: dateStr,
            coin: coin.name,
            open: Math.round(open * 100) / 100,
            high,
            low: Math.max(low, 0.01),
            close,
            volume,
            marketCap: Math.round(coin.mcap * (close / coin.basePrice) * 10) / 10,
          });
        }
      });
      return rows;
    })(),
  },

  // ─── 24. CUSTOMER JOURNEY FLOW ─────────────────────────────────────
  {
    id: 'customer-journey-flow',
    name: 'Customer Journey Flow',
    description: 'Customer journey stages for funnel and Sankey visualizations',
    fields: [
      { id: 'source', name: 'Source', type: 'string' },
      { id: 'target', name: 'Target', type: 'string' },
      { id: 'value', name: 'Value', type: 'number' },
    ],
    defaultMappings: { x: 'source', y: 'target', value: 'value' },
    rows: [
      { source: 'Organic Search', target: 'Landing Page', value: 12000 },
      { source: 'Paid Ads', target: 'Landing Page', value: 8000 },
      { source: 'Social Media', target: 'Landing Page', value: 5500 },
      { source: 'Email', target: 'Landing Page', value: 3200 },
      { source: 'Direct', target: 'Landing Page', value: 4000 },
      { source: 'Referral', target: 'Landing Page', value: 2000 },
      { source: 'Landing Page', target: 'Product Page', value: 22000 },
      { source: 'Landing Page', target: 'Bounce', value: 12700 },
      { source: 'Product Page', target: 'Add to Cart', value: 8800 },
      { source: 'Product Page', target: 'Exit', value: 13200 },
      { source: 'Add to Cart', target: 'Checkout', value: 5280 },
      { source: 'Add to Cart', target: 'Abandoned Cart', value: 3520 },
      { source: 'Checkout', target: 'Payment', value: 4750 },
      { source: 'Checkout', target: 'Abandoned Checkout', value: 530 },
      { source: 'Payment', target: 'Order Confirmed', value: 4500 },
      { source: 'Payment', target: 'Payment Failed', value: 250 },
      { source: 'Order Confirmed', target: 'Delivered', value: 4350 },
      { source: 'Order Confirmed', target: 'Cancelled', value: 150 },
      { source: 'Delivered', target: 'Repeat Customer', value: 1740 },
      { source: 'Delivered', target: 'One-Time Customer', value: 2175 },
      { source: 'Delivered', target: 'Returned', value: 435 },
    ],
  },

  // ─── 25. BUDGET ALLOCATION FLOW ────────────────────────────────────
  {
    id: 'budget-flow',
    name: 'Budget Allocation',
    description: 'Company budget flow from revenue sources to expenditure categories',
    fields: [
      { id: 'source', name: 'Source', type: 'string' },
      { id: 'target', name: 'Target', type: 'string' },
      { id: 'value', name: 'Value (K)', type: 'number' },
    ],
    defaultMappings: { x: 'source', y: 'target', value: 'value' },
    rows: [
      { source: 'Product Revenue', target: 'Total Revenue', value: 5400 },
      { source: 'Service Revenue', target: 'Total Revenue', value: 2160 },
      { source: 'Subscription Revenue', target: 'Total Revenue', value: 1440 },
      { source: 'Total Revenue', target: 'COGS', value: 3240 },
      { source: 'Total Revenue', target: 'Gross Profit', value: 5760 },
      { source: 'Gross Profit', target: 'Sales & Marketing', value: 1020 },
      { source: 'Gross Profit', target: 'R&D', value: 1320 },
      { source: 'Gross Profit', target: 'G&A', value: 660 },
      { source: 'Gross Profit', target: 'Operating Income', value: 2760 },
      { source: 'COGS', target: 'Materials', value: 2160 },
      { source: 'COGS', target: 'Labor', value: 720 },
      { source: 'COGS', target: 'Overhead', value: 360 },
      { source: 'Sales & Marketing', target: 'Digital Ads', value: 420 },
      { source: 'Sales & Marketing', target: 'Sales Team', value: 380 },
      { source: 'Sales & Marketing', target: 'Events', value: 120 },
      { source: 'Sales & Marketing', target: 'Content', value: 100 },
      { source: 'Operating Income', target: 'Taxes', value: 690 },
      { source: 'Operating Income', target: 'Net Income', value: 2070 },
    ],
  },
];
