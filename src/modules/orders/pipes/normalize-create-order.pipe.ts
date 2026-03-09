import { PipeTransform, Injectable } from '@nestjs/common';

/**
 * Normalizes create-order body so both legacy and nested payloads are accepted:
 * - If deliveryAddress is an object, moves it to deliveryAddressDetails.
 * - Strips item.price and total (server calculates them).
 */
@Injectable()
export class NormalizeCreateOrderPipe implements PipeTransform {
  transform(body: any): any {
    if (!body || typeof body !== 'object') return body;
    const normalized = { ...body };

    if (
      normalized.deliveryAddress &&
      typeof normalized.deliveryAddress === 'object' &&
      !Array.isArray(normalized.deliveryAddress)
    ) {
      normalized.deliveryAddressDetails = normalized.deliveryAddress;
      delete normalized.deliveryAddress;
    }

    if (Array.isArray(normalized.items)) {
      normalized.items = normalized.items.map((item: any) => {
        const { price, ...rest } = item ?? {};
        return rest;
      });
    }

    if ('total' in normalized) {
      delete normalized.total;
    }

    return normalized;
  }
}
