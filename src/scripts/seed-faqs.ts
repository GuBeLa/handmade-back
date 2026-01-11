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

function initializeFirebase(): Firestore {
  if (getApps().length === 0) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH not found or invalid');
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  
  return getFirestore();
}

interface FAQ {
  categoryId: string;
  question: string;
  questionEn: string;
  answer: string;
  answerEn: string;
  order: number;
  views: number;
  isActive: boolean;
}

const faqs: FAQ[] = [
  // Orders Category
  {
    categoryId: 'orders',
    question: 'როგორ შემიძლია შეკვეთის გაკეთება?',
    questionEn: 'How can I place an order?',
    answer: 'შეკვეთის გასაკეთებლად, აირჩიეთ სასურველი პროდუქტი, დაამატეთ კალათაში და გადადით გადახდის გვერდზე. შეავსეთ მისამართის ინფორმაცია, აირჩიეთ მიტანის მეთოდი და გადაიხადეთ შეკვეთა.',
    answerEn: 'To place an order, select the desired product, add it to your cart, and proceed to checkout. Fill in your address information, choose a delivery method, and complete the payment.',
    order: 1,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'orders',
    question: 'როგორ შემიძლია შეკვეთის სტატუსის შემოწმება?',
    questionEn: 'How can I check my order status?',
    answer: 'შეკვეთის სტატუსის შესამოწმებლად, გადადით "შეკვეთები" გვერდზე თქვენს პროფილში. იქ ნახავთ ყველა შეკვეთას მათი სტატუსებით: მოლოდინში, დადასტურებული, დამუშავებაში, გაგზავნილი, მიღებული.',
    answerEn: 'To check your order status, go to the "Orders" page in your profile. There you will see all your orders with their statuses: pending, confirmed, processing, shipped, delivered.',
    order: 2,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'orders',
    question: 'რა ვქნა თუ შეკვეთა არ მივიღე?',
    questionEn: 'What should I do if I did not receive my order?',
    answer: 'თუ შეკვეთა არ მიიღეთ დადგენილ ვადაში, დაუკავშირდით გამყიდველს პირდაპირ მესიჯის გზით ან შექმენით მხარდაჭერის ბილეთი. ჩვენ დაგეხმარებით პრობლემის მოგვარებაში.',
    answerEn: 'If you did not receive your order within the specified time, contact the seller directly via message or create a support ticket. We will help you resolve the issue.',
    order: 3,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'orders',
    question: 'შემიძლია შეკვეთის გაუქმება?',
    questionEn: 'Can I cancel my order?',
    answer: 'დიახ, შეკვეთის გაუქმება შეგიძლიათ, თუ ის ჯერ არ არის გაგზავნილი. გადადით შეკვეთის დეტალურ გვერდზე და აირჩიეთ "გაუქმება". თუ შეკვეთა უკვე გაგზავნილია, დაუკავშირდით გამყიდველს.',
    answerEn: 'Yes, you can cancel your order if it has not been shipped yet. Go to the order details page and select "Cancel". If the order has already been shipped, contact the seller.',
    order: 4,
    views: 0,
    isActive: true,
  },

  // Payments Category
  {
    categoryId: 'payments',
    question: 'რა გადახდის მეთოდებია ხელმისაწვდომი?',
    questionEn: 'What payment methods are available?',
    answer: 'ჩვენ ვიღებთ გადახდას შემდეგი მეთოდებით: TBC Pay, Liberty Pay, BOG Pay, Payze და ნაღდი ფული მიტანისას. ყველა ონლაინ გადახდა უსაფრთხოა და დაცულია.',
    answerEn: 'We accept payments via the following methods: TBC Pay, Liberty Pay, BOG Pay, Payze, and cash on delivery. All online payments are secure and protected.',
    order: 1,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'payments',
    question: 'როდის ხდება გადახდა?',
    questionEn: 'When is payment processed?',
    answer: 'გადახდა ხდება შეკვეთის გაკეთებისას. თუ აირჩევთ "ნაღდი ფული მიტანისას" ოფციას, გადახდა მოხდება მიტანისას.',
    answerEn: 'Payment is processed when you place the order. If you choose the "Cash on Delivery" option, payment will be made upon delivery.',
    order: 2,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'payments',
    question: 'რა ვქნა თუ გადახდა ვერ განხორციელდა?',
    questionEn: 'What should I do if payment failed?',
    answer: 'თუ გადახდა ვერ განხორციელდა, შეამოწმეთ თქვენი ბანკის ანგარიშის ბალანსი და ბარათის მონაცემები. თუ პრობლემა გრძელდება, დაუკავშირდით თქვენს ბანკს ან შექმენით მხარდაჭერის ბილეთი.',
    answerEn: 'If payment failed, check your bank account balance and card details. If the problem persists, contact your bank or create a support ticket.',
    order: 3,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'payments',
    question: 'როდის მივიღებ ჩემს ფულს დაბრუნებას?',
    questionEn: 'When will I receive my refund?',
    answer: 'დაბრუნება ხდება 5-10 სამუშაო დღის განმავლობაში, შეკვეთის დაბრუნების დადასტურების შემდეგ. თანხა დაბრუნდება იმავე მეთოდით, რომლითაც გადაიხადეთ.',
    answerEn: 'Refunds are processed within 5-10 business days after the return is confirmed. The amount will be refunded using the same payment method you used.',
    order: 4,
    views: 0,
    isActive: true,
  },

  // Delivery Category
  {
    categoryId: 'delivery',
    question: 'რა მიტანის მეთოდებია ხელმისაწვდომი?',
    questionEn: 'What delivery methods are available?',
    answer: 'ჩვენ გვაქვს სამი მიტანის მეთოდი: კურიერი (თბილისში), საფოსტო მიტანა (საქართველოს მასშტაბით) და თვითმიტანა (გამყიდველის მისამართიდან).',
    answerEn: 'We have three delivery methods: courier (in Tbilisi), postal delivery (throughout Georgia), and self-pickup (from the seller\'s address).',
    order: 1,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'delivery',
    question: 'რამდენი ხანი სჭირდება მიტანას?',
    questionEn: 'How long does delivery take?',
    answer: 'მიტანის დრო დამოკიდებულია მეთოდზე: კურიერი თბილისში - 1-2 დღე, საფოსტო მიტანა - 3-7 სამუშაო დღე, თვითმიტანა - გამყიდველთან შეთანხმებით.',
    answerEn: 'Delivery time depends on the method: courier in Tbilisi - 1-2 days, postal delivery - 3-7 business days, self-pickup - by agreement with the seller.',
    order: 2,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'delivery',
    question: 'რა ღირს მიტანა?',
    questionEn: 'How much does delivery cost?',
    answer: 'მიტანის ღირებულება დამოკიდებულია მეთოდზე და მისამართზე. კურიერი თბილისში - 5-10 ლარი, საფოსტო მიტანა - 7-15 ლარი, თვითმიტანა - უფასო. ზუსტი ღირებულება ნაჩვენებია შეკვეთის გაკეთებისას.',
    answerEn: 'Delivery cost depends on the method and address. Courier in Tbilisi - 5-10 GEL, postal delivery - 7-15 GEL, self-pickup - free. Exact cost is shown when placing an order.',
    order: 3,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'delivery',
    question: 'შემიძლია მიტანის მისამართის შეცვლა?',
    questionEn: 'Can I change the delivery address?',
    answer: 'დიახ, მიტანის მისამართის შეცვლა შეგიძლიათ, თუ შეკვეთა ჯერ არ არის გაგზავნილი. დაუკავშირდით გამყიდველს ან შექმენით მხარდაჭერის ბილეთი.',
    answerEn: 'Yes, you can change the delivery address if the order has not been shipped yet. Contact the seller or create a support ticket.',
    order: 4,
    views: 0,
    isActive: true,
  },

  // Returns Category
  {
    categoryId: 'returns',
    question: 'რა არის დაბრუნების პოლიტიკა?',
    questionEn: 'What is the return policy?',
    answer: 'პროდუქტის დაბრუნება შესაძლებელია 14 დღის განმავლობაში შეკვეთის მიღების შემდეგ. პროდუქტი უნდა იყოს ორიგინალურ შეფუთვაში და გამოუყენებელი მდგომარეობაში.',
    answerEn: 'Products can be returned within 14 days of receiving the order. The product must be in its original packaging and unused condition.',
    order: 1,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'returns',
    question: 'როგორ შემიძლია დაბრუნების მოთხოვნა?',
    questionEn: 'How can I request a return?',
    answer: 'დაბრუნების მოთხოვნისთვის, გადადით შეკვეთის დეტალურ გვერდზე და აირჩიეთ "დაბრუნების მოთხოვნა". შეავსეთ მიზეზი და აღწერა, შემდეგ გამყიდველი განიხილავს თქვენს მოთხოვნას.',
    answerEn: 'To request a return, go to the order details page and select "Request Return". Fill in the reason and description, then the seller will review your request.',
    order: 2,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'returns',
    question: 'რა მიზეზებით შემიძლია დაბრუნება?',
    questionEn: 'What are valid reasons for return?',
    answer: 'დაბრუნება შესაძლებელია შემდეგი მიზეზებით: დეფექტური პროდუქტი, არასწორი პროდუქტი, ზომა არ ეხვევა, ფერის შეუსაბამობა ან სხვა მიზეზი.',
    answerEn: 'Returns are possible for the following reasons: defective product, wrong product, size does not fit, color mismatch, or other reason.',
    order: 3,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'returns',
    question: 'როდის მივიღებ დაბრუნების თანხას?',
    questionEn: 'When will I receive the refund?',
    answer: 'დაბრუნების თანხა დაბრუნდება 5-10 სამუშაო დღის განმავლობაში, დაბრუნების დადასტურებისა და პროდუქტის მიღების შემდეგ.',
    answerEn: 'The refund amount will be returned within 5-10 business days after the return is confirmed and the product is received.',
    order: 4,
    views: 0,
    isActive: true,
  },

  // Sellers Category
  {
    categoryId: 'sellers',
    question: 'როგორ შემიძლია გავხდე გამყიდველი?',
    questionEn: 'How can I become a seller?',
    answer: 'გამყიდველად გასახდომად, გადადით პროფილში და აირჩიეთ "გახდი გამყიდველი". შეავსეთ გამყიდველის პროფილის ინფორმაცია, გადახდის დეტალები და დაადასტურეთ თქვენი იდენტობა. ჩვენი გუნდი განიხილავს თქვენს განაცხადს.',
    answerEn: 'To become a seller, go to your profile and select "Become a Seller". Fill in the seller profile information, payment details, and verify your identity. Our team will review your application.',
    order: 1,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'sellers',
    question: 'რა საკომისიოს იღებთ?',
    questionEn: 'What commission do you charge?',
    answer: 'ჩვენი პლატფორმა იღებს საკომისიოს გაყიდვების მოცულობის მიხედვით. დეტალური ინფორმაცია მოგეწოდებათ გამყიდველის პროფილის შექმნისას.',
    answerEn: 'Our platform charges a commission based on sales volume. Detailed information will be provided when creating your seller profile.',
    order: 2,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'sellers',
    question: 'როგორ მივიღო გადახდა გაყიდვებისთვის?',
    questionEn: 'How do I receive payment for sales?',
    answer: 'გადახდა ხდება თვის ბოლოს, შეკვეთების დადასტურებისა და მიღების შემდეგ. თანხა გადაირიცხება თქვენს მითითებულ ანგარიშზე.',
    answerEn: 'Payment is made at the end of the month, after orders are confirmed and received. The amount will be transferred to your specified account.',
    order: 3,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'sellers',
    question: 'როგორ შემიძლია პროდუქტის დამატება?',
    questionEn: 'How can I add a product?',
    answer: 'პროდუქტის დასამატებლად, გადადით გამყიდველის დეშბორდში და აირჩიეთ "დამატება". შეავსეთ პროდუქტის ინფორმაცია, დაამატეთ სურათები (მინიმუმ 5), დააყენეთ ფასი და გამოაქვეყნეთ.',
    answerEn: 'To add a product, go to the seller dashboard and select "Add". Fill in the product information, add images (minimum 5), set the price, and publish.',
    order: 4,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'sellers',
    question: 'როგორ შემიძლია შეკვეთების მართვა?',
    questionEn: 'How can I manage orders?',
    answer: 'შეკვეთების მართვისთვის, გადადით გამყიდველის დეშბორდში "შეკვეთები" ტაბზე. იქ ნახავთ ყველა შეკვეთას და შეგეძლებათ სტატუსის შეცვლა.',
    answerEn: 'To manage orders, go to the seller dashboard "Orders" tab. There you will see all orders and can change their status.',
    order: 5,
    views: 0,
    isActive: true,
  },

  // Account Management Category
  {
    categoryId: 'account',
    question: 'როგორ შემიძლია პროფილის რედაქტირება?',
    questionEn: 'How can I edit my profile?',
    answer: 'პროფილის რედაქტირებისთვის, გადადით პროფილის გვერდზე და აირჩიეთ "რედაქტირება". იქ შეგიძლიათ შეცვალოთ სახელი, გვარი, ელ. ფოსტა, ტელეფონი, მისამართი და სურათი.',
    answerEn: 'To edit your profile, go to the profile page and select "Edit". There you can change your name, last name, email, phone, address, and picture.',
    order: 1,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'account',
    question: 'როგორ შემიძლია პაროლის შეცვლა?',
    questionEn: 'How can I change my password?',
    answer: 'პაროლის შესაცვლელად, გადადით პროფილში და აირჩიეთ "პაროლის შეცვლა". შეიყვანეთ მიმდინარე პაროლი და ახალი პაროლი, შემდეგ დაადასტურეთ.',
    answerEn: 'To change your password, go to your profile and select "Change Password". Enter your current password and new password, then confirm.',
    order: 2,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'account',
    question: 'როგორ შემიძლია მისამართების დამატება?',
    questionEn: 'How can I add addresses?',
    answer: 'მისამართის დასამატებლად, გადადით პროფილში "მისამართები" განყოფილებაში და აირჩიეთ "დამატება". შეავსეთ მისამართის ინფორმაცია და შეინახეთ.',
    answerEn: 'To add an address, go to your profile "Addresses" section and select "Add". Fill in the address information and save.',
    order: 3,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'account',
    question: 'როგორ შემიძლია სურვილების სიის გამოყენება?',
    questionEn: 'How can I use the wishlist?',
    answer: 'სურვილების სიაში პროდუქტის დასამატებლად, დააჭირეთ გულის ხატულას პროდუქტის გვერდზე. სურვილების სიის სანახავად, გადადით პროფილში "სურვილების სია" განყოფილებაში.',
    answerEn: 'To add a product to your wishlist, click the heart icon on the product page. To view your wishlist, go to your profile "Wishlist" section.',
    order: 4,
    views: 0,
    isActive: true,
  },
  {
    categoryId: 'account',
    question: 'როგორ შემიძლია ენის შეცვლა?',
    questionEn: 'How can I change the language?',
    answer: 'ენის შესაცვლელად, გადადით პროფილში და აირჩიეთ "ენა". იქ შეგიძლიათ აირჩიოთ ქართული ან ინგლისური.',
    answerEn: 'To change the language, go to your profile and select "Language". There you can choose Georgian or English.',
    order: 5,
    views: 0,
    isActive: true,
  },
];

