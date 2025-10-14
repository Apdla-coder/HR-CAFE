-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    national_id TEXT,
    hire_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    role VARCHAR(50) DEFAULT 'employee',
    department VARCHAR(100),
    position VARCHAR(100),
    shift_type INTEGER DEFAULT 8,
    basic_salary DECIMAL(10,2) DEFAULT 0,
    hourly_rate DECIMAL(10,2)
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id),
    related_id UUID,
    related_type VARCHAR(50)
);

-- Inventory Items Table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    category VARCHAR(50),
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    last_update TIMESTAMPTZ DEFAULT NOW(),
    unit_price DECIMAL(10,2),
    supplier TEXT,
    notes TEXT
);

-- Employee Requests Table
CREATE TABLE IF NOT EXISTS employee_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    details TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    response TEXT,
    response_date TIMESTAMPTZ,
    attachments JSONB
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status VARCHAR(50) DEFAULT 'absent',
    check_in_lat DECIMAL(10,8),
    check_in_lng DECIMAL(11,8),
    check_out_lat DECIMAL(10,8),
    check_out_lng DECIMAL(11,8),
    late_minutes INTEGER DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);

-- Create indices for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_employee_requests_user_id ON employee_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON employee_requests(status);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);