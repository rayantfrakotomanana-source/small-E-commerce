import { z } from 'zod';
import { notFound } from 'next/navigation';
import { OrderDetail } from './order-detail';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <OrderDetail id={id} />;
}