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

-- Make sure attendance table has correct schema
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status VARCHAR(50);