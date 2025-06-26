import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';
import { logger } from '@/config/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seeding...');

  try {
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123!@#', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@smartattend.com' },
      update: {},
      create: {
        email: 'admin@smartattend.com',
        firstName: 'System',
        lastName: 'Administrator',
        password: adminPassword,
        role: Role.ADMIN,
        isActive: true,
        emailVerified: true,
      },
    });
    logger.info('Admin user created/updated');

    // Create teacher user
    const teacherPassword = await bcrypt.hash('teacher123!@#', 12);
    const teacher = await prisma.user.upsert({
      where: { email: 'teacher@smartattend.com' },
      update: {},
      create: {
        email: 'teacher@smartattend.com',
        firstName: 'John',
        lastName: 'Teacher',
        password: teacherPassword,
        role: Role.TEACHER,
        isActive: true,
        emailVerified: true,
      },
    });
    logger.info('Teacher user created/updated');

    // Create sample students
    const studentData = [
      { email: 'alice@student.com', firstName: 'Alice', lastName: 'Johnson', studentId: 'STU001' },
      { email: 'bob@student.com', firstName: 'Bob', lastName: 'Smith', studentId: 'STU002' },
      { email: 'charlie@student.com', firstName: 'Charlie', lastName: 'Brown', studentId: 'STU003' },
      { email: 'diana@student.com', firstName: 'Diana', lastName: 'Wilson', studentId: 'STU004' },
      { email: 'eve@student.com', firstName: 'Eve', lastName: 'Davis', studentId: 'STU005' },
      { email: 'frank@student.com', firstName: 'Frank', lastName: 'Miller', studentId: 'STU006' },
      { email: 'grace@student.com', firstName: 'Grace', lastName: 'Taylor', studentId: 'STU007' },
      { email: 'henry@student.com', firstName: 'Henry', lastName: 'Anderson', studentId: 'STU008' },
      { email: 'ivy@student.com', firstName: 'Ivy', lastName: 'Thomas', studentId: 'STU009' },
      { email: 'jack@student.com', firstName: 'Jack', lastName: 'Jackson', studentId: 'STU010' },
    ];

    const studentPassword = await bcrypt.hash('student123!@#', 12);

    for (const student of studentData) {
      const user = await prisma.user.upsert({
        where: { email: student.email },
        update: {},
        create: {
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          password: studentPassword,
          role: Role.STUDENT,
          isActive: true,
          emailVerified: true,
        },
      });

      await prisma.student.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          studentId: student.studentId,
          subjects: ['Computer Science', 'Mathematics', 'Physics'],
        },
      });
    }
    logger.info('Sample students created/updated');

    // Create sample sessions
    const sessions = [
      {
        title: 'Introduction to Computer Science',
        description: 'First lecture on computer science fundamentals',
        subject: 'Computer Science',
        location: 'Room 101',
        scheduledAt: new Date('2024-01-15T09:00:00Z'),
        duration: 90,
        maxCapacity: 50,
      },
      {
        title: 'Advanced Mathematics',
        description: 'Calculus and linear algebra',
        subject: 'Mathematics',
        location: 'Room 201',
        scheduledAt: new Date('2024-01-15T11:00:00Z'),
        duration: 120,
        maxCapacity: 40,
      },
      {
        title: 'Physics Laboratory',
        description: 'Hands-on physics experiments',
        subject: 'Physics',
        location: 'Lab 301',
        scheduledAt: new Date('2024-01-15T14:00:00Z'),
        duration: 180,
        maxCapacity: 20,
      },
    ];

    for (const sessionData of sessions) {
      const session = await prisma.session.create({
        data: {
          ...sessionData,
          createdById: teacher.id,
          teacherId: teacher.id,
        },
      });

      // Enroll all students in all sessions
      const students = await prisma.student.findMany();
      for (const student of students) {
        await prisma.sessionEnrollment.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
          },
        });
      }

      logger.info(`Session created: ${session.title}`);
    }

    // Create sample system settings
    const systemSettings = [
      {
        key: 'ai_confidence_threshold',
        value: 0.7,
        category: 'ai',
      },
      {
        key: 'max_file_size',
        value: 10485760,
        category: 'upload',
      },
      {
        key: 'allowed_file_types',
        value: ['csv', 'xlsx', 'xls'],
        category: 'upload',
      },
      {
        key: 'session_timeout',
        value: 86400000,
        category: 'security',
      },
      {
        key: 'enable_email_notifications',
        value: true,
        category: 'notifications',
      },
    ];

    for (const setting of systemSettings) {
      await prisma.systemSettings.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: setting,
      });
    }
    logger.info('System settings created/updated');

    logger.info('Database seeding completed successfully!');

    // Log created credentials
    console.log('\n=== DEMO CREDENTIALS ===');
    console.log('Admin: admin@smartattend.com / admin123!@#');
    console.log('Teacher: teacher@smartattend.com / teacher123!@#');
    console.log('Student: alice@student.com / student123!@# (or any other student email)');
    console.log('========================\n');

  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });