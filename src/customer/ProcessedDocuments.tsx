import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────

type DocumentStatus = 'success' | 'review' | 'failed';

interface ProcessedDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  pages: number;
  status: DocumentStatus;
  confidence: number;
  processedAt: string;
  processedBy: string;
  duration: string;
  errors: string[];
  warnings: string[];
  extractedFields: { label: string; value: string; confidence: number }[];
  previewLines: string[];
  category: string;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const Icons = {
  document: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  checkCircle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  alertTriangle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  xCircle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  search: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  filter: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  eye: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  download: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  refresh: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  x: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  clock: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  fileText: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  barChart: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  zap: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  chevronDown: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  chevronRight: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  grid: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  list: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  arrowUpRight: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ),
  info: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  layers: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
};

// ─── Animation Variants ─────────────────────────────────────────────────────

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 28, stiffness: 380 },
  },
};

// ─── Status Configuration ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocumentStatus, {
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  bg: string;
  border: string;
  text: string;
  dot: string;
  glow: string;
  barColor: string;
  gradient: string;
}> = {
  success: {
    label: 'Processed',
    icon: Icons.checkCircle,
    bg: 'bg-emerald-500/[0.08]',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    glow: 'shadow-emerald-500/20',
    barColor: 'bg-emerald-500',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
  },
  review: {
    label: 'Needs Review',
    icon: Icons.alertTriangle,
    bg: 'bg-amber-500/[0.08]',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    glow: 'shadow-amber-500/20',
    barColor: 'bg-amber-500',
    gradient: 'from-amber-500/20 to-amber-600/5',
  },
  failed: {
    label: 'Failed',
    icon: Icons.xCircle,
    bg: 'bg-rose-500/[0.08]',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    glow: 'shadow-rose-500/20',
    barColor: 'bg-rose-500',
    gradient: 'from-rose-500/20 to-rose-600/5',
  },
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: ProcessedDocument[] = [
  {
    id: 'doc-001',
    name: 'Invoice_2024_Q1_Final.pdf',
    type: 'PDF',
    size: '2.4 MB',
    pages: 3,
    status: 'success',
    confidence: 98.5,
    processedAt: '2 minutes ago',
    processedBy: 'Auto Processor v3.2',
    duration: '1.2s',
    errors: [],
    warnings: [],
    category: 'Invoice',
    extractedFields: [
      { label: 'Invoice Number', value: 'INV-2024-0847', confidence: 99.2 },
      { label: 'Date', value: '2024-01-15', confidence: 99.8 },
      { label: 'Total Amount', value: '$12,450.00', confidence: 97.5 },
      { label: 'Vendor', value: 'Acme Corp', confidence: 98.1 },
      { label: 'Due Date', value: '2024-02-15', confidence: 99.0 },
    ],
    previewLines: [
      'INVOICE',
      'Invoice #: INV-2024-0847',
      'Date: January 15, 2024',
      'Bill To: TechStart Inc.',
      '',
      'Description          Qty    Rate      Amount',
      '─────────────────────────────────────────────',
      'Cloud Services        1    $8,500    $8,500.00',
      'Support License       1    $2,950    $2,950.00',
      'Setup Fee             1    $1,000    $1,000.00',
      '─────────────────────────────────────────────',
      'Subtotal                              $12,450.00',
      'Tax (0%)                              $0.00',
      'TOTAL                                 $12,450.00',
    ],
  },
  {
    id: 'doc-002',
    name: 'Employment_Contract_JDoe.docx',
    type: 'DOCX',
    size: '856 KB',
    pages: 12,
    status: 'review',
    confidence: 72.3,
    processedAt: '15 minutes ago',
    processedBy: 'Auto Processor v3.2',
    duration: '3.8s',
    errors: [],
    warnings: [
      'Signature field could not be verified',
      'Date format inconsistency on page 4',
      'Low confidence on compensation clause extraction',
    ],
    category: 'Contract',
    extractedFields: [
      { label: 'Employee Name', value: 'John Doe', confidence: 95.0 },
      { label: 'Position', value: 'Senior Engineer', confidence: 88.2 },
      { label: 'Start Date', value: '2024-02-01', confidence: 91.0 },
      { label: 'Salary', value: '$145,000/yr', confidence: 62.5 },
      { label: 'Department', value: 'Engineering', confidence: 85.0 },
    ],
    previewLines: [
      'EMPLOYMENT CONTRACT',
      '',
      'This Employment Agreement ("Agreement") is',
      'entered into as of February 1, 2024, by and',
      'between TechStart Inc. ("Company") and',
      'John Doe ("Employee").',
      '',
      '1. POSITION AND DUTIES',
      'Employee shall serve as Senior Engineer...',
      '',
      '2. COMPENSATION',
      'Base salary: [NEEDS REVIEW]',
      '',
      '3. BENEFITS',
      'Standard benefits package applies...',
    ],
  },
  {
    id: 'doc-003',
    name: 'Financial_Report_2023_Annual.xlsx',
    type: 'XLSX',
    size: '4.1 MB',
    pages: 8,
    status: 'success',
    confidence: 95.8,
    processedAt: '1 hour ago',
    processedBy: 'Auto Processor v3.2',
    duration: '2.1s',
    errors: [],
    warnings: [],
    category: 'Report',
    extractedFields: [
      { label: 'Report Period', value: 'FY 2023', confidence: 99.5 },
      { label: 'Total Revenue', value: '$2.4M', confidence: 97.2 },
      { label: 'Net Income', value: '$340K', confidence: 94.8 },
      { label: 'YoY Growth', value: '+18.5%', confidence: 96.0 },
    ],
    previewLines: [
      'ANNUAL FINANCIAL REPORT — FY 2023',
      '',
      'Revenue Summary',
      '──────────────────────────────────',
      'Q1 Revenue:     $520,000',
      'Q2 Revenue:     $610,000',
      'Q3 Revenue:     $580,000',
      'Q4 Revenue:     $690,000',
      '──────────────────────────────────',
      'Total Revenue:  $2,400,000',
      '',
      'Net Income:     $340,000',
      'Profit Margin:  14.2%',
    ],
  },
  {
    id: 'doc-004',
    name: 'Corrupted_Scan_pg12.tiff',
    type: 'TIFF',
    size: '12.8 MB',
    pages: 1,
    status: 'failed',
    confidence: 0,
    processedAt: '2 hours ago',
    processedBy: 'Auto Processor v3.2',
    duration: '8.4s',
    errors: [
      'Image resolution too low (72 DPI — minimum 150 DPI required)',
      'OCR engine failed: Unable to detect text regions',
      'File appears corrupted — CRC checksum mismatch',
    ],
    warnings: [],
    category: 'Scan',
    extractedFields: [],
    previewLines: [
      '⚠ PREVIEW UNAVAILABLE',
      '',
      'This document could not be rendered.',
      'The file appears to be corrupted or',
      'the format is not supported for preview.',
      '',
      'Error Code: ERR_CORRUPT_FILE_0x3F2',
    ],
  },
  {
    id: 'doc-005',
    name: 'Purchase_Order_8847.pdf',
    type: 'PDF',
    size: '1.1 MB',
    pages: 2,
    status: 'success',
    confidence: 99.1,
    processedAt: '3 hours ago',
    processedBy: 'Auto Processor v3.2',
    duration: '0.9s',
    errors: [],
    warnings: [],
    category: 'Purchase Order',
    extractedFields: [
      { label: 'PO Number', value: 'PO-8847', confidence: 99.8 },
      { label: 'Vendor', value: 'SupplyChain Co.', confidence: 98.5 },
      { label: 'Total', value: '$3,200.00', confidence: 99.1 },
      { label: 'Delivery Date', value: '2024-01-30', confidence: 97.0 },
    ],
    previewLines: [
      'PURCHASE ORDER',
      'PO #: PO-8847',
      '',
      'Vendor: SupplyChain Co.',
      'Ship To: TechStart Inc. — HQ',
      '',
      'Item                  Qty    Unit Price',
      '──────────────────────────────────────',
      'Server Rack Unit       2     $1,200.00',
      'Network Cable Kit      4       $200.00',
      '──────────────────────────────────────',
      'Total:                       $3,200.00',
    ],
  },
  {
    id: 'doc-006',
    name: 'NDA_PartnerCo_2024.pdf',
    type: 'PDF',
    size: '640 KB',
    pages: 5,
    status: 'review',
    confidence: 81.4,
    processedAt: '4 hours ago',
    processedBy: 'Auto Processor v3.2',
    duration: '2.5s',
    errors: [],
    warnings: [
      'Handwritten annotations detected on page 3 — manual verification recommended',
      'Party name extraction confidence below threshold',
    ],
    category: 'Legal',
    extractedFields: [
      { label: 'Agreement Type', value: 'Mutual NDA', confidence: 94.0 },
      { label: 'Party A', value: 'TechStart Inc.', confidence: 96.0 },
      { label: 'Party B', value: 'PartnerCo [?]', confidence: 68.0 },
      { label: 'Effective Date', value: '2024-01-10', confidence: 92.0 },
      { label: 'Duration', value: '24 months', confidence: 85.0 },
    ],
    previewLines: [
      'MUTUAL NON-DISCLOSURE AGREEMENT',
      '',
      'This Mutual Non-Disclosure Agreement',
      '("Agreement") is entered into by:',
      '',
      'Party A: TechStart Inc.',
      'Party B: [HANDWRITTEN — NEEDS REVIEW]',
      '',
      'EFFECTIVE DATE: January 10, 2024',
      '',
      '1. CONFIDENTIAL INFORMATION',
      'Each party agrees to protect...',
    ],
  },
  {
    id: 'doc-007',
    name: 'Expense_Report_Dec2023.pdf',
    type: 'PDF',
    size: '3.2 MB',
    pages: 6,
    status: 'success',
    confidence: 96.2,
    processedAt: '5 hours ago',
    processedBy: 'Auto Processor v3.2',
    duration: '1.8s',
    errors: [],
    warnings: [],
    category: 'Expense',
    extractedFields: [
      { label: 'Employee', value: 'Sarah Chen', confidence: 99.0 },
      { label: 'Period', value: 'Dec 2023', confidence: 98.5 },
      { label: 'Total Expenses', value: '$4,827.50', confidence: 95.0 },
      { label: 'Department', value: 'Marketing', confidence: 97.0 },
    ],
    previewLines: [
      'EXPENSE REPORT',
      'Employee: Sarah Chen',
      'Department: Marketing',
      'Period: December 2023',
      '',
      'Date       Description         Amount',
      '─────────────────────────────────────',
      '12/03      Client Dinner       $285.00',
      '12/07      Flight — SFO>NYC    $1,240.00',
      '12/07-09   Hotel (3 nights)    $2,100.00',
      '12/10      Uber rides          $142.50',
      '12/15      Office supplies     $1,060.00',
      '─────────────────────────────────────',
      'TOTAL                          $4,827.50',
    ],
  },
  {
    id: 'doc-008',
    name: 'Blurry_Receipt_Photo.jpg',
    type: 'JPG',
    size: '5.6 MB',
    pages: 1,
    status: 'failed',
    confidence: 12.0,
    processedAt: '6 hours ago',
    processedBy: 'Auto Processor v3.2',
    duration: '5.2s',
    errors: [
      'Image quality insufficient — excessive blur detected',
      'Text extraction confidence below minimum threshold (12%)',
    ],
    warnings: [],
    category: 'Receipt',
    extractedFields: [
      { label: 'Merchant', value: '[Unreadable]', confidence: 12.0 },
    ],
    previewLines: [
      '⚠ LOW QUALITY IMAGE',
      '',
      'The uploaded image is too blurry',
      'for reliable text extraction.',
      '',
      'Recommendation:',
      '• Re-scan at higher resolution',
      '• Ensure proper lighting',
      '• Hold camera steady',
    ],
  },
  {
    id: 'doc-009',
    name: 'Tax_Return_2023_Final.pdf',
    type: 'PDF',
    size: '1.8 MB',
    pages: 15,
    status: 'success',
    confidence: 97.0,
    processedAt: '1 day ago',
    processedBy: 'Auto Processor v3.2',
    duration: '4.2s',
    errors: [],
    warnings: [],
    category: 'Tax',
    extractedFields: [
      { label: 'Tax Year', value: '2023', confidence: 99.9 },
      { label: 'Filing Status', value: 'Single', confidence: 98.0 },
      { label: 'Total Income', value: '$152,000', confidence: 96.0 },
      { label: 'Tax Owed', value: '$28,400', confidence: 95.5 },
    ],
    previewLines: [
      'U.S. INDIVIDUAL INCOME TAX RETURN',
      'Form 1040 — Tax Year 2023',
      '',
      'Filing Status: Single',
      'Name: [REDACTED]',
      '',
      'Income:',
      'Wages & Salaries:    $145,000',
      'Interest Income:       $4,200',
      'Other Income:          $2,800',
      '─────────────────────────────',
      'Total Income:        $152,000',
      '',
      'Tax Owed:             $28,400',
    ],
  },
  {
    id: 'doc-010',
    name: 'Vendor_Agreement_Draft.pdf',
    type: 'PDF',
    size: '920 KB',
    pages: 8,
    status: 'review',
    confidence: 78.0,
    processedAt: '1 day ago',
    processedBy: 'Auto Processor v3.2',
    duration: '3.1s',
    errors: [],
    warnings: [
      'Multiple tracked changes detected — review final version',
      'Pricing table on page 6 has overlapping text',
    ],
    category: 'Contract',
    extractedFields: [
      { label: 'Vendor', value: 'DataFlow Inc.', confidence: 92.0 },
      { label: 'Contract Value', value: '$48,000/yr', confidence: 71.0 },
      { label: 'Term', value: '12 months', confidence: 88.0 },
      { label: 'Auto-Renew', value: 'Yes', confidence: 80.0 },
    ],
    previewLines: [
      'VENDOR SERVICE AGREEMENT — DRAFT',
      '',
      'Between: TechStart Inc. ("Client")',
      'And: DataFlow Inc. ("Vendor")',
      '',
      '1. SCOPE OF SERVICES',
      'Vendor shall provide data processing...',
      '',
      '2. PRICING [TRACKED CHANGES]',
      '   [DELETED] $42,000/year',
      '   [INSERTED] $48,000/year',
      '',
      '3. TERM: 12 months, auto-renew',
    ],
  },
];

// ─── Confidence Bar ──────────────────────────────────────────────────────────

function ConfidenceBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const getColor = (v: number) => {
    if (v >= 90) return 'bg-emerald-500';
    if (v >= 70) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getTextColor = (v: number) => {
    if (v >= 90) return 'text-emerald-400';
    if (v >= 70) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className={`flex items-center gap-2 ${size === 'sm' ? 'gap-1.5' : ''}`}>
      <div className={`flex-1 rounded-full overflow-hidden ${size === 'sm' ? 'h-1' : 'h-1.5'} bg-white/[0.06]`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={`h-full rounded-full ${getColor(value)}`}
        />
      </div>
      <span className={`font-mono font-bold ${getTextColor(value)} ${size === 'sm' ? 'text-[9px]' : 'text-[10px]'}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Document Preview Panel ──────────────────────────────────────────────────

function DocumentPreview({ lines, status }: { lines: string[]; status: DocumentStatus }) {
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#08080c] overflow-hidden font-mono text-[10px] leading-relaxed">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500/60" />
          <div className="w-2 h-2 rounded-full bg-amber-500/60" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-[9px] text-zinc-600 ml-1">Document Preview</span>
        <div className="flex-1" />
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${statusConfig.bg} border ${statusConfig.border}`}>
          <div className={`w-1 h-1 rounded-full ${statusConfig.dot} ${status !== 'failed' ? 'animate-pulse' : ''}`} />
          <span className={`text-[8px] font-bold ${statusConfig.text} uppercase tracking-wider`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 max-h-[240px] overflow-y-auto custom-scrollbar">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 ${
              line.includes('[NEEDS REVIEW]') || line.includes('[HANDWRITTEN')
                ? 'text-amber-400/80 bg-amber-500/[0.04] -mx-1 px-1 rounded'
                : line.includes('[DELETED]')
                ? 'text-rose-400/60 line-through'
                : line.includes('[INSERTED]')
                ? 'text-emerald-400/80'
                : line.includes('⚠')
                ? 'text-rose-400/80'
                : line.startsWith('─')
                ? 'text-zinc-700'
                : 'text-zinc-400'
            }`}
          >
            <span className="text-zinc-700 select-none w-4 text-right flex-shrink-0">
              {i + 1}
            </span>
            <span className="whitespace-pre">{line || '\u00A0'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status, size = 'md' }: { status: DocumentStatus; size?: 'sm' | 'md' }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.border} ${
      size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
    }`}>
      <Icon className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${config.text}`} />
      <span className={`font-bold ${config.text} uppercase tracking-wider ${
        size === 'sm' ? 'text-[8px]' : 'text-[10px]'
      }`}>
        {config.label}
      </span>
    </div>
  );
}

// ─── Document Detail Drawer ──────────────────────────────────────────────────

function DocumentDetailDrawer({
  doc,
  onClose,
}: {
  doc: ProcessedDocument;
  onClose: () => void;
}) {
  const statusConfig = STATUS_CONFIG[doc.status];
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />

      {/* Drawer */}
      <motion.div
        ref={drawerRef}
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-screen w-full max-w-[680px] z-50 bg-[#0a0a10] border-l border-white/[0.08] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/[0.06] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${statusConfig.gradient} border ${statusConfig.border} flex items-center justify-center flex-shrink-0`}>
                <Icons.fileText className={`w-5 h-5 ${statusConfig.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-zinc-100 truncate tracking-[-0.01em]">
                  {doc.name}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={doc.status} />
                  <span className="text-[11px] text-zinc-600">•</span>
                  <span className="text-[11px] text-zinc-500 font-medium">{doc.type}</span>
                  <span className="text-[11px] text-zinc-600">•</span>
                  <span className="text-[11px] text-zinc-500 font-medium">{doc.size}</span>
                  <span className="text-[11px] text-zinc-600">•</span>
                  <span className="text-[11px] text-zinc-500 font-medium">{doc.pages} page{doc.pages > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all flex-shrink-0"
            >
              <Icons.x className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Confidence', value: `${doc.confidence.toFixed(1)}%`, icon: Icons.barChart, color: statusConfig.text },
              { label: 'Duration', value: doc.duration, icon: Icons.zap, color: 'text-indigo-400' },
              { label: 'Processed', value: doc.processedAt, icon: Icons.clock, color: 'text-zinc-400' },
              { label: 'Category', value: doc.category, icon: Icons.layers, color: 'text-violet-400' },
            ].map((meta, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <meta.icon className={`w-3 h-3 ${meta.color}`} />
                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.1em]">{meta.label}</span>
                </div>
                <span className="text-[13px] font-bold text-zinc-200">{meta.value}</span>
              </div>
            ))}
          </div>

          {/* Confidence Bar */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">Overall Confidence</span>
              <span className={`text-[11px] font-bold ${statusConfig.text}`}>{doc.confidence.toFixed(1)}%</span>
            </div>
            <ConfidenceBar value={doc.confidence} />
          </div>

          {/* Live Preview */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Icons.eye className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">Live Preview</span>
            </div>
            <DocumentPreview lines={doc.previewLines} status={doc.status} />
          </div>

          {/* Extracted Fields */}
          {doc.extractedFields.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Icons.layers className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">
                  Extracted Fields ({doc.extractedFields.length})
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                {doc.extractedFields.map((field, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      i !== doc.extractedFields.length - 1 ? 'border-b border-white/[0.04]' : ''
                    } hover:bg-white/[0.02] transition-colors`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.05em]">
                        {field.label}
                      </div>
                      <div className={`text-[13px] font-semibold mt-0.5 ${
                        field.value.includes('[') ? 'text-amber-400' : 'text-zinc-200'
                      }`}>
                        {field.value}
                      </div>
                    </div>
                    <div className="w-24 flex-shrink-0">
                      <ConfidenceBar value={field.confidence} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {doc.warnings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Icons.alertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-[0.1em]">
                  Warnings ({doc.warnings.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {doc.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/10"
                  >
                    <div className="w-4 h-4 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icons.alertTriangle className="w-2 h-2 text-amber-400" />
                    </div>
                    <span className="text-[12px] text-amber-300/80 font-medium leading-relaxed">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {doc.errors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Icons.xCircle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[10px] font-bold text-rose-500/80 uppercase tracking-[0.1em]">
                  Errors ({doc.errors.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {doc.errors.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-rose-500/[0.04] border border-rose-500/10"
                  >
                    <div className="w-4 h-4 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icons.xCircle className="w-2 h-2 text-rose-400" />
                    </div>
                    <span className="text-[12px] text-rose-300/80 font-medium leading-relaxed">{e}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processor Info */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <Icons.zap className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] text-zinc-500 font-medium">
              Processed by <span className="text-zinc-300 font-semibold">{doc.processedBy}</span>
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 border-t border-white/[0.06] p-4 flex items-center gap-2.5">
          {doc.status === 'review' && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 transition-all text-[12px] font-bold"
            >
              <Icons.eye className="w-3.5 h-3.5" />
              Mark as Reviewed
            </motion.button>
          )}
          {doc.status === 'failed' && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/15 transition-all text-[12px] font-bold"
            >
              <Icons.refresh className="w-3.5 h-3.5" />
              Reprocess Document
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={`${doc.status === 'success' ? 'flex-1' : ''} flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.06] transition-all text-[12px] font-bold`}
          >
            <Icons.download className="w-3.5 h-3.5" />
            Download
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Document Card (Grid View) ───────────────────────────────────────────────

function DocumentCard({
  doc,
  onSelect,
}: {
  doc: ProcessedDocument;
  onSelect: (doc: ProcessedDocument) => void;
}) {
  const statusConfig = STATUS_CONFIG[doc.status];

  return (
    <motion.div
      variants={staggerItem}
      layout
      whileHover={{ y: -2 }}
      onClick={() => onSelect(doc)}
      className="group cursor-pointer rounded-2xl border border-white/[0.06] bg-[#0e0e14] hover:border-white/[0.12] transition-all duration-300 overflow-hidden hover:shadow-xl hover:shadow-black/30 flex flex-col"
    >
      {/* Preview Area */}
      <div className="relative border-b border-white/[0.04]">
        {/* Status Indicator Strip */}
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${statusConfig.gradient}`} />

        <div className="p-3 pt-4">
          <div className="rounded-lg border border-white/[0.04] bg-[#08080c] overflow-hidden font-mono text-[8px] leading-[1.6] text-zinc-500 p-2.5 h-[120px] overflow-hidden relative">
            {doc.previewLines.slice(0, 10).map((line, i) => (
              <div key={i} className={`truncate ${
                line.includes('⚠') ? 'text-rose-400/60' :
                line.includes('[') ? 'text-amber-400/50' :
                line.startsWith('─') ? 'text-zinc-700' :
                ''
              }`}>
                {line || '\u00A0'}
              </div>
            ))}
            {/* Fade overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#08080c] to-transparent" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex-1 flex flex-col">
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${statusConfig.gradient} border ${statusConfig.border} flex items-center justify-center flex-shrink-0`}>
            <Icons.fileText className={`w-3.5 h-3.5 ${statusConfig.text}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-zinc-200 truncate group-hover:text-white transition-colors tracking-[-0.01em]">
              {doc.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-zinc-600 font-medium">{doc.type}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
              <span className="text-[10px] text-zinc-600 font-medium">{doc.size}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
              <span className="text-[10px] text-zinc-600 font-medium">{doc.pages}p</span>
            </div>
          </div>
        </div>

        {/* Confidence */}
        <div className="mb-2.5">
          <ConfidenceBar value={doc.confidence} size="sm" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-white/[0.04]">
          <StatusBadge status={doc.status} size="sm" />
          <div className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Icons.clock className="w-2.5 h-2.5" />
            <span className="font-medium">{doc.processedAt}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Document Row (List View) ────────────────────────────────────────────────

function DocumentRow({
  doc,
  onSelect,
}: {
  doc: ProcessedDocument;
  onSelect: (doc: ProcessedDocument) => void;
}) {
  const statusConfig = STATUS_CONFIG[doc.status];

  return (
    <motion.div
      variants={staggerItem}
      layout
      whileHover={{ x: 2 }}
      onClick={() => onSelect(doc)}
      className="group cursor-pointer flex items-center gap-4 px-4 py-3.5 rounded-xl border border-transparent hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-250"
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${statusConfig.gradient} border ${statusConfig.border} flex items-center justify-center flex-shrink-0`}>
        <Icons.fileText className={`w-4 h-4 ${statusConfig.text}`} />
      </div>

      {/* Name & meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-zinc-200 truncate group-hover:text-white transition-colors tracking-[-0.01em]">
          {doc.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-zinc-600 font-medium">{doc.category}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
          <span className="text-[10px] text-zinc-600 font-medium">{doc.type}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
          <span className="text-[10px] text-zinc-600 font-medium">{doc.size}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
          <span className="text-[10px] text-zinc-600 font-medium">{doc.pages} page{doc.pages > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Mini Preview (hidden on small screens) */}
      <div className="hidden lg:block w-[180px] flex-shrink-0">
        <div className="rounded-md border border-white/[0.04] bg-[#08080c] font-mono text-[7px] leading-[1.5] text-zinc-600 p-1.5 h-[42px] overflow-hidden relative">
          {doc.previewLines.slice(0, 3).map((line, i) => (
            <div key={i} className="truncate">{line || '\u00A0'}</div>
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-[#08080c] to-transparent" />
        </div>
      </div>

      {/* Confidence */}
      <div className="w-24 flex-shrink-0 hidden sm:block">
        <ConfidenceBar value={doc.confidence} size="sm" />
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={doc.status} size="sm" />
      </div>

      {/* Time */}
      <div className="hidden md:flex items-center gap-1 text-[10px] text-zinc-600 w-20 flex-shrink-0">
        <Icons.clock className="w-2.5 h-2.5" />
        <span className="font-medium truncate">{doc.processedAt}</span>
      </div>

      {/* Arrow */}
      <Icons.chevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
    </motion.div>
  );
}

// ─── Filter Button ───────────────────────────────────────────────────────────

function FilterButton({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-250 ${
        active
          ? `${color || 'bg-white/[0.06] border-white/[0.12] text-zinc-200'}`
          : 'bg-transparent border-transparent text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]'
      }`}
    >
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
        active ? 'bg-white/[0.08] text-zinc-300' : 'bg-white/[0.04] text-zinc-600'
      }`}>
        {count}
      </span>
    </motion.button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProcessedDocuments() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDoc, setSelectedDoc] = useState<ProcessedDocument | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'confidence' | 'name'>('recent');
  const searchRef = useRef<HTMLInputElement>(null);

  // Counts
  const counts = useMemo(() => ({
    all: MOCK_DOCUMENTS.length,
    success: MOCK_DOCUMENTS.filter(d => d.status === 'success').length,
    review: MOCK_DOCUMENTS.filter(d => d.status === 'review').length,
    failed: MOCK_DOCUMENTS.filter(d => d.status === 'failed').length,
  }), []);

  // Filtered + sorted documents
  const filteredDocs = useMemo(() => {
    let docs = [...MOCK_DOCUMENTS];

    // Status filter
    if (statusFilter !== 'all') {
      docs = docs.filter(d => d.status === statusFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'confidence':
        docs.sort((a, b) => b.confidence - a.confidence);
        break;
      case 'name':
        docs.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
      default:
        // Already in "recent" order from mock data
        break;
    }

    return docs;
  }, [statusFilter, searchQuery, sortBy]);

  const handleSelect = useCallback((doc: ProcessedDocument) => {
    setSelectedDoc(doc);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedDoc(null);
  }, []);

  // Stats for the top summary
  const avgConfidence = useMemo(() => {
    if (MOCK_DOCUMENTS.length === 0) return 0;
    return MOCK_DOCUMENTS.reduce((sum, d) => sum + d.confidence, 0) / MOCK_DOCUMENTS.length;
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 28 }}
      >
        <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Processed Documents</h2>
        <p className="text-[13px] text-zinc-500 mt-1 font-medium">
          Review processed documents, check status, and manage outputs.
        </p>
      </motion.div>

      {/* Stats Summary */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {[
          {
            label: 'Total Processed',
            value: counts.all.toString(),
            icon: Icons.layers,
            color: 'text-indigo-400',
            subtitle: 'All documents',
          },
          {
            label: 'Successful',
            value: counts.success.toString(),
            icon: Icons.checkCircle,
            color: 'text-emerald-400',
            subtitle: `${((counts.success / counts.all) * 100).toFixed(0)}% success rate`,
          },
          {
            label: 'Needs Review',
            value: counts.review.toString(),
            icon: Icons.alertTriangle,
            color: 'text-amber-400',
            subtitle: 'Action required',
          },
          {
            label: 'Avg Confidence',
            value: `${avgConfidence.toFixed(1)}%`,
            icon: Icons.barChart,
            color: avgConfidence >= 80 ? 'text-emerald-400' : 'text-amber-400',
            subtitle: 'Across all documents',
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            variants={staggerItem}
            className="p-4 rounded-2xl bg-[#0e0e14] border border-white/[0.06] hover:border-white/[0.1] transition-colors group"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center ${stat.color} group-hover:bg-white/[0.05] transition-colors`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.12em]">{stat.label}</span>
            </div>
            <div className="text-xl font-bold text-zinc-100 tracking-tight">{stat.value}</div>
            <div className="text-[10px] text-zinc-600 font-medium mt-0.5">{stat.subtitle}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
      >
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-[12px] text-zinc-200 outline-none focus:border-indigo-500/30 focus:ring-2 focus:ring-indigo-500/[0.08] transition-all placeholder:text-zinc-600 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Icons.x className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 flex-wrap">
          <FilterButton
            label="All"
            count={counts.all}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            color="bg-indigo-500/[0.08] border-indigo-500/20 text-indigo-400"
          />
          <FilterButton
            label="Processed"
            count={counts.success}
            active={statusFilter === 'success'}
            onClick={() => setStatusFilter('success')}
            color="bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400"
          />
          <FilterButton
            label="Review"
            count={counts.review}
            active={statusFilter === 'review'}
            onClick={() => setStatusFilter('review')}
            color="bg-amber-500/[0.08] border-amber-500/20 text-amber-400"
          />
          <FilterButton
            label="Failed"
            count={counts.failed}
            active={statusFilter === 'failed'}
            onClick={() => setStatusFilter('failed')}
            color="bg-rose-500/[0.08] border-rose-500/20 text-rose-400"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="appearance-none bg-white/[0.03] border border-white/[0.07] rounded-xl pl-3 pr-8 py-2 text-[11px] text-zinc-400 font-semibold outline-none focus:border-indigo-500/30 transition-all cursor-pointer"
            >
              <option value="recent">Recent</option>
              <option value="confidence">Confidence</option>
              <option value="name">Name</option>
            </select>
            <Icons.chevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
          </div>

          {/* View Toggle */}
          <div className="flex items-center rounded-xl border border-white/[0.07] overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-all ${
                viewMode === 'grid'
                  ? 'bg-white/[0.06] text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <Icons.grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-all ${
                viewMode === 'list'
                  ? 'bg-white/[0.06] text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <Icons.list className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Documents Grid / List */}
      <AnimatePresence mode="wait">
        {filteredDocs.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
              <Icons.search className="w-6 h-6 text-zinc-700" />
            </div>
            <h3 className="text-[14px] font-bold text-zinc-400 mb-1">No documents found</h3>
            <p className="text-[12px] text-zinc-600 font-medium max-w-xs">
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search term.`
                : 'No documents match the selected filter.'}
            </p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.06] transition-all text-[12px] font-semibold"
            >
              <Icons.refresh className="w-3 h-3" />
              Clear Filters
            </button>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            key="grid"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {filteredDocs.map(doc => (
              <DocumentCard key={doc.id} doc={doc} onSelect={handleSelect} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="rounded-2xl border border-white/[0.06] bg-[#0e0e14] overflow-hidden divide-y divide-white/[0.04]"
          >
            {/* List header */}
            <div className="flex items-center gap-4 px-4 py-2.5 bg-white/[0.02]">
              <div className="w-9 flex-shrink-0" />
              <div className="flex-1 text-[9px] font-bold text-zinc-600 uppercase tracking-[0.12em]">Document</div>
              <div className="hidden lg:block w-[180px] flex-shrink-0 text-[9px] font-bold text-zinc-600 uppercase tracking-[0.12em]">Preview</div>
              <div className="w-24 flex-shrink-0 hidden sm:block text-[9px] font-bold text-zinc-600 uppercase tracking-[0.12em]">Confidence</div>
              <div className="flex-shrink-0 text-[9px] font-bold text-zinc-600 uppercase tracking-[0.12em] w-24">Status</div>
              <div className="hidden md:block w-20 flex-shrink-0 text-[9px] font-bold text-zinc-600 uppercase tracking-[0.12em]">Time</div>
              <div className="w-3.5 flex-shrink-0" />
            </div>
            {filteredDocs.map(doc => (
              <DocumentRow key={doc.id} doc={doc} onSelect={handleSelect} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      {filteredDocs.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 text-[11px] text-zinc-600 font-medium"
        >
          <Icons.info className="w-3 h-3" />
          Showing {filteredDocs.length} of {counts.all} documents
        </motion.div>
      )}

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedDoc && (
          <DocumentDetailDrawer doc={selectedDoc} onClose={handleCloseDrawer} />
        )}
      </AnimatePresence>
    </div>
  );
}