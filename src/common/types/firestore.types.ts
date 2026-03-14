// Placeholder file - types are defined inline in modules
// This file is needed to resolve imports
export interface Product {
  [key: string]: any;
}

export interface Order {
  [key: string]: any;
}

export interface Coupon {
  [key: string]: any;
}

export interface Promotion {
  [key: string]: any;
}

export interface Return {
  [key: string]: any;
}

export interface Subscription {
  [key: string]: any;
}

export interface SubscriptionPlan {
  [key: string]: any;
}

export interface SellerProfile {
  [key: string]: any;
}

export interface SupportTicket {
  [key: string]: any;
}

export interface FAQCategory {
  [key: string]: any;
}

export interface FAQ {
  [key: string]: any;
}

// Search-related types
export interface SearchHistory {
  id: string;
  userId: string;
  queries: string[];
  createdAt: any;
  updatedAt: any;
}

export interface PopularSearch {
  id: string;
  query: string;
  count: number;
  lastSearchedAt: any;
  createdAt: any;
  updatedAt: any;
}

/** Helper link for event (artist, Facebook, website, etc.) */
export interface EventLink {
  label: string;
  url: string;
}

/** Contract requisites for event organizer */
export interface EventContractRequisites {
  name: string;
  idCode: string;
  organizationalUnit: string;
  directorName: string;
  email: string;
  contactPersonName: string;
  contactPhone: string;
  accountNumber: string;
}

export interface Event {
  id: string;
  sellerId: string;
  titleKa: string;
  titleEn?: string;
  descriptionKa: string;
  descriptionEn?: string;
  poster1200x630?: string;
  poster1800x600?: string;
  doorsOpenAt: any;
  startAt: any;
  locationUrl: string;
  ageRestriction?: {
    childrenAllowed: boolean;
    freeEntryUntilAge?: number;
  };
  links?: EventLink[];
  ticketPrice: number;
  ticketQuantity: number;
  ticketsSold?: number;
  contractRequisites: EventContractRequisites;
  isMasterclass?: boolean;
  status?: 'draft' | 'published';
  createdAt?: any;
  updatedAt?: any;
}
