/*
  Seed script for Voice Agent Features
  
  This script seeds:
  1. Enhanced organization with locations
  2. Agent configurations with different policies
  3. Knowledge base entries for FAQ
  4. Sample telemetry data for testing
*/

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Sample locations for a multi-branch business
const sampleLocations = [
  {
    name: 'Main Office',
    displayName: 'Downtown Location',
    address: {
      street: '123 Main Street',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'US',
      formatted: '123 Main Street, Seattle, WA 98101'
    },
    phone: '+12065551234',
    email: 'downtown@example.com',
    businessHours: {
      monday: { start: '08:00', end: '18:00', enabled: true },
      tuesday: { start: '08:00', end: '18:00', enabled: true },
      wednesday: { start: '08:00', end: '18:00', enabled: true },
      thursday: { start: '08:00', end: '18:00', enabled: true },
      friday: { start: '08:00', end: '17:00', enabled: true },
      saturday: { start: '09:00', end: '13:00', enabled: true },
      sunday: { start: '09:00', end: '13:00', enabled: false }
    },
    services: [
      { id: 'consultation', name: 'Consultation', duration: 60, available: true },
      { id: 'follow-up', name: 'Follow-up', duration: 30, available: true }
    ],
    timezone: 'America/Los_Angeles',
    sortOrder: 1
  },
  {
    name: 'North Branch',
    displayName: 'Northgate Office',
    address: {
      street: '456 North Avenue',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98125',
      country: 'US',
      formatted: '456 North Avenue, Seattle, WA 98125'
    },
    phone: '+12065555678',
    email: 'north@example.com',
    businessHours: {
      monday: { start: '09:00', end: '17:00', enabled: true },
      tuesday: { start: '09:00', end: '17:00', enabled: true },
      wednesday: { start: '09:00', end: '17:00', enabled: true },
      thursday: { start: '09:00', end: '17:00', enabled: true },
      friday: { start: '09:00', end: '16:00', enabled: true },
      saturday: { start: '10:00', end: '14:00', enabled: false },
      sunday: { start: '10:00', end: '14:00', enabled: false }
    },
    services: [
      { id: 'consultation', name: 'Consultation', duration: 45, available: true }
    ],
    timezone: 'America/Los_Angeles',
    sortOrder: 2
  }
];

// Sample agent configurations
const sampleAgentConfigs = [
  {
    version: '1.0.0',
    isActive: true,
    name: 'Standard Configuration',
    scriptOverrides: {
      greeting: "Hello! Thank you for calling our office. I'm your virtual assistant and I'm here to help you schedule an appointment. How can I assist you today?",
      confirmSlot: "Perfect! Let me confirm your appointment for {service} on {date} at {time}. Is this correct?",
      success: "Excellent! Your appointment has been scheduled. You'll receive a confirmation text shortly. Is there anything else I can help you with?",
      fallback: "I apologize, but I'm having trouble understanding. Let me connect you with one of our team members who can assist you further."
    },
    promptTemplates: {
      classification: "Classify the caller's intent based on their message. Categories: book_appointment, reschedule, cancel, question, other.",
      extraction: "Extract appointment details from: {transcript}. Return: service, preferred_date, preferred_time, contact_info.",
      confirmation: "Generate a natural confirmation response for: {appointment_details}"
    },
    policies: {
      businessRules: {
        allowWeekendBooking: false,
        requirePhoneNumber: true,
        maxAdvanceBookingDays: 90,
        minAdvanceBookingHours: 2
      },
      escalationTriggers: [
        "payment_questions",
        "medical_emergency", 
        "complaint",
        "complex_scheduling"
      ]
    },
    bufferMinutes: 15,
    defaultDuration: 60,
    maxAttempts: 3,
    voiceSettings: {
      voiceModel: 'aura-asteria-en',
      speed: 1.0,
      pitch: 1.0,
      pauseMs: 300
    },
    confirmationFlow: {
      requireExplicitConfirmation: true,
      maxConfirmationAttempts: 2,
      clarificationQuestions: [
        "Just to confirm, you'd like to schedule {service}?",
        "And the date that works best for you is {date}?",
        "Perfect, and what's the best phone number to reach you?"
      ]
    },
    digressionRules: {
      allowedDigressions: ['business_hours', 'location', 'services'],
      maxDigressionTurns: 3,
      returnPrompt: "Now, let's get back to scheduling your appointment."
    },
    bargeInSettings: {
      enabled: true,
      sensitivityLevel: 'medium',
      minimumSilenceMs: 500
    }
  },
  {
    version: '1.1.0',
    isActive: false,
    name: 'Relaxed Policy Configuration',
    policies: {
      businessRules: {
        allowWeekendBooking: true,
        requirePhoneNumber: false,
        maxAdvanceBookingDays: 120,
        minAdvanceBookingHours: 1
      }
    },
    bufferMinutes: 10,
    maxAttempts: 5,
    confirmationFlow: {
      requireExplicitConfirmation: false,
      maxConfirmationAttempts: 1
    }
  }
];

