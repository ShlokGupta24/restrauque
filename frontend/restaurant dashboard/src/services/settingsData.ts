export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'General Manager' | 'Kitchen Lead' | 'Head Cashier';
  branch: string;
  status: 'Active' | 'Invited';
}

export interface BranchSettings {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  gstNumber: string;
  isActive: boolean;
  tableCount: number;
}

export interface QrMenuSettings {
  brandPrimaryColor: string;
  welcomeHeading: string;
  tagline: string;
  showTableBadge: boolean;
  enableDirectOrder: boolean;
  enableDirectPay: boolean;
}

export interface IntegrationService {
  id: string;
  name: string;
  description: string;
  status: 'Connected' | 'Ready to connect' | 'Enterprise';
  category: 'Database' | 'Payment Gateway' | 'POS Hardware' | 'Thermal Print';
}

export const INITIAL_STAFF_MEMBERS: StaffMember[] = [
  {
    id: 'staff-01',
    name: 'Aarav Kapoor',
    email: 'owner@basilbrick.example',
    role: 'Owner',
    branch: 'Hazratganj & Gomti Nagar',
    status: 'Active',
  },
  {
    id: 'staff-02',
    name: 'Vikram Seth',
    email: 'vikram.gm@basilbrick.example',
    role: 'General Manager',
    branch: 'Hazratganj Primary',
    status: 'Active',
  },
  {
    id: 'staff-03',
    name: 'Chef Rajesh Sharma',
    email: 'kitchen.hz@basilbrick.example',
    role: 'Kitchen Lead',
    branch: 'Hazratganj Primary',
    status: 'Active',
  },
  {
    id: 'staff-04',
    name: 'Sneha Rastogi',
    email: 'sneha.cashier@basilbrick.example',
    role: 'Head Cashier',
    branch: 'Hazratganj Primary',
    status: 'Active',
  },
];

export const INITIAL_BRANCH_SETTINGS: BranchSettings[] = [
  {
    id: 'branch_hz_01',
    name: 'Hazratganj Primary Branch',
    address: 'Shop 14-16, Mayfair Building, M.G. Marg',
    city: 'Lucknow, Uttar Pradesh 226001',
    phone: '+91 98390 12345',
    gstNumber: '09AAECB1234F1Z8',
    isActive: true,
    tableCount: 12,
  },
  {
    id: 'branch_gm_02',
    name: 'Gomti Nagar Branch',
    address: 'Plot 42, Vibhuti Khand, Near Cyber Heights',
    city: 'Lucknow, Uttar Pradesh 226010',
    phone: '+91 98390 67890',
    gstNumber: '09AAECB1234F1Z8',
    isActive: true,
    tableCount: 8,
  },
];

export const INITIAL_QR_SETTINGS: QrMenuSettings = {
  brandPrimaryColor: '#E53935',
  welcomeHeading: 'Welcome to Basil & Brick',
  tagline: 'Artisanal Italian & Awadhi Fusion Flavors',
  showTableBadge: true,
  enableDirectOrder: true,
  enableDirectPay: true,
};

export const INITIAL_INTEGRATIONS: IntegrationService[] = [
  {
    id: 'neon-db',
    name: 'Neon PostgreSQL (resro_intelligence)',
    description: 'Serverless production branch database with auto-scaling compute.',
    status: 'Connected',
    category: 'Database',
  },
  {
    id: 'razorpay',
    name: 'Razorpay UPI & Smart Gateway',
    description: 'Instant UPI, Cards & Netbanking checkout with instant webhook confirmation.',
    status: 'Connected',
    category: 'Payment Gateway',
  },
  {
    id: 'kot-printer',
    name: 'Epson ESC/POS Kitchen Printer',
    description: 'Direct IP printing for kitchen order tickets upon customer order confirmation.',
    status: 'Ready to connect',
    category: 'Thermal Print',
  },
  {
    id: 'tally-pos',
    name: 'TallyPrime ERP Connector',
    description: 'End-of-day sales voucher sync and GST tax invoice generation.',
    status: 'Enterprise',
    category: 'POS Hardware',
  },
];
