CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('AUDIENCE', 'ORGANIZER', 'STAFF', 'SUPER_ADMIN')),
    organizer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. CONCERTS TABLE
CREATE TABLE IF NOT EXISTS concerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    seating_map JSONB,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TICKET_TYPES TABLE
CREATE TABLE IF NOT EXISTS ticket_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concert_id UUID NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    total_quantity INT NOT NULL CHECK (total_quantity > 0),
    max_per_user INT NOT NULL CHECK (max_per_user > 0),
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TICKETS TABLE
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    seat_label VARCHAR(50),
    qr_code VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('AVAILABLE', 'RESERVED', 'SOLD', 'CHECKED_IN')),
    scanned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tickets_ticket_type_id ON tickets(ticket_type_id);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_idempotency_key ON orders(idempotency_key);

-- =========================================================================
-- DATABASE LEVEL CONSTRAINTS (TRIGGERS) TO PREVENT OVERSELLING & RACE CONDITIONS
-- =========================================================================

-- TRIGGER 1: Prevent overall overselling (check total_quantity)
CREATE OR REPLACE FUNCTION fn_check_ticket_availability()
RETURNS TRIGGER AS $$
DECLARE
    v_total_quantity INT;
    v_current_sold_reserved INT;
BEGIN
    -- Chỉ kiểm tra khi vé được mua hoặc giữ chỗ
    IF NEW.status IN ('RESERVED', 'SOLD') THEN
        
        -- Kỹ thuật ROW-LEVEL LOCKING (Pessimistic Lock)
        -- Lock row ticket_types để đảm bảo các transaction khác đang mua cùng loại vé phải xếp hàng chờ
        SELECT total_quantity INTO v_total_quantity
        FROM ticket_types 
        WHERE id = NEW.ticket_type_id 
        FOR UPDATE;

        -- Đếm số vé đã bán/giữ chỗ của loại vé này
        SELECT COUNT(*) INTO v_current_sold_reserved
        FROM tickets
        WHERE ticket_type_id = NEW.ticket_type_id
          AND status IN ('RESERVED', 'SOLD', 'CHECKED_IN')
          AND id IS DISTINCT FROM NEW.id; -- Không đếm chính bản ghi đang update/insert nếu nó đã tồn tại

        -- Kiểm tra giới hạn
        IF v_current_sold_reserved >= v_total_quantity THEN
            RAISE EXCEPTION 'Ticket type % is sold out.', NEW.ticket_type_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_ticket_availability
BEFORE INSERT OR UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION fn_check_ticket_availability();


-- TRIGGER 2: Prevent user from exceeding max_per_user limit
CREATE OR REPLACE FUNCTION fn_check_user_ticket_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_max_per_user INT;
    v_current_user_tickets INT;
BEGIN
    IF NEW.user_id IS NOT NULL AND NEW.status IN ('RESERVED', 'SOLD') THEN
        
        -- Lấy giới hạn vé mỗi user
        SELECT max_per_user INTO v_max_per_user
        FROM ticket_types
        WHERE id = NEW.ticket_type_id;

        -- Kỹ thuật ROW-LEVEL LOCKING cho user
        -- Lock user record để chặn spam request từ cùng 1 user (cố tình lách limit)
        PERFORM id FROM users WHERE id = NEW.user_id FOR UPDATE;

        -- Đếm số vé user đã có cho loại này
        SELECT COUNT(*) INTO v_current_user_tickets
        FROM tickets
        WHERE ticket_type_id = NEW.ticket_type_id
          AND user_id = NEW.user_id
          AND status IN ('RESERVED', 'SOLD', 'CHECKED_IN')
          AND id IS DISTINCT FROM NEW.id;

        -- Kiểm tra giới hạn
        IF v_current_user_tickets >= v_max_per_user THEN
            RAISE EXCEPTION 'User % has reached the maximum allowed tickets (%) for this type', NEW.user_id, v_max_per_user;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_user_ticket_limit
BEFORE INSERT OR UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION fn_check_user_ticket_limit();