// Sample knowledge base entries
const sampleKnowledgeBase = [
  // Business Info
  {
    category: 'business_info',
    key: 'company_name',
    content: 'InfiniOffice Medical Center',
    priority: 10,
    tags: ['basic', 'identity']
  },
  {
    category: 'business_info', 
    key: 'main_phone',
    content: '+1 (206) 555-1234',
    priority: 9,
    tags: ['contact', 'phone']
  },
  {
    category: 'business_info',
    key: 'website',
    content: 'www.infinioffice-medical.com',
    priority: 8,
    tags: ['contact', 'web']
  },

  // Hours
  {
    category: 'hours',
    key: 'main_hours',
    content: 'Monday through Friday 8 AM to 6 PM, Saturday 9 AM to 1 PM. We are closed on Sundays.',
    priority: 10,
    tags: ['schedule', 'availability']
  },
  {
    category: 'hours',
    key: 'holiday_schedule',
    content: 'We are closed on major holidays including New Year\'s Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, and Christmas.',
    priority: 7,
    tags: ['schedule', 'holidays']
  },

  // Services
  {
    category: 'services',
    key: 'consultation_info',
    content: 'Initial consultations are 60 minutes and include a comprehensive evaluation and treatment planning.',
    priority: 9,
    tags: ['appointment', 'duration']
  },
  {
    category: 'services',
    key: 'follow_up_info', 
    content: 'Follow-up appointments are typically 30 minutes and focus on treatment progress and adjustments.',
    priority: 8,
    tags: ['appointment', 'duration']
  },
  {
    category: 'services',
    key: 'emergency_info',
    content: 'For medical emergencies, please call 911 or visit your nearest emergency room immediately.',
    priority: 10,
    tags: ['emergency', 'urgent']
  },

  // Policies
  {
    category: 'policies',
    key: 'cancellation_policy',
    content: 'Please provide at least 24 hours notice for appointment cancellations to avoid a cancellation fee.',
    priority: 8,
    tags: ['cancellation', 'fees']
  },
  {
    category: 'policies',
    key: 'insurance_info',
    content: 'We accept most major insurance plans. Please bring your insurance card to your appointment.',
    priority: 7,
    tags: ['insurance', 'payment']
  },
  {
    category: 'policies',
    key: 'new_patient_info',
    content: 'New patients should arrive 15 minutes early to complete paperwork. Please bring a valid ID and insurance card.',
    priority: 9,
    tags: ['new_patient', 'requirements']
  },

  // FAQ
  {
    category: 'faq',
    key: 'parking_info',
    content: 'Free parking is available in our building\'s garage. Enter from Pine Street and validate your ticket at the front desk.',
    priority: 6,
    tags: ['parking', 'directions']
  },
  {
    category: 'faq',
    key: 'telehealth_info',
    content: 'We offer telehealth appointments for follow-up visits and consultations. Technical requirements and setup instructions will be provided.',
    priority: 7,
    tags: ['telehealth', 'virtual']
  },
  {
    category: 'faq',
    key: 'prescription_refills',
    content: 'Prescription refills can be requested through our patient portal or by calling during business hours. Allow 48 hours for processing.',
    priority: 6,
    tags: ['prescriptions', 'refills']
  }
];

