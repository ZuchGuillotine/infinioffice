/*
  Seed a test user and organization with a specific Twilio number without triggering provisioning.

  Test values:
  - email:    bencox820@hotmail.com
  - password: cookie11 (not stored; login route doesn't verify password)
  - number:   3605641764 (stored as +13605641764)
*/
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function toE164(input) {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.startsWith('+')) return digits;
  throw new Error(`Cannot convert to E.164: ${input}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Ensure your .env is configured.');
    process.exit(1);
  }

  const email = process.env.SEED_EMAIL || 'bencox820@hotmail.com';
  const rawNumber = process.env.SEED_TWILIO || '3605641764';
  const twilioNumber = toE164(rawNumber);

  console.log('Seeding test user/org...');
  console.log('Email:', email);
  console.log('Twilio number (E.164):', twilioNumber);

  // 1) Ensure organization exists with the desired Twilio number
  let organization = await prisma.organization.findUnique({
    where: { twilioNumber }
  });

  if (!organization) {
    console.log('Creating organization...');
    organization = await prisma.organization.create({
      data: {
        name: 'Test Org (Ben Cox)',
        plan: 'starter',
        twilioNumber,
        businessConfig: {
          create: {
            businessHours: {
              monday: { start: '09:00', end: '17:00', enabled: true },
              tuesday: { start: '09:00', end: '17:00', enabled: true },
              wednesday: { start: '09:00', end: '17:00', enabled: true },
              thursday: { start: '09:00', end: '17:00', enabled: true },
              friday: { start: '09:00', end: '17:00', enabled: true },
              saturday: { start: '09:00', end: '12:00', enabled: false },
              sunday: { start: '09:00', end: '12:00', enabled: false }
            },
            services: [
              {
                id: 'default-consultation',
                name: 'Consultation',
                duration: 60,
                price: 0,
                category: 'General',
                active: true
              }
            ],
            greeting: "Hello! Thank you for calling. I'm here to help you schedule an appointment. How can I assist you today?",
            timezone: 'America/New_York',
            scripts: {
              greeting: "Hello! Thank you for calling. I'm here to help you schedule an appointment. How can I assist you today?",
              fallback: "I apologize, but I'm having trouble understanding. Let me connect you with someone who can help.",
              confirmation: 'Let me confirm your appointment details...',
              success: 'Your appointment has been successfully scheduled!'
            },
            rules: {
              defaultSlotMinutes: 60,
              bufferMinutes: 15,
              allowDoubleBooking: false
            },
            voiceSettings: {
              voiceModel: 'aura-asteria-en',
              speed: 1.0,
              pitch: 1.0
            }
          }
        }
      },
      include: { businessConfig: true }
    });
  } else {
    console.log('Organization already exists:', organization.id);
  }

  // 2) Ensure user exists and is tied to this organization
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('Creating user...');
    user = await prisma.user.create({
      data: {
        email,
        role: 'admin',
        organization: { connect: { id: organization.id } }
      }
    });
  } else if (user.organizationId !== organization.id) {
    console.log('Updating user organization...');
    user = await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: organization.id }
    });
  } else {
    console.log('User already exists:', user.id);
  }

  console.log('✅ Seed complete');
  console.log({ organizationId: organization.id, userId: user.id, twilioNumber });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


