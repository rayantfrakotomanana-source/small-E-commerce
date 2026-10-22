import { z } from 'zod';

export const madagascarPhoneSchema = z.string()
  .transform((value) => value.replace(/[\s-]/g, '').replace(/^\+?261/, '0'))
  .pipe(z.string().regex(/^03[23478]\d{7}$/));