async function main() {
  console.log('🌱 Seeding Voice Agent Features...');

  // Get existing test organization
  const organization = await prisma.organization.findFirst({
    where: { name: { contains: 'Test Org' } }
  });

  if (!organization) {
    console.error('❌ No test organization found. Please run seed-test-user.js first.');
    process.exit(1);
  }

  console.log(`📍 Using organization: ${organization.name} (${organization.id})`);

  // 1. Seed Locations
  console.log('📍 Creating locations...');
  const createdLocations = [];
  for (const locationData of sampleLocations) {
    const location = await prisma.location.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: locationData.name
        }
      },
      update: locationData,
      create: {
        ...locationData,
        organizationId: organization.id
      }
    });
    createdLocations.push(location);
    console.log(`  ✅ ${location.name}`);
  }

  // 2. Seed Agent Configurations
  console.log('🤖 Creating agent configurations...');
  for (const configData of sampleAgentConfigs) {
    const config = await prisma.agentConfig.upsert({
      where: {
        organizationId_version: {
          organizationId: organization.id,
          version: configData.version
        }
      },
      update: configData,
      create: {
        ...configData,
        organizationId: organization.id
      }
    });
    console.log(`  ✅ Version ${config.version} - ${config.name}`);
  }

  // 3. Seed Knowledge Base
  console.log('📚 Creating knowledge base entries...');
  for (const kbData of sampleKnowledgeBase) {
    const entry = await prisma.knowledgeBase.upsert({
      where: {
        organizationId_category_key: {
          organizationId: organization.id,
          category: kbData.category,
          key: kbData.key
        }
      },
      update: kbData,
      create: {
        ...kbData,
        organizationId: organization.id
      }
    });
    console.log(`  ✅ ${entry.category}/${entry.key}`);
  }

  // 4. Create sample appointments with locations
  console.log('📅 Creating sample appointments...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const sampleAppointments = [
    {
      locationId: createdLocations[0].id,
      startAt: new Date(tomorrow.getTime()),
      endAt: new Date(tomorrow.getTime() + 60 * 60 * 1000), // 1 hour
      service: 'Consultation',
      provider: 'Dr. Smith',
      contactPhone: '+12065559999',
      contactName: 'John Doe',
      contactEmail: 'john.doe@email.com',
      status: 'scheduled',
      confirmationStatus: 'confirmed'
    },
    {
      locationId: createdLocations[1].id,
      startAt: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000), // 2 hours later
      endAt: new Date(tomorrow.getTime() + 2.5 * 60 * 60 * 1000), // 30 min duration
      service: 'Follow-up',
      provider: 'Dr. Johnson',
      contactPhone: '+12065558888',
      contactName: 'Jane Smith',
      contactEmail: 'jane.smith@email.com',
      status: 'scheduled',
      confirmationStatus: 'pending'
    }
  ];

  for (const appointmentData of sampleAppointments) {
    const appointment = await prisma.appointment.create({
      data: {
        ...appointmentData,
        organizationId: organization.id
      }
    });
    console.log(`  ✅ ${appointment.service} at ${appointment.startAt.toISOString()}`);
  }

  console.log('✅ Voice Agent Features seeding complete!');
  console.log('\n📊 Summary:');
  console.log(`  - ${createdLocations.length} locations created`);
  console.log(`  - ${sampleAgentConfigs.length} agent configurations created`);
  console.log(`  - ${sampleKnowledgeBase.length} knowledge base entries created`);
  console.log(`  - ${sampleAppointments.length} sample appointments created`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });