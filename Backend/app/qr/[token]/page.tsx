import React from 'react';
import { prisma } from '@/lib/db/prisma';
import { resolveQrContext } from '@/lib/qr/resolve';
import CustomerDineInView from './CustomerDineInView';
import { Category } from './types';
import { THEME } from './constants';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QrScanLandingPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = searchParams ? await searchParams : {};
  const orderIdParam = typeof query.orderId === 'string' ? query.orderId : undefined;
  const isFeedbackView =
    query.view === 'feedback' || query.feedback === 'true' || Boolean(orderIdParam);

  let qrContext;
  let resolutionError: string | null = null;

  try {
    qrContext = await resolveQrContext(token);
  } catch (err: unknown) {
    resolutionError =
      err instanceof Error
        ? err.message
        : 'This QR code is invalid, expired, or currently out of service.';
  }

  if (resolutionError || !qrContext) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: THEME.colors.bgPage,
          color: THEME.colors.textMain,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: THEME.typography.fontFamily,
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.xl,
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: THEME.shadow.elevated,
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: THEME.colors.badgeRedBg,
              border: `2px solid ${THEME.colors.badgeRed}`,
              color: THEME.colors.badgeRed,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 20px',
            }}
          >
            ⚠️
          </div>

          <h1
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 10px',
            }}
          >
            Table QR Unavailable
          </h1>

          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}
          >
            {resolutionError ||
              'This table QR code is invalid, has expired, or the table is currently unavailable.'}
          </p>

          <div
            style={{
              backgroundColor: THEME.colors.bgCardSubtle,
              border: `1px solid ${THEME.colors.borderSubtle}`,
              borderRadius: THEME.radius.md,
              padding: '14px 16px',
              fontSize: '12px',
              color: THEME.colors.textMain,
              textAlign: 'left',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: THEME.colors.navyPrimary }}>What to do next:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px', color: THEME.colors.textMuted }}>
              <li>Ask your server to refresh the table QR code.</li>
              <li>Order directly with restaurant staff.</li>
            </ul>
          </div>
        </div>
      </main>
    );
  }

  // Fetch active menu categories and available products
  const categoriesRaw = await prisma.categories.findMany({
    where: {
      restaurant_id: qrContext.restaurant.id,
      is_active: true,
    },
    orderBy: {
      display_order: 'asc',
    },
    include: {
      products: {
        where: {
          restaurant_id: qrContext.restaurant.id,
          is_active: true,
          is_available: true,
        },
        orderBy: {
          display_order: 'asc',
        },
        include: {
          product_variants: {
            where: {
              is_active: true,
              is_available: true,
            },
            orderBy: {
              display_order: 'asc',
            },
          },
          product_addons: {
            where: {
              is_active: true,
              is_available: true,
            },
            orderBy: {
              display_order: 'asc',
            },
          },
        },
      },
    },
  });

  const categories: Category[] = categoriesRaw.map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    products: cat.products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: typeof p.price === 'number' ? p.price : Number(p.price),
      imageUrl: p.image_url,
      variants: p.product_variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: typeof v.price === 'number' ? v.price : Number(v.price),
      })),
      addons: p.product_addons.map((a) => ({
        id: a.id,
        name: a.name,
        price: typeof a.price === 'number' ? a.price : Number(a.price),
      })),
    })),
  }));

  return (
    <CustomerDineInView
      token={token}
      restaurant={qrContext.restaurant}
      branch={qrContext.branch}
      table={{
        id: qrContext.table.id,
        tableNumber: qrContext.table.table_number,
        capacity: qrContext.table.capacity,
        status: qrContext.table.status,
      }}
      categories={categories}
      initialOrderId={orderIdParam}
      initialView={isFeedbackView && orderIdParam ? 'feedback' : undefined}
    />
  );
}
