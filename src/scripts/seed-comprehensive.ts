import * as bcrypt from 'bcrypt';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// User roles
enum UserRole {
  GUEST = 'guest',
  BUYER = 'buyer',
  SELLER = 'seller',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// Comprehensive test users with full profiles
const testUsers = [
  // Buyers
  {
    email: 'buyer1@test.com',
    phone: '+995555111111',
    password: 'password123',
    firstName: 'ნინო',
    lastName: 'მელაძე',
    role: UserRole.BUYER,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
  },
  {
    email: 'buyer2@test.com',
    phone: '+995555222222',
    password: 'password123',
    firstName: 'გიორგი',
    lastName: 'გიგაური',
    role: UserRole.BUYER,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
  },
  {
    email: 'buyer3@test.com',
    phone: '+995555333333',
    password: 'password123',
    firstName: 'მარიამ',
    lastName: 'ჩხაიძე',
    role: UserRole.BUYER,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
  },
  // Sellers with full profiles
  {
    email: 'seller1@test.com',
    phone: '+995555444444',
    password: 'password123',
    firstName: 'ანა',
    lastName: 'კვარაცხელია',
    role: UserRole.SELLER,
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop',
    shopName: 'ანას ხელნაკეთი ნაწარმი',
    shopDescription: 'ხელნაკეთი სამკაულები და ხელოვნების ნივთები',
    address: 'თბილისი, რუსთაველის გამზირი 15',
    latitude: 41.7151,
    longitude: 44.8271,
    coverPhoto: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&h=400&fit=crop',
    workingHours: {
      monday: { open: '09:00', close: '18:00', isOpen: true },
      tuesday: { open: '09:00', close: '18:00', isOpen: true },
      wednesday: { open: '09:00', close: '18:00', isOpen: true },
      thursday: { open: '09:00', close: '18:00', isOpen: true },
      friday: { open: '09:00', close: '18:00', isOpen: true },
      saturday: { open: '10:00', close: '16:00', isOpen: true },
      sunday: { open: null, close: null, isOpen: false },
    },
  },
  {
    email: 'seller2@test.com',
    phone: '+995555555555',
    password: 'password123',
    firstName: 'დავით',
    lastName: 'მამედოვი',
    role: UserRole.SELLER,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    shopName: 'დავითის ხელნაკეთი ტანსაცმელი',
    shopDescription: 'ხელნაკეთი ტანსაცმელი და აქსესუარები',
    address: 'თბილისი, აღმაშენებლის გამზირი 42',
    latitude: 41.6934,
    longitude: 44.8015,
    coverPhoto: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop',
    workingHours: {
      monday: { open: '10:00', close: '19:00', isOpen: true },
      tuesday: { open: '10:00', close: '19:00', isOpen: true },
      wednesday: { open: '10:00', close: '19:00', isOpen: true },
      thursday: { open: '10:00', close: '19:00', isOpen: true },
      friday: { open: '10:00', close: '19:00', isOpen: true },
      saturday: { open: '11:00', close: '17:00', isOpen: true },
      sunday: { open: null, close: null, isOpen: false },
    },
  },
  {
    email: 'seller3@test.com',
    phone: '+995555666666',
    password: 'password123',
    firstName: 'თამარ',
    lastName: 'ბერიძე',
    role: UserRole.SELLER,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
    shopName: 'თამარის ხელნაკეთი სახლის დეკორი',
    shopDescription: 'ხელნაკეთი სახლის დეკორაცია და ხელოვნების ნივთები',
    address: 'თბილისი, ვაკე, ვაზისუბნის ქუჩა 8',
    latitude: 41.7108,
    longitude: 44.7480,
    coverPhoto: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&h=400&fit=crop',
    workingHours: {
      monday: { open: '09:00', close: '17:00', isOpen: true },
      tuesday: { open: '09:00', close: '17:00', isOpen: true },
      wednesday: { open: '09:00', close: '17:00', isOpen: true },
      thursday: { open: '09:00', close: '17:00', isOpen: true },
      friday: { open: '09:00', close: '17:00', isOpen: true },
      saturday: { open: '10:00', close: '15:00', isOpen: true },
      sunday: { open: null, close: null, isOpen: false },
    },
  },
  {
    email: 'seller4@test.com',
    phone: '+995555777777',
    password: 'password123',
    firstName: 'ლუკა',
    lastName: 'ჯაფარიძე',
    role: UserRole.SELLER,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
    shopName: 'ლუკას ხელნაკეთი ხის ნაწარმი',
    shopDescription: 'ხელნაკეთი ხის ნაწარმი და ხელოვნების ნივთები',
    address: 'თბილისი, ნუცუბიძის ქუჩა 25',
    latitude: 41.6975,
    longitude: 44.7994,
    coverPhoto: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1200&h=400&fit=crop',
    workingHours: {
      monday: { open: '08:00', close: '18:00', isOpen: true },
      tuesday: { open: '08:00', close: '18:00', isOpen: true },
      wednesday: { open: '08:00', close: '18:00', isOpen: true },
      thursday: { open: '08:00', close: '18:00', isOpen: true },
      friday: { open: '08:00', close: '18:00', isOpen: true },
      saturday: { open: '09:00', close: '16:00', isOpen: true },
      sunday: { open: null, close: null, isOpen: false },
    },
  },
  {
    email: 'seller5@test.com',
    phone: '+995555888888',
    password: 'password123',
    firstName: 'სოფიო',
    lastName: 'გოგიბერიძე',
    role: UserRole.SELLER,
    avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop',
    shopName: 'სოფიოს ხელნაკეთი ქსოვილი',
    shopDescription: 'ხელნაკეთი ქსოვილი და ტექსტილი',
    address: 'თბილისი, ქავთარაძის ქუჩა 12',
    latitude: 41.7025,
    longitude: 44.7908,
    coverPhoto: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&h=400&fit=crop',
    workingHours: {
      monday: { open: '10:00', close: '18:00', isOpen: true },
      tuesday: { open: '10:00', close: '18:00', isOpen: true },
      wednesday: { open: '10:00', close: '18:00', isOpen: true },
      thursday: { open: '10:00', close: '18:00', isOpen: true },
      friday: { open: '10:00', close: '18:00', isOpen: true },
      saturday: { open: '11:00', close: '16:00', isOpen: true },
      sunday: { open: null, close: null, isOpen: false },
    },
  },
  // Admin
  {
    email: 'admin@test.com',
    phone: '+995555000000',
    password: 'admin123',
    firstName: 'ადმინ',
    lastName: 'ადმინი',
    role: UserRole.ADMIN,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
  },
];

// Product categories (EN + KA) — minimalist images, matches seed-categories.ts
const categories = [
  { name: 'აქსესუარები', nameEn: 'Accessories', description: 'აქსესუარები', descriptionEn: 'Accessories', icon: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=600&fit=crop' },
  { name: 'ხელოვნება და კოლექციური ნივთები', nameEn: 'Art & Collectibles', description: 'ხელოვნება და კოლექციური ნივთები', descriptionEn: 'Art & Collectibles', icon: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&h=600&fit=crop' },
  { name: 'ბავშვის პროდუქცია', nameEn: 'Baby', description: 'ბავშვის პროდუქცია', descriptionEn: 'Baby', icon: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&h=600&fit=crop' },
  { name: 'ჩანთები და საფულეები', nameEn: 'Bags & Purses', description: 'ჩანთები და საფულეები', descriptionEn: 'Bags & Purses', icon: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=600&fit=crop' },
  { name: 'სილამაზე და მოვლა', nameEn: 'Bath & Beauty', description: 'სილამაზე და მოვლა', descriptionEn: 'Bath & Beauty', icon: 'https://images.unsplash.com/photo-1596462509314-39f2b6e7c1e0?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1596462509314-39f2b6e7c1e0?w=800&h=600&fit=crop' },
  { name: 'წიგნები, ფილმები და მუსიკა', nameEn: 'Books, Movies & Music', description: 'წიგნები, ფილმები და მუსიკა', descriptionEn: 'Books, Movies & Music', icon: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=600&fit=crop' },
  { name: 'ტანსაცმელი', nameEn: 'Clothing', description: 'ტანსაცმელი', descriptionEn: 'Clothing', icon: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&h=600&fit=crop' },
  { name: 'ხელსაქმის მასალები', nameEn: 'Craft Supplies & Tools', description: 'ხელსაქმის მასალები', descriptionEn: 'Craft Supplies & Tools', icon: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&h=600&fit=crop' },
  { name: 'ელექტრონიკა და აქსესუარები', nameEn: 'Electronics & Accessories', description: 'ელექტრონიკა და აქსესუარები', descriptionEn: 'Electronics & Accessories', icon: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&h=600&fit=crop' },
  { name: 'საჩუქრები', nameEn: 'Gifts', description: 'საჩუქრები', descriptionEn: 'Gifts', icon: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=800&h=600&fit=crop' },
  { name: 'სახლი და ინტერიერი', nameEn: 'Home & Living', description: 'სახლი და ინტერიერი', descriptionEn: 'Home & Living', icon: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=800&h=600&fit=crop' },
  { name: 'სამკაულები', nameEn: 'Jewelry', description: 'სამკაულები', descriptionEn: 'Jewelry', icon: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=600&fit=crop' },
  { name: 'საკანცელარიო და წვეულება', nameEn: 'Paper & Party Supplies', description: 'საკანცელარიო და წვეულება', descriptionEn: 'Paper & Party Supplies', icon: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=600&fit=crop' },
  { name: 'ცხოველების აქსესუარები', nameEn: 'Pet Supplies', description: 'ცხოველების აქსესუარები', descriptionEn: 'Pet Supplies', icon: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=600&fit=crop' },
  { name: 'ფეხსაცმელი', nameEn: 'Shoes', description: 'ფეხსაცმელი', descriptionEn: 'Shoes', icon: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop' },
  { name: 'სათამაშოები და თამაშები', nameEn: 'Toys & Games', description: 'სათამაშოები და თამაშები', descriptionEn: 'Toys & Games', icon: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop' },
  { name: 'საქორწილო', nameEn: 'Weddings', description: 'საქორწილო', descriptionEn: 'Weddings', icon: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=400&fit=crop', image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=600&fit=crop' },
];

// Comprehensive products with images
const products = [
  // Jewelry (Seller 1)
  {
    title: 'ვერცხლის ხელნაკეთი ყელსაბამი',
    titleEn: 'Handmade Silver Necklace',
    description: 'ლამაზი ხელნაკეთი ვერცხლის ყელსაბამი დეტალური ორნამენტებით. სპეციალური ღონისძიებებისთვის ან ყოველდღიური ტარებისთვის.',
    descriptionEn: 'Beautiful handcrafted silver necklace with intricate details. Perfect for special occasions or everyday wear.',
    price: 89.99,
    discountPrice: 69.99,
    stock: 15,
    material: 'ვერცხლი',
    materialEn: 'Sterling Silver',
    weight: '25g',
    dimensions: '45cm სიგრძე',
    dimensionsEn: '45cm length',
    careInstructions: 'შეინახეთ მშრალ ადგილას. გაასუფთავეთ რბილი ქსოვილით.',
    careInstructionsEn: 'Store in a dry place. Clean with soft cloth.',
    categoryName: 'სამკაულები',
    images: [
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a2?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&h=800&fit=crop',
    ],
    variants: [
      { size: 'პატარა', sizeEn: 'Small', price: 69.99, stock: 5 },
      { size: 'საშუალო', sizeEn: 'Medium', price: 79.99, stock: 7 },
      { size: 'დიდი', sizeEn: 'Large', price: 89.99, stock: 3 },
    ],
  },
  {
    title: 'ოქროს ხელნაკეთი ბეჭედი',
    titleEn: 'Handmade Gold Ring',
    description: 'ელეგანტური ოქროს ბეჭედი უნიკალური დიზაინით. ხელნაკეთი გამოცდილი ოსტატების მიერ.',
    descriptionEn: 'Elegant gold ring with unique design. Handcrafted by skilled artisans.',
    price: 149.99,
    stock: 10,
    material: '14K ოქრო',
    materialEn: '14K Gold',
    weight: '8g',
    dimensions: 'ბეჭდის ზომა 6-9',
    dimensionsEn: 'Ring size 6-9',
    careInstructions: 'თავიდან ავიდეთ ქიმიკატებთან კონტაქტს. რეგულარულად გააპრიალეთ.',
    careInstructionsEn: 'Avoid contact with chemicals. Polish regularly.',
    categoryName: 'სამკაულები',
    images: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&h=800&fit=crop',
    ],
    variants: [
      { size: '6', price: 149.99, stock: 2 },
      { size: '7', price: 149.99, stock: 3 },
      { size: '8', price: 149.99, stock: 3 },
      { size: '9', price: 149.99, stock: 2 },
    ],
  },
  {
    title: 'პერლის საყურეები',
    titleEn: 'Pearl Earrings',
    description: 'ელეგანტური პერლის საყურეები ვერცხლის ჩარჩოთი. კლასიკური სტილი.',
    descriptionEn: 'Elegant pearl earrings with silver setting. Classic style.',
    price: 79.99,
    stock: 12,
    material: 'პერლები, ვერცხლი',
    materialEn: 'Pearls, Silver',
    categoryName: 'სამკაულები',
    images: [
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&h=800&fit=crop',
    ],
  },
  {
    title: 'ბრაცლეტი ქვებით',
    titleEn: 'Gemstone Bracelet',
    description: 'ლამაზი ბრაცლეტი ნახევრადძვირფასი ქვებით. ხელნაკეთი ვერცხლის ბმულებით.',
    descriptionEn: 'Beautiful bracelet with semi-precious stones. Handcrafted silver links.',
    price: 95.99,
    discountPrice: 75.99,
    stock: 8,
    material: 'ნახევრადძვირფასი ქვები, ვერცხლი',
    materialEn: 'Semi-precious stones, Silver',
    categoryName: 'სამკაულები',
    images: [
      'https://images.unsplash.com/photo-1611955167811-4711904bb4f5?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a2?w=800&h=800&fit=crop',
    ],
  },
  // Clothing (Seller 2)
  {
    title: 'ხელნაკეთი ბამბის შარფი',
    titleEn: 'Handmade Cotton Scarf',
    description: 'რბილი და კომფორტული ბამბის შარფი. ხელნაკეთი ტრადიციული ტექნიკით.',
    descriptionEn: 'Soft and comfortable cotton scarf. Handwoven with traditional techniques.',
    price: 39.99,
    stock: 20,
    material: '100% ბამბა',
    materialEn: '100% Cotton',
    weight: '150g',
    dimensions: '180cm x 60cm',
    careInstructions: 'გარეცხეთ ცივ წყალში. დაშრეთ დაბალ ტემპერატურაზე.',
    careInstructionsEn: 'Machine wash cold. Tumble dry low.',
    categoryName: 'ტანსაცმელი',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1544966503-7cc49a1c6d0e?w=800&h=800&fit=crop',
    ],
    variants: [
      { color: 'ლურჯი', colorEn: 'Blue', price: 39.99, stock: 7 },
      { color: 'წითელი', colorEn: 'Red', price: 39.99, stock: 6 },
      { color: 'მწვანე', colorEn: 'Green', price: 39.99, stock: 7 },
    ],
  },
  {
    title: 'ხელნაქსოვი ბამბის სვიტერი',
    titleEn: 'Handknitted Wool Sweater',
    description: 'თბილი და კომფორტული ხელნაქსოვი ბამბის სვიტერი. ზამთრისთვის იდეალური.',
    descriptionEn: 'Warm and cozy handknitted wool sweater. Perfect for winter.',
    price: 99.99,
    discountPrice: 79.99,
    stock: 6,
    material: '100% ბამბა',
    materialEn: '100% Wool',
    weight: '500g',
    dimensions: 'S, M, L, XL',
    careInstructions: 'გარეცხეთ ხელით ცივ წყალში. გააშრეთ ბრტყელ ზედაპირზე.',
    careInstructionsEn: 'Hand wash in cold water. Lay flat to dry.',
    categoryName: 'ტანსაცმელი',
    images: [
      'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=800&fit=crop',
    ],
    variants: [
      { size: 'S', price: 79.99, stock: 1 },
      { size: 'M', price: 79.99, stock: 2 },
      { size: 'L', price: 79.99, stock: 2 },
      { size: 'XL', price: 79.99, stock: 1 },
    ],
  },
  {
    title: 'ხელნაკეთი ქურთუკი',
    titleEn: 'Handmade Coat',
    description: 'ელეგანტური ხელნაკეთი ქურთუკი ბამბისგან. ზამთრისთვის იდეალური.',
    descriptionEn: 'Elegant handmade coat from wool. Perfect for winter.',
    price: 199.99,
    stock: 4,
    material: 'ბამბა',
    materialEn: 'Wool',
    categoryName: 'ტანსაცმელი',
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&h=800&fit=crop',
    ],
    variants: [
      { size: 'M', price: 199.99, stock: 1 },
      { size: 'L', price: 199.99, stock: 2 },
      { size: 'XL', price: 199.99, stock: 1 },
    ],
  },
  {
    title: 'ხელნაკეთი ქურთუკი',
    titleEn: 'Handmade Dress',
    description: 'ლამაზი ხელნაკეთი ქურთუკი ბამბისგან. ტრადიციული ორნამენტებით.',
    descriptionEn: 'Beautiful handmade dress from cotton. With traditional ornaments.',
    price: 129.99,
    stock: 8,
    material: 'ბამბა',
    materialEn: 'Cotton',
    categoryName: 'ტანსაცმელი',
    images: [
      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=800&fit=crop',
    ],
    variants: [
      { size: 'S', price: 129.99, stock: 2 },
      { size: 'M', price: 129.99, stock: 3 },
      { size: 'L', price: 129.99, stock: 3 },
    ],
  },
  // Home Decor (Seller 3)
  {
    title: 'ხელნაქსოვი ბამბის საბანი',
    titleEn: 'Handwoven Wool Blanket',
    description: 'თბილი და კომფორტული ხელნაქსოვი ბამბის საბანი. ოთახის ან საძინებლისთვის.',
    descriptionEn: 'Cozy and warm handwoven wool blanket. Perfect for your living room or bedroom.',
    price: 129.99,
    stock: 8,
    material: '100% ბამბა',
    materialEn: '100% Wool',
    weight: '1.2kg',
    dimensions: '150cm x 200cm',
    careInstructions: 'მხოლოდ მშრალი გაწმენდა. არ გარეცხოთ მანქანაში.',
    careInstructionsEn: 'Dry clean only. Do not machine wash.',
    categoryName: 'სახლი და ინტერიერი',
    images: [
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&h=800&fit=crop',
    ],
  },
  {
    title: 'კერამიკის ვაზების კომპლექტი',
    titleEn: 'Ceramic Vase Set',
    description: 'ლამაზი კომპლექტი 3 კერამიკის ვაზისგან სხვადასხვა ზომის. ხელნაკეთი ტრადიციული ორნამენტებით.',
    descriptionEn: 'Beautiful set of 3 ceramic vases in different sizes. Hand-painted with traditional patterns.',
    price: 79.99,
    stock: 12,
    material: 'კერამიკა',
    materialEn: 'Ceramic',
    weight: '2.5kg',
    dimensions: 'პატარა: 15cm, საშუალო: 25cm, დიდი: 35cm',
    dimensionsEn: 'Small: 15cm, Medium: 25cm, Large: 35cm',
    careInstructions: 'გარეცხეთ მხოლოდ ხელით. მოპყრობა ფრთხილად.',
    careInstructionsEn: 'Hand wash only. Handle with care.',
    categoryName: 'სახლი და ინტერიერი',
    images: [
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&h=800&fit=crop',
    ],
  },
  {
    title: 'ხელნაკეთი ნახატი',
    titleEn: 'Hand-painted Canvas Art',
    description: 'ლამაზი ხელნაკეთი ნახატი ტილოზე. ორიგინალური ნამუშევარი ადგილობრივი მხატვრის მიერ.',
    descriptionEn: 'Beautiful hand-painted canvas artwork. Original piece created by local artist.',
    price: 199.99,
    stock: 3,
    material: 'ტილო, აკრილის საღებავი',
    materialEn: 'Canvas, Acrylic Paint',
    weight: '1.5kg',
    dimensions: '50cm x 70cm',
    careInstructions: 'თავიდან ავიდეთ პირდაპირ მზის სხივებს. გაასუფთავეთ რბილი ქსოვილით.',
    careInstructionsEn: 'Keep away from direct sunlight. Dust with soft cloth.',
    categoryName: 'სახლი და ინტერიერი',
    images: [
      'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&h=800&fit=crop',
    ],
  },
  {
    title: 'ხელნაკეთი ნათურა',
    titleEn: 'Handmade Lamp',
    description: 'ელეგანტური ხელნაკეთი ნათურა ხისგან. უნიკალური დიზაინით.',
    descriptionEn: 'Elegant handmade lamp from wood. With unique design.',
    price: 149.99,
    stock: 5,
    material: 'ხე',
    materialEn: 'Wood',
    categoryName: 'სახლი და ინტერიერი',
    images: [
      'https://images.unsplash.com/photo-1503602642458-232111445657?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop',
    ],
  },
  // Woodwork (Seller 4)
  {
    title: 'ხის ხელნაკეთი ყუთი',
    titleEn: 'Handmade Wooden Box',
    description: 'ლამაზი ხის ხელნაკეთი ყუთი ხელნაკეთი ორნამენტებით. სხვადასხვა ზომის.',
    descriptionEn: 'Beautiful handmade wooden box with handcrafted ornaments. Various sizes.',
    price: 59.99,
    stock: 15,
    material: 'ხე',
    materialEn: 'Wood',
    categoryName: 'სახლი და ინტერიერი',
    images: [
      'https://images.unsplash.com/photo-1503602642458-232111445657?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop',
    ],
  },
  {
    title: 'ხის ხელნაკეთი თეფში',
    titleEn: 'Handmade Wooden Cutting Board',
    description: 'ხის ხელნაკეთი თეფში სამზარეულოსთვის. ბუნებრივი ხის ტექსტურით.',
    descriptionEn: 'Handmade wooden cutting board for kitchen. With natural wood texture.',
    price: 49.99,
    stock: 20,
    material: 'ხე',
    materialEn: 'Wood',
    categoryName: 'სახლი და ინტერიერი',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop',
    ],
  },
  {
    title: 'ხის ხელნაკეთი თარო',
    titleEn: 'Handmade Wooden Shelf',
    description: 'ელეგანტური ხის ხელნაკეთი თარო. სახლის დეკორაციისთვის.',
    descriptionEn: 'Elegant handmade wooden shelf. For home decoration.',
    price: 89.99,
    stock: 6,
    material: 'ხე',
    materialEn: 'Wood',
    categoryName: 'სახლი და ინტერიერი',
    images: [
      'https://images.unsplash.com/photo-1503602642458-232111445657?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop',
    ],
  },
  // Textiles (Seller 5)
  {
    title: 'ხელნაკეთი ბალიში',
    titleEn: 'Handmade Pillow',
    description: 'კომფორტული ხელნაკეთი ბალიში ბამბისგან. სხვადასხვა ფერებში.',
    descriptionEn: 'Comfortable handmade pillow from cotton. Various colors.',
    price: 34.99,
    stock: 25,
    material: 'ბამბა',
    materialEn: 'Cotton',
    categoryName: 'ტანსაცმელი',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1544966503-7cc49a1c6d0e?w=800&h=800&fit=crop',
    ],
    variants: [
      { color: 'ლურჯი', colorEn: 'Blue', price: 34.99, stock: 8 },
      { color: 'წითელი', colorEn: 'Red', price: 34.99, stock: 9 },
      { color: 'მწვანე', colorEn: 'Green', price: 34.99, stock: 8 },
    ],
  },
  {
    title: 'ხელნაკეთი ნაბიჯი',
    titleEn: 'Handmade Rug',
    description: 'ლამაზი ხელნაკეთი ნაბიჯი ბამბისგან. ტრადიციული ორნამენტებით.',
    descriptionEn: 'Beautiful handmade rug from cotton. With traditional ornaments.',
    price: 179.99,
    stock: 4,
    material: 'ბამბა',
    materialEn: 'Cotton',
    categoryName: 'ტანსაცმელი',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1544966503-7cc49a1c6d0e?w=800&h=800&fit=crop',
    ],
  },
  // Accessories
  {
    title: 'ტყავის ხელნაკეთი ჩანთა',
    titleEn: 'Leather Handbag',
    description: 'ელეგანტური ტყავის ხელნაკეთი ჩანთა ხელნაკეთი დეტალებით. ყოველდღიური გამოყენებისთვის.',
    descriptionEn: 'Elegant leather handbag with hand-stitched details. Perfect for everyday use.',
    price: 159.99,
    stock: 5,
    material: 'ნამდვილი ტყავი',
    materialEn: 'Genuine Leather',
    weight: '800g',
    dimensions: '35cm x 28cm x 12cm',
    careInstructions: 'გაასუფთავეთ ტყავის კონდიციონერით. თავიდან ავიდეთ წყალს.',
    careInstructionsEn: 'Clean with leather conditioner. Keep away from water.',
    categoryName: 'აქსესუარები',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=800&fit=crop',
    ],
  },
  {
    title: 'ხის ხელნაკეთი საათი',
    titleEn: 'Handmade Wooden Watch',
    description: 'უნიკალური ხის საათი ბუნებრივი ხის ტექსტურით. ეკოლოგიური და სტილური.',
    descriptionEn: 'Unique wooden watch with natural wood grain. Eco-friendly and stylish.',
    price: 119.99,
    stock: 9,
    material: 'ბამბუკის ხე',
    materialEn: 'Bamboo Wood',
    weight: '50g',
    dimensions: 'საათის სიგანე: 42mm',
    dimensionsEn: 'Watch face: 42mm',
    careInstructions: 'თავიდან ავიდეთ წყალს. გაასუფთავეთ მშრალი ქსოვილით.',
    careInstructionsEn: 'Avoid water. Clean with dry cloth.',
    categoryName: 'აქსესუარები',
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&h=800&fit=crop',
    ],
  },
  // Ceramics
  {
    title: 'კერამიკის ხელნაკეთი თეფშების კომპლექტი',
    titleEn: 'Handmade Pottery Bowl Set',
    description: 'კომპლექტი 4 ხელნაკეთი კერამიკის თეფშისგან. თითოეული ნაწარმი უნიკალურია.',
    descriptionEn: 'Set of 4 handmade pottery bowls. Each piece is unique.',
    price: 69.99,
    stock: 7,
    material: 'თიხა, გაზარდული',
    materialEn: 'Clay, Glazed',
    weight: '2kg',
    dimensions: 'თეფშის დიამეტრი: 15cm თითოეული',
    dimensionsEn: 'Bowl diameter: 15cm each',
    careInstructions: 'ჭურჭლის სარეცხი მანქანაში უსაფრთხო. მიკროტალღური ღუმელში უსაფრთხო.',
    careInstructionsEn: 'Dishwasher safe. Microwave safe.',
    categoryName: 'ხელოვნება და კოლექციური ნივთები',
    images: [
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&h=800&fit=crop',
    ],
  },
  // Art & Crafts
  {
    title: 'ხელნაკეთი ბარათების კომპლექტი',
    titleEn: 'Handmade Greeting Cards Set',
    description: 'ლამაზი კომპლექტი ხელნაკეთი ბარათებისგან. სხვადასხვა დიზაინით.',
    descriptionEn: 'Beautiful set of handmade greeting cards. Various designs.',
    price: 24.99,
    stock: 30,
    material: 'ქაღალდი',
    materialEn: 'Paper',
    categoryName: 'წიგნები, ფილმები და მუსიკა',
    images: [
      'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=800&fit=crop',
    ],
  },
  // Kids Items
  {
    title: 'საბავშვო ხელნაკეთი სათამაშო',
    titleEn: 'Handmade Kids Toy',
    description: 'უსაფრთხო ხელნაკეთი სათამაშო ბავშვებისთვის. ბუნებრივი მასალებით.',
    descriptionEn: 'Safe handmade toy for kids. Made from natural materials.',
    price: 29.99,
    stock: 18,
    material: 'ხე, ბამბა',
    materialEn: 'Wood, Cotton',
    categoryName: 'ბავშვის პროდუქცია',
    images: [
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
    ],
  },
];

function initializeFirebase(): Firestore {
  if (getApps().length > 0) {
    return getFirestore(getApps()[0]);
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccount && serviceAccount !== '{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}') {
    try {
      const serviceAccountJson = JSON.parse(serviceAccount);
      
      if (!serviceAccountJson.project_id || !serviceAccountJson.private_key || !serviceAccountJson.client_email) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT is missing required fields');
      }
      
      if (serviceAccountJson.private_key) {
        serviceAccountJson.private_key = serviceAccountJson.private_key.replace(/\\n/g, '\n');
      }
      
      const app = initializeApp({
        credential: cert(serviceAccountJson),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccountJson.project_id}.appspot.com`,
        projectId: serviceAccountJson.project_id,
      });
      
      return getFirestore(app);
    } catch (error: any) {
      throw new Error(`Failed to initialize Firebase: ${error.message}`);
    }
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    
    if (!projectId || !privateKey || !clientEmail) {
      throw new Error('Firebase credentials are not properly configured in .env file');
    }
    
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    
    const app = initializeApp({
      credential: cert({
        projectId,
        privateKey: formattedPrivateKey,
        clientEmail,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    });
    
    return getFirestore(app);
  }
}

async function clearDatabase(db: Firestore) {
  console.log('🗑️  Clearing existing data...\n');
  
  // Delete all products
  const productsSnapshot = await db.collection('products').get();
  const productDeletes = productsSnapshot.docs.map(doc => doc.ref.delete());
  await Promise.all(productDeletes);
  console.log(`✅ Deleted ${productsSnapshot.size} products`);
  
  // Delete all categories
  const categoriesSnapshot = await db.collection('categories').get();
  const categoryDeletes = categoriesSnapshot.docs.map(doc => doc.ref.delete());
  await Promise.all(categoryDeletes);
  console.log(`✅ Deleted ${categoriesSnapshot.size} categories`);
  
  // Delete all users (except keep admin for safety)
  const usersSnapshot = await db.collection('users').get();
  let userCount = 0;
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    if (userData.role !== 'admin') {
      await doc.ref.delete();
      userCount++;
    }
  }
  console.log(`✅ Deleted ${userCount} users (kept admin users)`);
  
  // Delete all seller profiles
  const sellerProfilesSnapshot = await db.collection('seller_profiles').get();
  const sellerProfileDeletes = sellerProfilesSnapshot.docs.map(doc => doc.ref.delete());
  await Promise.all(sellerProfileDeletes);
  console.log(`✅ Deleted ${sellerProfilesSnapshot.size} seller profiles\n`);
}

async function seedUsers(db: Firestore) {
  console.log('👥 Seeding users...\n');
  
  let created = 0;
  let skipped = 0;
  
  for (const userData of testUsers) {
    try {
      // Check if user already exists
      let existingUser = null;
      
      if (userData.email) {
        const emailSnapshot = await db.collection('users')
          .where('email', '==', userData.email)
          .limit(1)
          .get();
        if (!emailSnapshot.empty) {
          existingUser = { id: emailSnapshot.docs[0].id, ...emailSnapshot.docs[0].data() };
        }
      }
      
      if (existingUser) {
        // Update user
        await db.collection('users').doc(existingUser.id).update({
          role: userData.role,
          firstName: userData.firstName,
          lastName: userData.lastName,
          avatar: userData.avatar || null,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          updatedAt: Timestamp.now(),
        });
        console.log(`🔄 Updated user: ${userData.email} (${userData.role})`);
        created++;
        continue;
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user document
      const now = Timestamp.now();
      const userRef = db.collection('users').doc();
      await userRef.set({
        email: userData.email,
        phone: userData.phone,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        avatar: userData.avatar || null,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      
      // Create seller profile if seller
      if (userData.role === UserRole.SELLER && (userData as any).shopName) {
        const sellerData = userData as any;
        const sellerProfileRef = db.collection('seller_profiles').doc();
        await sellerProfileRef.set({
          userId: userRef.id,
          shopName: sellerData.shopName,
          shopDescription: sellerData.shopDescription,
          address: sellerData.address,
          latitude: sellerData.latitude,
          longitude: sellerData.longitude,
          coverPhoto: sellerData.coverPhoto,
          profilePicture: sellerData.avatar,
          workingHours: sellerData.workingHours,
          followers: 0,
          rating: 0,
          totalSales: 0,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`✅ Created seller profile for: ${userData.email}`);
      }
      
      console.log(`✅ Created user: ${userData.email} (${userData.role})`);
      created++;
    } catch (error: any) {
      console.error(`❌ Error creating user ${userData.email}:`, error.message);
    }
  }
  
  console.log(`\n📊 Users: Created ${created}, Skipped ${skipped}\n`);
  return created;
}

async function seedCategories(db: Firestore) {
  console.log('📁 Seeding categories...\n');
  
  let created = 0;
  
  for (const categoryData of categories) {
    try {
      const slug = categoryData.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const now = Timestamp.now();
      
      const categoryRef = db.collection('categories').doc();
      await categoryRef.set({
        name: categoryData.name,
        nameEn: categoryData.nameEn,
        slug: slug,
        description: categoryData.description,
        descriptionEn: categoryData.descriptionEn,
        parentId: null,
        image: categoryData.image,
        icon: categoryData.icon,
        sortOrder: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      
      console.log(`✅ Created category: ${categoryData.name} (${categoryData.nameEn})`);
      created++;
    } catch (error: any) {
      console.error(`❌ Error creating category ${categoryData.name}:`, error.message);
    }
  }
  
  console.log(`\n📊 Categories: Created ${created}\n`);
  return created;
}

async function seedProducts(db: Firestore) {
  console.log('📦 Seeding products...\n');
  
  // Get seller users
  const sellersSnapshot = await db.collection('users')
    .where('role', '==', 'seller')
    .where('isActive', '==', true)
    .get();
  
  if (sellersSnapshot.empty) {
    throw new Error('No seller users found. Please seed users first.');
  }
  
  const sellers = sellersSnapshot.docs.map(doc => ({
    id: doc.id,
    email: doc.data().email || 'unknown',
  }));
  
  console.log(`📦 Found ${sellers.length} seller(s)\n`);
  
  // Get categories
  const categoriesSnapshot = await db.collection('categories').get();
  const categoryMap = new Map<string, string>();
  categoriesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    categoryMap.set(data.name, doc.id);
    categoryMap.set(data.nameEn, doc.id);
  });
  
  let created = 0;
  
  for (let i = 0; i < products.length; i++) {
    const productData = products[i];
    const seller = sellers[i % sellers.length];
    
    try {
      const categoryId = categoryMap.get(productData.categoryName);
      if (!categoryId) {
        console.error(`❌ Category not found: ${productData.categoryName}`);
        continue;
      }
      
      const slug = productData.titleEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      const now = Timestamp.now();
      const productRef = db.collection('products').doc();
      
      const productDoc: any = {
        title: productData.title,
        titleEn: productData.titleEn,
        description: productData.description,
        descriptionEn: productData.descriptionEn,
        categoryId,
        sellerId: seller.id,
        price: productData.price,
        discountPrice: productData.discountPrice || null,
        stock: productData.stock,
        material: productData.material,
        materialEn: productData.materialEn || productData.material,
        weight: productData.weight || null,
        dimensions: productData.dimensions || null,
        dimensionsEn: productData.dimensionsEn || productData.dimensions || null,
        careInstructions: productData.careInstructions || null,
        careInstructionsEn: productData.careInstructionsEn || productData.careInstructions || null,
        slug: `${slug}-${Date.now()}`,
        images: productData.images.map((url, index) => ({
          url,
          sortOrder: index,
        })),
        moderationStatus: ModerationStatus.APPROVED,
        averageRating: Math.random() * 2 + 3, // 3-5 rating
        totalReviews: Math.floor(Math.random() * 50) + 5, // 5-55 reviews
        totalSales: Math.floor(Math.random() * 100),
        views: Math.floor(Math.random() * 500) + 50,
        isActive: true,
        isFeatured: i < 5, // First 5 products are featured
        createdAt: now,
        updatedAt: now,
      };
      
      if (productData.variants && productData.variants.length > 0) {
        productDoc.variants = productData.variants;
      }
      
      await productRef.set(productDoc);
      
      console.log(`✅ Created product: "${productData.title}" (${productData.categoryName}) - Seller: ${seller.email}`);
      created++;
    } catch (error: any) {
      console.error(`❌ Error creating product "${productData.title}":`, error.message);
    }
  }
  
  console.log(`\n📊 Products: Created ${created}\n`);
  return created;
}

async function seedComprehensive() {
  try {
    console.log('🌱 Starting comprehensive database seeding...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const db = initializeFirebase();
    
    // Step 1: Clear existing data
    await clearDatabase(db);
    
    // Step 2: Seed users
    await seedUsers(db);
    
    // Step 3: Seed categories
    await seedCategories(db);
    
    // Step 4: Seed products
    await seedProducts(db);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Comprehensive database seeding completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Print test credentials
    console.log('📝 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testUsers.forEach((user) => {
      console.log(`${user.role.toUpperCase()}:`);
      if (user.email) console.log(`  Email: ${user.email}`);
      if (user.phone) console.log(`  Phone: ${user.phone}`);
      console.log(`  Password: ${user.password}`);
      console.log('');
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedComprehensive();
}

export { seedComprehensive };

