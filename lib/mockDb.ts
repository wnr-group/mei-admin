// Type definitions for our data structures
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  workTypes: string[];
  status: 'PUBLISHED' | 'DRAFT';
  image?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  compareAtPrice?: number;
  featured?: boolean;
  newArrival?: boolean;
  images?: string[];
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}


export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  itemsCount: number;
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'PAID' | 'FAILED';
  date: string;
  customerPhone?: string;
  shippingAddress?: {
    name: string;
    line1: string;
    line2: string;
    cityStateZip: string;
  };
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  paymentMethod?: string;
  gatewayOrderId?: string;
}

export interface Category {
  id: string;
  name: string;
  subtitle: string;
  slug: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  image?: string;
  description?: string;
}

export interface Enquiry {
  id: string;
  customerName: string;
  customerContact: string;
  customerEmail?: string;
  customerPhone?: string;
  product: string;
  productPrice?: number;
  productImage?: string;
  type: 'QUOTE' | 'CUSTOM' | 'CONTACT';
  status: 'NEW' | 'CONTACTED' | 'QUOTED' | 'CONVERTED' | 'CLOSED';
  date: string;
  occasion?: string;
  budget?: string;
  message?: string;
  measurements?: {
    bust?: string;
    waist?: string;
    hip?: string;
    shoulder?: string;
    length?: string;
    sleeve?: string;
  };
  referenceImages?: string[];
  adminNotes?: string;
}

export interface StoreSettings {
  whatsappNumber: string;
  storeEmail: string;
  storePhone: string;
  streetAddress: string;
  city: string;
  state: string;
  pincode: string;
  instagramUrl: string;
}

export interface Banner {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  type: 'HERO' | 'PROMO' | 'CATEGORY_HEADER';
  status: 'ACTIVE' | 'INACTIVE';
  startDate?: string;
  endDate?: string;
  image?: string;
  link?: string;
  linkText?: string;
  sortOrder?: number;
}


