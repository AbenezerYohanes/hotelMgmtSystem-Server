const bcrypt = require('bcrypt');
const { sequelize, Role, Hotel, Department, Employee, Shift, Room, Guest } = require('../models');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('Database connected');

        // Sync models
        await sequelize.sync({ force: false });
        console.log('Models synced');

        // Seed Roles
        const roles = await Role.bulkCreate([
            { name: 'superadmin', permissions: { all: true } },
            { name: 'admin', permissions: { hr: true, hotel: true, reports: true } },
            { name: 'staff', permissions: { view_own: true } },
            { name: 'receptionist', permissions: { bookings: true, guests: true, view_own: true } },
            { name: 'guest', permissions: { bookings: true, profile: true } }
        ], { ignoreDuplicates: true });
        console.log('Roles seeded');

        // Seed Hotel
        const [hotel] = await Hotel.findOrCreate({
            where: { name: 'Grand Hotel' },
            defaults: {
                name: 'Grand Hotel',
                location: '123 Main Street, City, Country',
                contact: '+1234567890',
                email: 'info@grandhotel.com'
            }
        });
        console.log('Hotel seeded');

        // Seed Departments
        const departments = await Department.bulkCreate([
            { name: 'Front Desk', hotel_id: hotel.id },
            { name: 'Housekeeping', hotel_id: hotel.id },
            { name: 'Maintenance', hotel_id: hotel.id },
            { name: 'Food & Beverage', hotel_id: hotel.id },
            { name: 'Management', hotel_id: hotel.id }
        ], { ignoreDuplicates: true });
        console.log('Departments seeded');

        // Seed Shifts
        await Shift.bulkCreate([
            { name: 'Morning', start_time: '08:00:00', end_time: '16:00:00' },
            { name: 'Evening', start_time: '16:00:00', end_time: '00:00:00' },
            { name: 'Night', start_time: '00:00:00', end_time: '08:00:00' }
        ], { ignoreDuplicates: true });
        console.log('Shifts seeded');

        // Seed SuperAdmin
        const superAdminRole = await Role.findOne({ where: { name: 'superadmin' } });
        const superAdminPassword = await bcrypt.hash('admin123', 10);
        await Employee.findOrCreate({
            where: { email: 'superadmin@hotel.com' },
            defaults: {
                hotel_id: hotel.id,
                first_name: 'Super',
                last_name: 'Admin',
                email: 'superadmin@hotel.com',
                password: superAdminPassword,
                role_id: superAdminRole.id,
                status: 'active'
            }
        });
        console.log('SuperAdmin seeded (email: superadmin@hotel.com, password: admin123)');

        // Seed Admin
        const adminRole = await Role.findOne({ where: { name: 'admin' } });
        const adminPassword = await bcrypt.hash('admin123', 10);
        await Employee.findOrCreate({
            where: { email: 'admin@hotel.com' },
            defaults: {
                hotel_id: hotel.id,
                first_name: 'Admin',
                last_name: 'User',
                email: 'admin@hotel.com',
                password: adminPassword,
                role_id: adminRole.id,
                status: 'active'
            }
        });
        console.log('Admin seeded (email: admin@hotel.com, password: admin123)');

        // Seed Receptionist
        const receptionistRole = await Role.findOne({ where: { name: 'receptionist' } });
        const receptionistPassword = await bcrypt.hash('receptionist123', 10);
        await Employee.findOrCreate({
            where: { email: 'receptionist@hotel.com' },
            defaults: {
                hotel_id: hotel.id,
                first_name: 'Receptionist',
                last_name: 'User',
                email: 'receptionist@hotel.com',
                password: receptionistPassword,
                role_id: receptionistRole.id,
                status: 'active'
            }
        });
        console.log('Receptionist seeded (email: receptionist@hotel.com, password: receptionist123)');

        // Seed Staff
        const staffRole = await Role.findOne({ where: { name: 'staff' } });
        const staffPassword = await bcrypt.hash('staff123', 10);
        await Employee.findOrCreate({
            where: { email: 'staff@hotel.com' },
            defaults: {
                hotel_id: hotel.id,
                first_name: 'Staff',
                last_name: 'User',
                email: 'staff@hotel.com',
                password: staffPassword,
                role_id: staffRole.id,
                status: 'active'
            }
        });
        console.log('Staff seeded (email: staff@hotel.com, password: staff123)');

        // Seed Rooms
        await Room.bulkCreate([
            {
                hotel_id: hotel.id,
                room_type: 'Single',
                location: 'Floor 1',
                capacity: 1,
                amenities: JSON.stringify(['WiFi', 'TV', 'AC']),
                price: 50.00,
                status: 'available'
            },
            {
                hotel_id: hotel.id,
                room_type: 'Double',
                location: 'Floor 1',
                capacity: 2,
                amenities: JSON.stringify(['WiFi', 'TV', 'AC', 'Mini Bar']),
                price: 80.00,
                status: 'available'
            },
            {
                hotel_id: hotel.id,
                room_type: 'Suite',
                location: 'Floor 2',
                capacity: 4,
                amenities: JSON.stringify(['WiFi', 'TV', 'AC', 'Mini Bar', 'Jacuzzi']),
                price: 150.00,
                status: 'available'
            }
        ], { ignoreDuplicates: true });
        console.log('Rooms seeded');

        // Seed Sample Guest
        const guestPassword = await bcrypt.hash('guest123', 10);
        await Guest.findOrCreate({
            where: { email: 'guest@example.com' },
            defaults: {
                first_name: 'John',
                last_name: 'Doe',
                email: 'guest@example.com',
                password: guestPassword,
                contact: '+1234567890',
                address: '123 Guest Street'
            }
        });
        console.log('Sample Guest seeded (email: guest@example.com, password: guest123)');

        console.log('\n✅ Seeding completed successfully!');
        console.log('\nDefault Credentials:');
        console.log('SuperAdmin: superadmin@hotel.com / admin123');
        console.log('Admin: admin@hotel.com / admin123');
        console.log('Receptionist: receptionist@hotel.com / receptionist123');
        console.log('Staff: staff@hotel.com / staff123');
        console.log('Guest: guest@example.com / guest123');

        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    seed();
}

module.exports = seed;