async function seedFAQs() {
  try {
    console.log('🌱 Starting FAQ seeding...\n');
    
    const db = initializeFirebase();
    let created = 0;
    let skipped = 0;

    for (const faq of faqs) {
      try {
        // Check if FAQ already exists (by question and categoryId)
        const existingQuery = await db.collection('faqs')
          .where('categoryId', '==', faq.categoryId)
          .where('question', '==', faq.question)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          console.log(`⏭️  FAQ already exists: ${faq.question.substring(0, 50)}...`);
          skipped++;
          continue;
        }

        const now = Timestamp.now();
        const faqRef = db.collection('faqs').doc();
        
        await faqRef.set({
          ...faq,
          createdAt: now,
          updatedAt: now,
        });

        console.log(`✅ Created FAQ: ${faq.question.substring(0, 50)}...`);
        created++;
      } catch (error: any) {
        console.error(`❌ Error creating FAQ: ${faq.question.substring(0, 50)}...`, error.message);
      }
    }

    console.log(`\n📊 FAQs: Created ${created}, Skipped ${skipped}\n`);

    // Verify
    const snapshot = await db.collection('faqs').get();
    console.log(`📊 Total FAQs in database: ${snapshot.size}`);
    
    return { created, skipped };
  } catch (error) {
    console.error('❌ Error seeding FAQs:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedFAQs()
    .then(() => {
      console.log('✨ FAQ seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 FAQ seeding failed:', error);
      process.exit(1);
    });
}

export { seedFAQs };
