-- حل لمشكلة notifications
DROP TABLE IF EXISTS notifications CASCADE;
CREATE TABLE notifications (
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
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- حل لمشكلة inventory_items
DROP TABLE IF EXISTS inventory_items CASCADE;
CREATE TABLE inventory_items (
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
CREATE INDEX idx_inventory_category ON inventory_items(category);

-- حل لمشكلة employee_requests
DROP TABLE IF EXISTS employee_requests CASCADE;
CREATE TABLE employee_requests (
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
CREATE INDEX idx_employee_requests_user_id ON employee_requests(user_id);
CREATE INDEX idx_employee_requests_status ON employee_requests(status);

-- حل لمشكلة attendance
DROP TABLE IF EXISTS attendance CASCADE;
CREATE TABLE attendance (
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
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX idx_attendance_date ON attendance(date);