// Initial mock dataset with real saree and lehenga image URLs from Unsplash
const INITIAL_PRODUCTS: Product[] = [
  { 
    id: 'prod-1', 
    name: 'The Noor Lehenga', 
    category: 'Bridal Lehengas', 
    price: 185000, 
    workTypes: ['ZARDOZI', 'AARI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-2', 
    name: 'Afsana Crimson Lehenga', 
    category: 'Bridal Lehengas', 
    price: 230000, 
    workTypes: ['ZARDOZI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-3', 
    name: 'Heritage Silk Saree', 
    category: 'Sarees', 
    price: 85000, 
    workTypes: ['HANDLOOM'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-4', 
    name: 'Zoya Velvet Gown', 
    category: 'Evening Gowns', 
    price: 110000, 
    workTypes: ['SEQUIN'], 
    status: 'DRAFT',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-5', 
    name: 'Custom Atelier Piece', 
    category: 'Couture', 
    price: 350000, 
    workTypes: ['BESPOKE'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-6', 
    name: 'Meera Anarkali', 
    category: 'Suits', 
    price: 45000, 
    workTypes: ['GOTA PATTI'], 
    status: 'DRAFT',
    image: 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop'
  },
  // Additional products with image URLs
  { 
    id: 'prod-7', 
    name: 'Gilded Ivory Lehenga', 
    category: 'Bridal Lehengas', 
    price: 275000, 
    workTypes: ['ZARDOZI', 'PEARLWORK'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-8', 
    name: 'Gulabi Silk Lehenga', 
    category: 'Bridal Lehengas', 
    price: 195000, 
    workTypes: ['AARI', 'EMBROIDERY'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-9', 
    name: 'Shabnam Organza Saree', 
    category: 'Sarees', 
    price: 65000, 
    workTypes: ['HANDLOOM', 'MUKAISH'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-10', 
    name: 'Fiza Chikankari Kurta', 
    category: 'Suits', 
    price: 55000, 
    workTypes: ['CHIKANKARI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-11', 
    name: 'Nilofer Velvet Anarkali', 
    category: 'Suits', 
    price: 95000, 
    workTypes: ['ZARDOZI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-12', 
    name: 'Aria Rose Gold Gown', 
    category: 'Evening Gowns', 
    price: 140000, 
    workTypes: ['SEQUIN', 'BESPOKE'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-13', 
    name: 'Mehrunissa Bridal Set', 
    category: 'Couture', 
    price: 450000, 
    workTypes: ['BESPOKE', 'ZARDOZI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-14', 
    name: 'Benares Heritage Saree', 
    category: 'Sarees', 
    price: 125000, 
    workTypes: ['HANDLOOM'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-15', 
    name: 'Aura Pastel Gown', 
    category: 'Evening Gowns', 
    price: 88000, 
    workTypes: ['AARI'], 
    status: 'DRAFT',
    image: 'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-16', 
    name: 'Zahra Silk Sharara', 
    category: 'Suits', 
    price: 75000, 
    workTypes: ['GOTA PATTI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-17', 
    name: 'Royal Kanjeevaram Saree', 
    category: 'Sarees', 
    price: 160000, 
    workTypes: ['HANDLOOM'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-18', 
    name: 'Pakeezah Peach Lehenga', 
    category: 'Bridal Lehengas', 
    price: 210000, 
    workTypes: ['ZARDOZI', 'CHIKANKARI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-19', 
    name: 'Sultana Emerald Gown', 
    category: 'Evening Gowns', 
    price: 175000, 
    workTypes: ['SEQUIN'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-20', 
    name: 'Zeenat Ivory Saree', 
    category: 'Sarees', 
    price: 98000, 
    workTypes: ['MUKAISH'], 
    status: 'DRAFT',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-21', 
    name: 'Rooh Banarasi Kurta', 
    category: 'Suits', 
    price: 42000, 
    workTypes: ['HANDLOOM'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-22', 
    name: 'Noor-ul-Ain Couture', 
    category: 'Couture', 
    price: 520000, 
    workTypes: ['BESPOKE', 'ZARDOZI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-23', 
    name: 'Tara Sequin Lehenga', 
    category: 'Bridal Lehengas', 
    price: 245000, 
    workTypes: ['SEQUIN', 'AARI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'prod-24', 
    name: 'Zara Silk Dupatta Suit', 
    category: 'Suits', 
    price: 38000, 
    workTypes: ['AARI'], 
    status: 'PUBLISHED',
    image: 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=150&auto=format&fit=crop'
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'MEI-20241012-0921',
    customerName: 'Anya Sharma',
    customerEmail: 'anya.sharma@example.com',
    customerPhone: '+91 98765 43210',
    itemsCount: 2,
    total: 345000,
    status: 'PENDING',
    paymentStatus: 'PAID',
    date: '12 Oct 2024',
    shippingAddress: {
      name: 'Anya Sharma',
      line1: '123 Heritage Lane',
      line2: 'Apt 4B',
      cityStateZip: 'New Delhi, Delhi — 110001'
    },
    items: [
      {
        name: 'The Noor Lehenga',
        quantity: 1,
        price: 185000,
        image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop'
      },
      {
        name: 'Heritage Kundan Set',
        quantity: 1,
        price: 160000,
        image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=150&auto=format&fit=crop'
      }
    ],
    paymentMethod: 'Razorpay',
    gatewayOrderId: 'pay_P1a2b3c4d5e6'
  },
  { id: 'MEI-20241011-0845', customerName: 'Priya Patel', customerEmail: 'priya.p@example.com', itemsCount: 1, total: 185000, status: 'CONFIRMED', paymentStatus: 'PAID', date: '11 Oct 2024' },
  { id: 'MEI-20241009-1102', customerName: 'Neha Gupta', customerEmail: 'neha.g@example.com', itemsCount: 3, total: 520000, status: 'PROCESSING', paymentStatus: 'PAID', date: '09 Oct 2024' },
  { id: 'MEI-20241005-0911', customerName: 'Meera Reddy', customerEmail: 'm.reddy@example.com', itemsCount: 1, total: 210000, status: 'SHIPPED', paymentStatus: 'PAID', date: '05 Oct 2024' },
  { id: 'MEI-20240928-1422', customerName: 'Rhea Kapoor', customerEmail: 'rhea.k@example.com', itemsCount: 2, total: 480000, status: 'DELIVERED', paymentStatus: 'PAID', date: '28 Sep 2024' },
  { id: 'MEI-20240925-1805', customerName: 'Ananya Singh', customerEmail: 'ananya.s@example.com', itemsCount: 1, total: 150000, status: 'CANCELLED', paymentStatus: 'FAILED', date: '25 Sep 2024' },
  { id: 'MEI-20241012-0910', customerName: 'Aarav Sharma', customerEmail: 'aarav.sharma@example.com', itemsCount: 1, total: 230000, status: 'PENDING', paymentStatus: 'PAID', date: '12 Oct 2024' },
  { id: 'MEI-20241012-0850', customerName: 'Aditya Verma', customerEmail: 'aditya.v@example.com', itemsCount: 3, total: 165000, status: 'PENDING', paymentStatus: 'FAILED', date: '12 Oct 2024' },
  { id: 'MEI-20241012-0740', customerName: 'Pooja Reddy', customerEmail: 'pooja.r@example.com', itemsCount: 1, total: 45000, status: 'PENDING', paymentStatus: 'PAID', date: '12 Oct 2024' },
  { id: 'MEI-20241012-0620', customerName: 'Sneha Roy', customerEmail: 'sneha.roy@example.com', itemsCount: 2, total: 275000, status: 'PENDING', paymentStatus: 'PAID', date: '12 Oct 2024' },
  { id: 'MEI-20241005-0810', customerName: 'Ishani Mehta', customerEmail: 'ishani.m@example.com', itemsCount: 2, total: 105000, status: 'SHIPPED', paymentStatus: 'PAID', date: '05 Oct 2024' },
  { id: 'MEI-20241005-0720', customerName: 'Ananya Pandey', customerEmail: 'ananya.p@example.com', itemsCount: 1, total: 110000, status: 'SHIPPED', paymentStatus: 'PAID', date: '05 Oct 2024' },
  { id: 'MEI-20241005-0610', customerName: 'Divya Nair', customerEmail: 'divya.n@example.com', itemsCount: 3, total: 195000, status: 'SHIPPED', paymentStatus: 'PAID', date: '05 Oct 2024' },
  { id: 'MEI-20241005-0500', customerName: 'Kabir Malhotra', customerEmail: 'kabir.m@example.com', itemsCount: 2, total: 350000, status: 'SHIPPED', paymentStatus: 'PAID', date: '05 Oct 2024' },
  { id: 'MEI-20241005-0420', customerName: 'Kiara Advani', customerEmail: 'kiara.a@example.com', itemsCount: 1, total: 95000, status: 'SHIPPED', paymentStatus: 'PAID', date: '05 Oct 2024' },
  { id: 'MEI-20241005-0310', customerName: 'Sid Malhotra', customerEmail: 'sid.m@example.com', itemsCount: 4, total: 450000, status: 'SHIPPED', paymentStatus: 'PAID', date: '05 Oct 2024' },
  { id: 'MEI-20241005-0200', customerName: 'Vicky Kaushal', customerEmail: 'vicky.k@example.com', itemsCount: 2, total: 125000, status: 'SHIPPED', paymentStatus: 'PAID', date: '05 Oct 2024' },
  { id: 'MEI-20241011-0710', customerName: 'Rohan Gupta', customerEmail: 'rohan.g@example.com', itemsCount: 2, total: 310000, status: 'CONFIRMED', paymentStatus: 'PAID', date: '11 Oct 2024' },
  { id: 'MEI-20241009-1010', customerName: 'Meera Kapoor', customerEmail: 'meera.k@example.com', itemsCount: 1, total: 210000, status: 'PROCESSING', paymentStatus: 'PAID', date: '09 Oct 2024' },
  { id: 'MEI-20240928-1310', customerName: 'Aarav Sharma', customerEmail: 'aarav.sharma@example.com', itemsCount: 2, total: 230000, status: 'DELIVERED', paymentStatus: 'PAID', date: '28 Sep 2024' },
  { id: 'MEI-20240928-1210', customerName: 'Kriti Sen', customerEmail: 'kriti.s@example.com', itemsCount: 1, total: 85000, status: 'DELIVERED', paymentStatus: 'PAID', date: '28 Sep 2024' },
  { id: 'MEI-20240928-1110', customerName: 'Riya Singhal', customerEmail: 'riya.s@example.com', itemsCount: 1, total: 185000, status: 'DELIVERED', paymentStatus: 'PAID', date: '28 Sep 2024' },
  { id: 'MEI-20240928-1010', customerName: 'Nisha Malhotra', customerEmail: 'nisha.m@example.com', itemsCount: 3, total: 350000, status: 'DELIVERED', paymentStatus: 'PAID', date: '28 Sep 2024' },
  { id: 'MEI-20240925-1710', customerName: 'Aditya Roy', customerEmail: 'aditya.r@example.com', itemsCount: 2, total: 275000, status: 'CANCELLED', paymentStatus: 'FAILED', date: '25 Sep 2024' }
];

const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat-1',
    name: 'Bridal Jewellery',
    subtitle: 'Heritage Adornments',
    slug: 'bridal-jewellery',
    sortOrder: 1,
    status: 'ACTIVE',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: 'cat-2',
    name: 'Designer Wear',
    subtitle: 'Modern Silhouettes',
    slug: 'designer-wear',
    sortOrder: 2,
    status: 'ACTIVE',
    image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: 'cat-3',
    name: 'Customized Costumes',
    subtitle: 'Bespoke Tailoring',
    slug: 'customized-costumes',
    sortOrder: 3,
    status: 'ACTIVE',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=150&auto=format&fit=crop'
  }
];

const PRODUCTS_KEY = 'mei_products_db';
const ORDERS_KEY = 'mei_orders_db_v4';
const CATEGORIES_KEY = 'mei_categories_db';

// Helper to get raw data from local storage
function getRawProducts(): Product[] {
  if (typeof window === 'undefined') return INITIAL_PRODUCTS;
  const data = localStorage.getItem(PRODUCTS_KEY);
  if (!data) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  }
  try {
    return JSON.parse(data);
  } catch {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  }
}

// Helper to save raw data to local storage
function saveRawProducts(products: Product[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

// ----------------------------------------------------
// DATABASE API METHODS (Easily replaceable with database later)
// ----------------------------------------------------

/**
 * Fetch all products from the database
 */
export async function fetchProducts(): Promise<Product[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getRawProducts();
}

/**
 * Add a new product to the database
 */
export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const products = getRawProducts();
  const newProduct: Product = {
    ...product,
    id: `prod-${Date.now()}`
  };
  products.unshift(newProduct);
  saveRawProducts(products);
  return newProduct;
}

/**
 * Update an existing product in the database
 */
export async function updateProduct(updatedProduct: Product): Promise<Product> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const products = getRawProducts();
  const index = products.findIndex((p) => p.id === updatedProduct.id);
  if (index !== -1) {
    products[index] = updatedProduct;
    saveRawProducts(products);
  }
  return updatedProduct;
}

/**
 * Delete a product from the database
 */
export async function deleteProduct(id: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const products = getRawProducts();
  const filtered = products.filter((p) => p.id !== id);
  saveRawProducts(filtered);
  return true;
}

function getRawOrders(): Order[] {
  if (typeof window === 'undefined') return INITIAL_ORDERS;
  const data = localStorage.getItem(ORDERS_KEY);
  if (!data) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(INITIAL_ORDERS));
    return INITIAL_ORDERS;
  }
  try {
    return JSON.parse(data);
  } catch {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(INITIAL_ORDERS));
    return INITIAL_ORDERS;
  }
}

function saveRawOrders(orders: Order[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

/**
 * Fetch all orders from the database
 */
export async function fetchOrders(): Promise<Order[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getRawOrders();
}

/**
 * Fetch an order by ID
 */
export async function fetchOrderById(id: string): Promise<Order | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const orders = getRawOrders();
  return orders.find((o) => o.id === id);
}

/**
 * Update an order's status
 */
export async function updateOrderStatus(id: string, status: Order['status']): Promise<Order | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const orders = getRawOrders();
  const index = orders.findIndex((o) => o.id === id);
  if (index !== -1) {
    orders[index].status = status;
    saveRawOrders(orders);
    return orders[index];
  }
  return undefined;
}

function getRawCategories(): Category[] {
  if (typeof window === 'undefined') return INITIAL_CATEGORIES;
  const data = localStorage.getItem(CATEGORIES_KEY);
  if (!data) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(INITIAL_CATEGORIES));
    return INITIAL_CATEGORIES;
  }
  try {
    return JSON.parse(data);
  } catch {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(INITIAL_CATEGORIES));
    return INITIAL_CATEGORIES;
  }
}

function saveRawCategories(categories: Category[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

/**
 * Fetch all categories from the database
 */
export async function fetchCategories(): Promise<Category[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getRawCategories();
}

/**
 * Add a new category to the database
 */
export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const categories = getRawCategories();
  const newCategory: Category = {
    ...category,
    id: `cat-${Date.now()}`
  };
  categories.push(newCategory);
  saveRawCategories(categories);
  return newCategory;
}

const ENQUIRIES_KEY = 'mei_enquiries_db_v2';

const INITIAL_ENQUIRIES: Enquiry[] = [
  {
    id: 'ENQ-20260526-0007',
    customerName: 'Aisha Sharma',
    customerContact: '+44 7700 900077',
    customerEmail: 'aisha.sharma@example.com',
    customerPhone: '+91 98765 43210',
    product: 'The Noor Lehenga',
    productPrice: 185000,
    productImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop',
    type: 'QUOTE',
    status: 'NEW',
    date: '26 May 2026',
    occasion: 'Bridal',
    budget: '₹1L - ₹2L',
    message: 'I am looking for a custom version of the Noor Lehenga for my wedding in December. I would like to add more heavy embroidery on the trail and possibly change the dupatta color to a deep maroon.',
    measurements: {
      bust: '36"',
      waist: '28"',
      hip: '38"',
      shoulder: '14"',
      length: '44"',
      sleeve: '22"'
    },
    referenceImages: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop'
    ],
    adminNotes: ''
  },
  { id: 'ENQ-20260526-0006', customerName: 'Priya Patel', customerContact: '+1 202 555 0184', product: '—', type: 'CUSTOM', status: 'NEW', date: 'Today, 08:15' },
  { id: 'ENQ-20260525-0005', customerName: 'Meera Kapoor', customerContact: 'meera.k@email.com', product: 'Zahra Bridal Set', type: 'CONTACT', status: 'CONTACTED', date: 'Yesterday' },
  { id: 'ENQ-20260524-0004', customerName: 'Zara Ahmed', customerContact: '+971 50 123 4567', product: 'The Gulab Anarkali', type: 'QUOTE', status: 'QUOTED', date: 'May 24' },
  { id: 'ENQ-20260522-0003', customerName: 'Ananya Singh', customerContact: 'ananya.s@email.com', product: '—', type: 'CUSTOM', status: 'CONVERTED', date: 'May 22' },
  { id: 'ENQ-20260520-0002', customerName: 'Neha Desai', customerContact: '+44 7890 123456', product: 'Sitara Gown', type: 'QUOTE', status: 'CONTACTED', date: 'May 20' },
  { id: 'ENQ-20260519-0001', customerName: 'Ishani Mehta', customerContact: 'ishani.m@example.com', product: 'Heritage Silk Saree', type: 'QUOTE', status: 'QUOTED', date: 'May 19' },
  { id: 'ENQ-20260518-0008', customerName: 'Aditya Verma', customerContact: '+91 98234 56789', product: '—', type: 'CUSTOM', status: 'CONTACTED', date: 'May 18' },
  { id: 'ENQ-20260517-0009', customerName: 'Rohan Gupta', customerContact: 'rohan.g@example.com', product: 'Gilded Ivory Lehenga', type: 'QUOTE', status: 'CONVERTED', date: 'May 17' },
  { id: 'ENQ-20260516-0010', customerName: 'Sneha Roy', customerContact: '+91 78901 23456', product: '—', type: 'CONTACT', status: 'CLOSED', date: 'May 16' },
  { id: 'ENQ-20260515-0011', customerName: 'Kriti Sen', customerContact: 'kriti.s@example.com', product: 'Shabnam Organza Saree', type: 'QUOTE', status: 'QUOTED', date: 'May 15' },
  { id: 'ENQ-20260514-0012', customerName: 'Divya Nair', customerContact: '+91 90123 45678', product: 'Mehrunissa Bridal Set', type: 'CUSTOM', status: 'CONTACTED', date: 'May 14' },
  { id: 'ENQ-20260513-0013', customerName: 'Kabir Malhotra', customerContact: 'kabir.m@example.com', product: '—', type: 'CONTACT', status: 'CLOSED', date: 'May 13' },
  { id: 'ENQ-20260512-0014', customerName: 'Kiara Advani', customerContact: '+91 89012 34567', product: 'Zoya Velvet Gown', type: 'QUOTE', status: 'CONVERTED', date: 'May 12' },
  { id: 'ENQ-20260511-0015', customerName: 'Sid Malhotra', customerContact: 'sid.m@example.com', product: '—', type: 'CUSTOM', status: 'QUOTED', date: 'May 11' },
  { id: 'ENQ-20260510-0016', customerName: 'Vicky Kaushal', customerContact: '+91 78901 23456', product: 'Benares Heritage Saree', type: 'QUOTE', status: 'CONTACTED', date: 'May 10' },
  { id: 'ENQ-20260509-0017', customerName: 'Rhea Kapoor', customerContact: 'rhea.k@example.com', product: '—', type: 'CONTACT', status: 'CLOSED', date: 'May 09' },
  { id: 'ENQ-20260508-0018', customerName: 'Ananya Pandey', customerContact: '+91 90123 45678', product: 'Heritage Kundan Set', type: 'QUOTE', status: 'CONVERTED', date: 'May 08' },
  { id: 'ENQ-20260507-0019', customerName: 'Aarav Sharma', customerContact: 'aarav.sharma@example.com', product: '—', type: 'CUSTOM', status: 'QUOTED', date: 'May 07' },
  { id: 'ENQ-20260506-0020', customerName: 'Pooja Reddy', customerContact: '+91 89012 34567', product: 'Sitara Gown', type: 'QUOTE', status: 'CONTACTED', date: 'May 06' },
  { id: 'ENQ-20260505-0021', customerName: 'Alia Bhatt', customerContact: 'alia.b@example.com', product: 'Zara Silk Dupatta Suit', type: 'QUOTE', status: 'CONVERTED', date: 'May 05' },
  { id: 'ENQ-20260504-0022', customerName: 'Ranbir Kapoor', customerContact: '+91 98765 43210', product: '—', type: 'CUSTOM', status: 'CONTACTED', date: 'May 04' },
  { id: 'ENQ-20260503-0023', customerName: 'Deepika Padukone', customerContact: 'deepika.p@example.com', product: 'The Noor Lehenga', type: 'QUOTE', status: 'QUOTED', date: 'May 03' },
  { id: 'ENQ-20260502-0024', customerName: 'Ranveer Singh', customerContact: '+91 90123 45678', product: '—', type: 'CONTACT', status: 'CLOSED', date: 'May 02' },
  { id: 'ENQ-20260501-0025', customerName: 'Priyanka Chopra', customerContact: 'priyanka.c@example.com', product: 'Heritage Kundan Set', type: 'QUOTE', status: 'CONVERTED', date: 'May 01' },
  { id: 'ENQ-20260430-0026', customerName: 'Nick Jonas', customerContact: '+1 202 555 0199', product: '—', type: 'CUSTOM', status: 'QUOTED', date: 'Apr 30' },
  { id: 'ENQ-20260429-0027', customerName: 'Katrina Kaif', customerContact: 'katrina.k@example.com', product: 'Zahra Bridal Set', type: 'QUOTE', status: 'CONTACTED', date: 'Apr 29' },
  { id: 'ENQ-20260428-0028', customerName: 'Vicky Kaushal', customerContact: '+91 89012 34567', product: '—', type: 'CONTACT', status: 'CLOSED', date: 'Apr 28' },
  { id: 'ENQ-20260427-0029', customerName: 'Kareena Kapoor', customerContact: 'kareena.k@example.com', product: 'Sitara Gown', type: 'QUOTE', status: 'CONVERTED', date: 'Apr 27' },
  { id: 'ENQ-20260426-0030', customerName: 'Saif Ali Khan', customerContact: '+91 78901 23456', product: '—', type: 'CUSTOM', status: 'QUOTED', date: 'Apr 26' },
  { id: 'ENQ-20260425-0031', customerName: 'Sara Ali Khan', customerContact: 'sara.k@example.com', product: 'The Gulab Anarkali', type: 'QUOTE', status: 'CONTACTED', date: 'Apr 25' },
  { id: 'ENQ-20260424-0032', customerName: 'Janhvi Kapoor', customerContact: '+91 90123 45678', product: '—', type: 'CONTACT', status: 'CLOSED', date: 'Apr 24' },
  { id: 'ENQ-20260423-0033', customerName: 'Ananya Panday', customerContact: 'ananya.p@example.com', product: 'Zara Silk Dupatta Suit', type: 'QUOTE', status: 'CONVERTED', date: 'Apr 23' },
  { id: 'ENQ-20260422-0034', customerName: 'Aryan Khan', customerContact: '+91 89012 34567', product: '—', type: 'CUSTOM', status: 'QUOTED', date: 'Apr 22' },
  { id: 'ENQ-20260421-0035', customerName: 'Suhana Khan', customerContact: 'suhana.k@example.com', product: 'The Noor Lehenga', type: 'QUOTE', status: 'CONTACTED', date: 'Apr 21' },
  { id: 'ENQ-20260420-0036', customerName: 'Abram Khan', customerContact: '+91 78901 23456', product: '—', type: 'CONTACT', status: 'CLOSED', date: 'Apr 20' },
  { id: 'ENQ-20260419-0037', customerName: 'Gauri Khan', customerContact: 'gauri.k@example.com', product: 'Heritage Kundan Set', type: 'QUOTE', status: 'CONVERTED', date: 'Apr 19' },
  { id: 'ENQ-20260418-0038', customerName: 'Mira Rajput', customerContact: '+91 90123 45678', product: '—', type: 'CUSTOM', status: 'QUOTED', date: 'Apr 18' },
  { id: 'ENQ-20260417-0039', customerName: 'Shahid Kapoor', customerContact: 'shahid.k@example.com', product: 'Sitara Gown', type: 'QUOTE', status: 'CONTACTED', date: 'Apr 17' },
  { id: 'ENQ-20260416-0040', customerName: 'Ishaan Khatter', customerContact: '+91 89012 34567', product: '—', type: 'CONTACT', status: 'CLOSED', date: 'Apr 16' },
  { id: 'ENQ-20260415-0041', customerName: 'Sobhita Dhulipala', customerContact: 'sobhita.d@example.com', product: 'Mehrunissa Bridal Set', type: 'QUOTE', status: 'CONVERTED', date: 'Apr 15' },
  { id: 'ENQ-20260414-0042', customerName: 'Naga Chaitanya', customerContact: '+91 78901 23456', product: '—', type: 'CUSTOM', status: 'QUOTED', date: 'Apr 14' }
];

function getRawEnquiries(): Enquiry[] {
  if (typeof window === 'undefined') return INITIAL_ENQUIRIES;
  const data = localStorage.getItem(ENQUIRIES_KEY);
  if (!data) {
    localStorage.setItem(ENQUIRIES_KEY, JSON.stringify(INITIAL_ENQUIRIES));
    return INITIAL_ENQUIRIES;
  }
  try {
    return JSON.parse(data);
  } catch {
    localStorage.setItem(ENQUIRIES_KEY, JSON.stringify(INITIAL_ENQUIRIES));
    return INITIAL_ENQUIRIES;
  }
}

function saveRawEnquiries(enquiries: Enquiry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENQUIRIES_KEY, JSON.stringify(enquiries));
}

/**
 * Fetch enquiries from the database
 */
export async function fetchEnquiries(): Promise<Enquiry[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getRawEnquiries();
}

/**
 * Fetch an enquiry by ID
 */
export async function fetchEnquiryById(id: string): Promise<Enquiry | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const enquiries = getRawEnquiries();
  return enquiries.find((e) => e.id === id);
}

/**
 * Update an enquiry's status
 */
export async function updateEnquiryStatus(id: string, status: Enquiry['status']): Promise<Enquiry | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const enquiries = getRawEnquiries();
  const index = enquiries.findIndex((e) => e.id === id);
  if (index !== -1) {
    enquiries[index].status = status;
    saveRawEnquiries(enquiries);
    return enquiries[index];
  }
  return undefined;
}

/**
 * Update an enquiry's admin notes
 */
export async function updateEnquiryAdminNotes(id: string, notes: string): Promise<Enquiry | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const enquiries = getRawEnquiries();
  const index = enquiries.findIndex((e) => e.id === id);
  if (index !== -1) {
    enquiries[index].adminNotes = notes;
    saveRawEnquiries(enquiries);
    return enquiries[index];
  }
  return undefined;
}

const SETTINGS_KEY = 'mei_settings_db_v1';

const INITIAL_SETTINGS: StoreSettings = {
  whatsappNumber: '919876543210',
  storeEmail: 'info@navarachna.in',
  storePhone: '+91 9876543210',
  streetAddress: '123, Heritage Lane, DLF Phase 3',
  city: 'Gurugram',
  state: 'Haryana',
  pincode: '122002',
  instagramUrl: 'https://instagram.com/meicouture'
};

function getRawSettings(): StoreSettings {
  if (typeof window === 'undefined') return INITIAL_SETTINGS;
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
    return INITIAL_SETTINGS;
  }
  try {
    return JSON.parse(data);
  } catch {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
    return INITIAL_SETTINGS;
  }
}

function saveRawSettings(settings: StoreSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function fetchSettings(): Promise<StoreSettings> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getRawSettings();
}

export async function saveSettings(settings: StoreSettings): Promise<StoreSettings> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  saveRawSettings(settings);
  return settings;
}

// Banners Mock Database Implementation
const BANNERS_KEY = 'mei_banners_db';

const INITIAL_BANNERS: Banner[] = [
  {
    id: 'banner-1',
    name: 'Summer Bridal Collection Banner',
    title: 'SUMMER COUTURE COLLECTION 2024',
    subtitle: 'Discover the new elegance',
    type: 'HERO',
    status: 'ACTIVE',
    startDate: '2024-05-01T09:00',
    endDate: '2024-08-30T18:00',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=600&auto=format&fit=crop',
    link: '/categories/designer-wear',
    linkText: 'Explore Collection',
    sortOrder: 1
  },
  {
    id: 'banner-2',
    name: 'Heritage Craftsmanship Banner',
    title: 'THE ART OF ZARDOSI FOCUS',
    subtitle: 'The Art of Zardosi details',
    type: 'PROMO',
    status: 'INACTIVE',
    startDate: '2024-09-15T09:00',
    endDate: '2024-11-30T18:00',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600&auto=format&fit=crop',
    link: '/products?work=ZARDOZI',
    linkText: 'View Collection',
    sortOrder: 2
  },
  {
    id: 'banner-3',
    name: 'White Bridal Lehenga Promotion',
    title: 'MINIMALIST BRIDAL EDIT',
    subtitle: 'Minimalist styles for modern brides',
    type: 'CATEGORY_HEADER',
    status: 'ACTIVE',
    startDate: '',
    endDate: '',
    image: 'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=600&auto=format&fit=crop',
    link: '/categories/customized-costumes',
    linkText: 'Explore',
    sortOrder: 3
  }
];

function getRawBanners(): Banner[] {
  if (typeof window === 'undefined') return INITIAL_BANNERS;
  const data = localStorage.getItem(BANNERS_KEY);
  if (!data) {
    localStorage.setItem(BANNERS_KEY, JSON.stringify(INITIAL_BANNERS));
    return INITIAL_BANNERS;
  }
  try {
    return JSON.parse(data);
  } catch {
    localStorage.setItem(BANNERS_KEY, JSON.stringify(INITIAL_BANNERS));
    return INITIAL_BANNERS;
  }
}

function saveRawBanners(banners: Banner[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BANNERS_KEY, JSON.stringify(banners));
}

export async function fetchBanners(): Promise<Banner[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getRawBanners();
}

export async function addBanner(banner: Omit<Banner, 'id'>): Promise<Banner> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const banners = getRawBanners();
  const newBanner: Banner = {
    ...banner,
    id: `banner-${Date.now()}`
  };
  banners.push(newBanner);
  saveRawBanners(banners);
  return newBanner;
}

export async function updateBanner(updatedBanner: Banner): Promise<Banner> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const banners = getRawBanners();
  const index = banners.findIndex((b) => b.id === updatedBanner.id);
  if (index !== -1) {
    banners[index] = updatedBanner;
    saveRawBanners(banners);
  }
  return updatedBanner;
}

export async function deleteBanner(id: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const banners = getRawBanners();
  const filtered = banners.filter((b) => b.id !== id);
  saveRawBanners(filtered);
  return true;
}


