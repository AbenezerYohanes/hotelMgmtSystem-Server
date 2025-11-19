
USE hotel_management;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('superadmin','admin','user') DEFAULT 'user',
    privileges JSON,
    status ENUM('active','suspended') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Users table for authentication (aligned with server route fields)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    role ENUM('super_admin','admin','manager','staff','client') DEFAULT 'client',
    privileges JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Hotels table
CREATE TABLE IF NOT EXISTS hotels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    address VARCHAR(255),
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    hotel_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    price_per_night DECIMAL(10,2) NOT NULL,
    inventory INT DEFAULT 1,
    amenities JSON,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    hotel_id INT NOT NULL,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    nights INT NOT NULL,
    status ENUM('pending','confirmed','cancelled','checked_in','checked_out') DEFAULT 'pending',
    stripe_payment_intent VARCHAR(100),
    payment_status ENUM('pending','succeeded','refunded') DEFAULT 'pending',
    receipt_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    hotel_id INT,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    title VARCHAR(100),
    salary DECIMAL(10,2),
    status ENUM('active','on_leave','terminated') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE SET NULL
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
    transaction_id VARCHAR(255),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

-- Room types table
CREATE TABLE IF NOT EXISTS room_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    capacity INT DEFAULT 1,
    amenities JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status ENUM('present','absent','late','half_day') DEFAULT 'present',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_employee_date (employee_id, date)
);

-- Payroll table
CREATE TABLE IF NOT EXISTS payroll (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    base_salary DECIMAL(10,2) NOT NULL,
    days_worked INT DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    overtime_rate DECIMAL(10,2) DEFAULT 0,
    deductions DECIMAL(10,2) DEFAULT 0,
    bonuses DECIMAL(10,2) DEFAULT 0,
    net_salary DECIMAL(10,2) NOT NULL,
    status ENUM('pending','processed','paid') DEFAULT 'pending',
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_employee_month_year (employee_id, month, year)
);

-- Guests table
CREATE TABLE IF NOT EXISTS guests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(100) NOT NULL,
    performed_by INT NOT NULL,
    target_id INT,
    meta JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE
);
-- Admin privileges table (explicit grants by super_admin)
CREATE TABLE IF NOT EXISTS admin_privileges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    privilege VARCHAR(100) NOT NULL,
    granted_by INT NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT IGNORE INTO users (email, password, name, role, privileges, status) VALUES
('superadmin@hotel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super Admin', 'superadmin', '{\"manage_hotels\": true, \"manage_admins\": true, \"manage_rooms\": true, \"manage_hr\": true, \"process_refunds\": true}', 'active');
-- Insert default super admin user (password hash field is `password_hash`)
INSERT IGNORE INTO users (username, email, password_hash, first_name, last_name, role, privileges, is_active, created_by) VALUES
('superadmin', 'superadmin@hotel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super', 'Admin', 'super_admin', '{"manage_hotels": true, "manage_admins": true, "manage_rooms": true, "manage_hr": true, "process_refunds": true}', TRUE, NULL);

-- Insert sample hotel
INSERT IGNORE INTO hotels (name, description, country, city, address, created_by) VALUES
('Grand Hotel', 'A luxurious hotel in the city center', 'USA', 'New York', '123 Main St, New York, NY 10001', 1);

-- Insert sample rooms
INSERT IGNORE INTO rooms (hotel_id, title, type, price_per_night, inventory, amenities, status) VALUES
(1, 'Deluxe Single Room', 'Single', 100.00, 10, '[\"WiFi\", \"TV\", \"Air Conditioning\", \"Mini Bar\"]', 'active'),
(1, 'Deluxe Double Room', 'Double', 150.00, 8, '[\"WiFi\", \"TV\", \"Air Conditioning\", \"Mini Bar\", \"Balcony\"]', 'active'),
(1, 'Executive Suite', 'Suite', 250.00, 5, '[\"WiFi\", \"TV\", \"Air Conditioning\", \"Mini Bar\", \"Kitchenette\", \"Balcony\", \"Jacuzzi\"]', 'active'),
(1, 'Family Suite', 'Family', 200.00, 6, '[\"WiFi\", \"TV\", \"Air Conditioning\", \"Mini Bar\", \"Extra Beds\", \"Kitchenette\"]', 'active');

-- Insert sample employees
INSERT IGNORE INTO employees (hotel_id, name, department, title, salary, status) VALUES
(1, 'John Smith', 'Management', 'Hotel Manager', 5000.00, 'active'),
(1, 'Sarah Johnson', 'Housekeeping', 'Housekeeping Supervisor', 2500.00, 'active'),
(1, 'Mike Davis', 'Reception', 'Front Desk Manager', 3000.00, 'active'),
(1, 'Emma Wilson', 'Kitchen', 'Head Chef', 3500.00, 'active');

-- Staff documents table
CREATE TABLE IF NOT EXISTS staff_documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    uploaded_by INT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    uploaded_by INT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
