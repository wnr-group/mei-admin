// Type definitions for our data structures
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  workTypes: string[];
  status: 'PUBLISHED' | 'DRAFT';
  image?: string;
}

export interface Order {
  id: string;
  customerName: string;
  total: number;
  status: 'DELIVERED' | 'SHIPPED' | 'CONFIRMED' | 'PROCESSING' | 'PENDING';
  date: string;
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
  { id: '#ORD-9021', customerName: 'Aarav Sharma', total: 230000, status: 'DELIVERED', date: 'Oct 12, 2024' },
  { id: '#ORD-9020', customerName: 'Ishani Mehta', total: 105000, status: 'SHIPPED', date: 'Oct 11, 2024' },
  { id: '#ORD-9019', customerName: 'Rohan Gupta', total: 310000, status: 'CONFIRMED', date: 'Oct 10, 2024' },
  { id: '#ORD-9018', customerName: 'Meera Kapoor', total: 210000, status: 'PROCESSING', date: 'Oct 09, 2024' },
  { id: '#ORD-9017', customerName: 'Aditya Verma', total: 165000, status: 'PENDING', date: 'Oct 08, 2024' },
  { id: '#ORD-9016', customerName: 'Kriti Sen', total: 85000, status: 'DELIVERED', date: 'Oct 07, 2024' },
  { id: '#ORD-9015', customerName: 'Riya Singhal', total: 185000, status: 'DELIVERED', date: 'Oct 06, 2024' },
  { id: '#ORD-9014', customerName: 'Nisha Malhotra', total: 350000, status: 'CONFIRMED', date: 'Oct 05, 2024' },
  { id: '#ORD-9013', customerName: 'Pooja Reddy', total: 45000, status: 'PROCESSING', date: 'Oct 04, 2024' },
  { id: '#ORD-9012', customerName: 'Ananya Pandey', total: 110000, status: 'SHIPPED', date: 'Oct 03, 2024' },
  { id: '#ORD-9011', customerName: 'Divya Nair', total: 195000, status: 'DELIVERED', date: 'Oct 02, 2024' },
  { id: '#ORD-9010', customerName: 'Sneha Roy', total: 275000, status: 'PENDING', date: 'Oct 01, 2024' },
];

const PRODUCTS_KEY = 'mei_products_db';
const ORDERS_KEY = 'mei_orders_db';

// Helper to get raw data from local storage
function getRawProducts(): Product[] {
  if (typeof window === 'undefined') return INITIAL_PRODUCTS;
  const data = localStorage.getItem(PRODUCTS_KEY);
  if (!data) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  }
  return JSON.parse(data);
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

/**
 * Fetch all orders from the database
 */
export async function fetchOrders(): Promise<Order[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (typeof window === 'undefined') return INITIAL_ORDERS;
  const data = localStorage.getItem(ORDERS_KEY);
  if (!data) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(INITIAL_ORDERS));
    return INITIAL_ORDERS;
  }
  return JSON.parse(data);
}
