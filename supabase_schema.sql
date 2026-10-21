-- ============================================================================
-- AETHER-JIT // EV-OS: POSTGRESQL DDL & RPC STORED PROCEDURES (SUPABASE)
-- DBMS Capstone Review 2: ACID, Concurrency Control, & Recursive BOM
-- Run this entire script in ONE query tab in Supabase SQL Editor.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. WAREHOUSE BINS (With Non-Negative Check Constraint for ACID Rollback Demo)
CREATE TABLE IF NOT EXISTS warehouse_bins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bin_code VARCHAR(32) UNIQUE NOT NULL,
    zone VARCHAR(16) NOT NULL,
    rack VARCHAR(16) NOT NULL,
    shelf VARCHAR(16) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 10,
    CONSTRAINT chk_stock_non_negative CHECK (stock >= 0)
);

-- 3. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_code VARCHAR(32) UNIQUE NOT NULL,
    supplier_name VARCHAR(128) NOT NULL,
    lead_time_days INTEGER NOT NULL DEFAULT 14,
    allocated_quota_usd NUMERIC(12, 2) NOT NULL DEFAULT 5000000.00,
    rating VARCHAR(16) DEFAULT 'TIER-1A'
);

-- 4. BOM COMPONENTS (Hierarchical Bill of Materials)
CREATE TABLE IF NOT EXISTS bom_components (
    id VARCHAR(32) PRIMARY KEY,
    parent_id VARCHAR(32) REFERENCES bom_components(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    mesh_key VARCHAR(64) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    category VARCHAR(64) NOT NULL,
    material VARCHAR(128) NOT NULL,
    purity VARCHAR(64) NOT NULL,
    rfid_tag VARCHAR(32) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 20,
    unit_cost_usd NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    status VARCHAR(32) NOT NULL DEFAULT 'healthy',
    qc_hold BOOLEAN NOT NULL DEFAULT FALSE,
    bin_id UUID REFERENCES warehouse_bins(id),
    supplier_id UUID REFERENCES suppliers(id),
    sdg9_impact TEXT,
    sdg12_impact TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. WRITE-AHEAD LOG (WAL) & REALTIME AUDIT TRAIL
CREATE TABLE IF NOT EXISTS wal_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    lsn VARCHAR(32) NOT NULL,
    tx_name VARCHAR(32) NOT NULL,
    query_text TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    acid_property VARCHAR(16),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PURCHASE ORDERS TABLE (For JIT Reorder TX-01)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_code VARCHAR(32) UNIQUE NOT NULL,
    part_id VARCHAR(32) REFERENCES bom_components(id),
    order_qty INTEGER NOT NULL,
    total_cost_usd NUMERIC(12, 2) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    status VARCHAR(32) DEFAULT 'DISPATCHED_JIT',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. COVERING COMPOSITE INDEX (FOR TAB 4 QUERY OPTIMIZER)
CREATE INDEX IF NOT EXISTS idx_bom_jit_cover 
ON bom_components (parent_id, stock, reorder_level) 
INCLUDE (bin_id, supplier_id);

-- 8. SAFE REALTIME REGISTRATION (Prevents 'already exists' errors on re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bom_components'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE bom_components;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'wal_audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE wal_audit_logs;
    END IF;
END $$;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS FOR ANON CLIENT
ALTER TABLE warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE wal_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- warehouse_bins policy
    DROP POLICY IF EXISTS "public_access_warehouse_bins" ON warehouse_bins;
    CREATE POLICY "public_access_warehouse_bins" ON warehouse_bins FOR ALL USING (true) WITH CHECK (true);

    -- suppliers policy
    DROP POLICY IF EXISTS "public_access_suppliers" ON suppliers;
    CREATE POLICY "public_access_suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);

    -- bom_components policy
    DROP POLICY IF EXISTS "public_access_bom_components" ON bom_components;
    CREATE POLICY "public_access_bom_components" ON bom_components FOR ALL USING (true) WITH CHECK (true);

    -- wal_audit_logs policy
    DROP POLICY IF EXISTS "public_access_wal_audit_logs" ON wal_audit_logs;
    CREATE POLICY "public_access_wal_audit_logs" ON wal_audit_logs FOR ALL USING (true) WITH CHECK (true);

    -- purchase_orders policy
    DROP POLICY IF EXISTS "public_access_purchase_orders" ON purchase_orders;
    CREATE POLICY "public_access_purchase_orders" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Grant access to anon and authenticated roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- 10. SEED DATA
-- ============================================================================
INSERT INTO suppliers (supplier_code, supplier_name, lead_time_days, allocated_quota_usd)
VALUES 
    ('SUP-TORAY', 'Toray Advanced Composites JP', 18, 2500000.00),
    ('SUP-CATL', 'QuantumScape & CATL JV', 21, 8000000.00),
    ('SUP-ALB', 'Albemarle Lithium Corp NV', 28, 4000000.00),
    ('SUP-YASA', 'YASA Limited UK', 14, 3000000.00),
    ('SUP-BREMBO', 'Brembo S.p.A. & Magna Steyr', 12, 1800000.00),
    ('SUP-INFINEON', 'Infineon Technologies DE / STMicro', 32, 5500000.00),
    ('SUP-LUMINAR', 'Luminar Technologies & Mobileye', 25, 2200000.00)
ON CONFLICT (supplier_code) DO UPDATE 
SET allocated_quota_usd = EXCLUDED.allocated_quota_usd;

INSERT INTO warehouse_bins (bin_code, zone, rack, shelf, stock, min_threshold)
VALUES 
    ('Bin-01A', 'Zone-A', 'Rack-01', 'Bin-01A', 42, 50),
    ('Bin-08B', 'Zone-B', 'Rack-14', 'Bin-08B', 14, 25),
    ('Bin-02C', 'Zone-B', 'Rack-15', 'Bin-02C', 18, 30),
    ('Bin-11A', 'Zone-C', 'Rack-04', 'Bin-11A', 64, 40),
    ('Bin-03D', 'Zone-C', 'Rack-05', 'Bin-03D', 51, 35),
    ('Bin-09F', 'Zone-D', 'ESD-Vault-02', 'Bin-09F', 9, 20),
    ('Bin-01L', 'Zone-D', 'ESD-Vault-01', 'Bin-01A', 19, 25)
ON CONFLICT (bin_code) DO UPDATE 
SET stock = EXCLUDED.stock;

-- Seed BOM Components
INSERT INTO bom_components (
    id, parent_id, name, mesh_key, level, category, material, purity,
    rfid_tag, stock, reorder_level, unit_cost_usd, status, qc_hold,
    bin_id, supplier_id, sdg9_impact, sdg12_impact
)
VALUES
(
    'BOM-00', NULL, 'Aero-Monocoque Carbon Chassis', 'Chassis_Body', 1, 'Structural Airframe',
    'Toray T1000G Carbon / Recycled Al-Si Bulkheads', '99.4% Aerospace Spec', 'RFID-9842-A1',
    42, 50, 14250.00, 'warning', FALSE,
    (SELECT id FROM warehouse_bins WHERE bin_code = 'Bin-01A'),
    (SELECT id FROM suppliers WHERE supplier_code = 'SUP-TORAY'),
    'Advanced lightweight composite chemistry cuts vehicle mass by 38%, slashing lifecycle energy consumption and optimizing sustainable factory stamping lines.',
    'Closed-loop carbon scrap reclamation with 40% recycled aerospace dry fiber diverted from landfill into secondary crash-structure sub-frames.'
),
(
    'BOM-01', NULL, '800V Solid-State Structural Battery Pack', 'Underbody_Battery', 1, 'Energy Storage & HV',
    'Lithium-Metal Anode / Ethical Cobalt-Free LFP', '99.95% Battery Grade', 'RFID-4410-B8',
    14, 25, 22800.00, 'critical', FALSE,
    (SELECT id FROM warehouse_bins WHERE bin_code = 'Bin-08B'),
    (SELECT id FROM suppliers WHERE supplier_code = 'SUP-CATL'),
    'Direct cell-to-chassis architecture achieving 450 Wh/kg volumetric energy density, enabling rapid 15-minute 10-80% JIT factory DC test cycles.',
    '100% ethical chain-of-custody sourcing certified under IRMA standard with digital battery passports for circular hydrometallurgical recycling.'
),
(
    'BOM-01-A', 'BOM-01', '4,400x Prismatic 21700 Cell Modules', 'Cell_Array_21700', 2, 'Electro-Chemical Core',
    '99.9% Battery-Grade Lithium Carbonate', '99.98% High-Purity Salt', 'RFID-4411-B2',
    18, 30, 8400.00, 'warning', FALSE,
    (SELECT id FROM warehouse_bins WHERE bin_code = 'Bin-02C'),
    (SELECT id FROM suppliers WHERE supplier_code = 'SUP-ALB'),
    'Modular cell matrix design allowing automated robotic swapping of degraded sub-modules during rapid factory testing without whole-pack scrapping.',
    'Complies with EU Battery Passport 2026 mandate; barcode traces lithium extraction back to geothermal brine evaporation with zero open-pit mining.'
),
(
    'BOM-02', NULL, 'Rear Dual Axial-Flux Motor (950kW)', 'Rear_Powertrain', 1, 'E-Drivetrain',
    'Heavy-Rare-Earth-Free Neodymium / Hairpin Copper', '99.8% Dysprosium-Free Magnetics', 'RFID-8819-C4',
    64, 40, 16500.00, 'healthy', FALSE,
    (SELECT id FROM warehouse_bins WHERE bin_code = 'Bin-11A'),
    (SELECT id FROM suppliers WHERE supplier_code = 'SUP-YASA'),
    'Axial-flux stator topology achieving 30 kW/kg power density, doubling power-to-weight efficiency over conventional radial induction units.',
    'Eliminates Terbium and Dysprosium conflict mining by utilizing Grain Boundary Diffusion (GBD) permanent magnet processing.'
),
(
    'BOM-03', NULL, 'Front Torque-Vectoring Drive Unit & Brembo CCM-R', 'Wheels_Brakes_Assembly', 1, 'Chassis Dynamics',
    'Carbon-Ceramic Matrix / Laminated Silicon Steel', 'Brembo Carbon-Ceramic Class VI', 'RFID-3301-C5',
    51, 35, 9800.00, 'healthy', FALSE,
    (SELECT id FROM warehouse_bins WHERE bin_code = 'Bin-03D'),
    (SELECT id FROM suppliers WHERE supplier_code = 'SUP-BREMBO'),
    'Regenerative braking blended software recovers up to 85% of kinetic stopping energy back into the 800V bus, extending brake disc wear life to 300,000 km.',
    'Zero hazardous copper dust emissions; pads formulated with bio-inert ceramic-matrix friction composites meeting Euro 7 particulate limits.'
),
(
    'BOM-04', NULL, '800V Silicon-Carbide (SiC) Dual Inverter & Master BMS', 'Interior_Electronics_BMS', 1, 'Power Electronics',
    'SiC MOSFET Wafer / Gold Busbars / Low-Loss Ceramics', 'Grade-9 Electronic Crystal Purity', 'RFID-1092-D9',
    9, 20, 11200.00, 'critical', FALSE,
    (SELECT id FROM warehouse_bins WHERE bin_code = 'Bin-09F'),
    (SELECT id FROM suppliers WHERE supplier_code = 'SUP-INFINEON'),
    '99.2% inverter inversion efficiency using trench SiC MOSFETs reduces switching thermal dissipation by 65%, enabling smaller cooling pumps and higher factory throughput.',
    'Conflict-free gold and tantalum supply chain certified under RMI (Responsible Minerals Initiative) audit with digital traceability to smelter origin.'
),
(
    'BOM-05', NULL, 'Solid-State 1550nm Roof LiDAR & Canopy Sensor Array', 'Glass_Canopy_LiDAR', 1, 'Autonomous Perception',
    'InGaAs Photodiode / 1000-TOPS NPU / Schott Borosilicate Glass', 'Optical Precision Grade IV', 'RFID-7712-D1',
    19, 25, 6900.00, 'warning', FALSE,
    (SELECT id FROM warehouse_bins WHERE bin_code = 'Bin-01L'),
    (SELECT id FROM suppliers WHERE supplier_code = 'SUP-LUMINAR'),
    'Eye-safe 1550nm pulse laser with on-chip silicon photonics enables Level 4 factory AGV yard autonomous navigation without external beacons.',
    'Aerodynamic roof integration eliminates auxiliary mounting brackets and reduces parasitic aerodynamic drag, optimizing total energy expenditure.'
)
ON CONFLICT (id) DO UPDATE 
SET stock = EXCLUDED.stock,
    status = EXCLUDED.status,
    qc_hold = EXCLUDED.qc_hold;

-- ============================================================================
-- 11. RPC STORED PROCEDURES (FOR REVIEW 2 ATOMICITY & CONCURRENCY)
-- ============================================================================

-- RPC 1: TX-01 JIT Automated Reorder & Supplier Quota Lock (ACID Unit of Work)
CREATE OR REPLACE FUNCTION execute_tx01_jit_reorder(target_part_id TEXT, order_qty INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bom RECORD;
    v_po_code VARCHAR(32);
    v_total_cost NUMERIC(12, 2);
    v_lsn VARCHAR(32);
    v_new_stock INTEGER;
BEGIN
    v_po_code := 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');
    v_lsn := '0x' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));

    SELECT * INTO v_bom
    FROM bom_components
    WHERE id = target_part_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Part ID % does not exist in BOM master registry.', target_part_id;
    END IF;

    v_total_cost := v_bom.unit_cost_usd * order_qty;

    UPDATE bom_components
    SET stock = stock + order_qty,
        status = CASE WHEN (stock + order_qty) >= reorder_level THEN 'healthy' ELSE 'warning' END,
        updated_at = NOW()
    WHERE id = target_part_id
    RETURNING stock INTO v_new_stock;

    UPDATE warehouse_bins
    SET stock = stock + order_qty
    WHERE id = v_bom.bin_id;

    UPDATE suppliers
    SET allocated_quota_usd = allocated_quota_usd - v_total_cost
    WHERE id = v_bom.supplier_id;

    INSERT INTO purchase_orders (po_code, part_id, order_qty, total_cost_usd, supplier_id, status)
    VALUES (v_po_code, target_part_id, order_qty, v_total_cost, v_bom.supplier_id, 'DISPATCHED_JIT');

    INSERT INTO wal_audit_logs (lsn, tx_name, query_text, status, acid_property, details)
    VALUES (
        v_lsn,
        'TX-01',
        FORMAT('JIT RESTOCK: Part %s (+%s units) via %s. PO: %s.', target_part_id, order_qty, v_bom.mesh_key, v_po_code),
        'COMMITTED',
        'ATOMICITY',
        JSONB_BUILD_OBJECT('part_id', target_part_id, 'po_code', v_po_code, 'new_stock', v_new_stock, 'total_cost', v_total_cost)
    );

    RETURN JSONB_BUILD_OBJECT(
        'success', TRUE,
        'po_code', v_po_code,
        'lsn', v_lsn,
        'part_id', target_part_id,
        'new_stock', v_new_stock,
        'message', 'Transaction TX-01 committed atomically with durability guarantee.'
    );
END;
$$;

-- RPC 2: TX-02 Multi-Bin Battery Pack Kitting Rollback Demo
CREATE OR REPLACE FUNCTION execute_tx02_battery_kitting_rollback()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lsn VARCHAR(32);
BEGIN
    v_lsn := '0x' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));

    -- Intentionally attempt an invalid deduction that violates CHECK constraint on Bin-09F
    UPDATE warehouse_bins
    SET stock = stock - 50
    WHERE bin_code = 'Bin-09F';

    RETURN JSONB_BUILD_OBJECT('success', TRUE);
EXCEPTION
    WHEN check_violation THEN
        INSERT INTO wal_audit_logs (lsn, tx_name, query_text, status, acid_property, details)
        VALUES (
            v_lsn,
            'TX-02',
            'CONSTRAINT VIOLATION: warehouse_bins.stock < 0 on Bin-09F. PostgreSQL Error 23514.',
            'ROLLED_BACK',
            'CONSISTENCY',
            JSONB_BUILD_OBJECT('error_code', '23514', 'bin_code', 'Bin-09F', 'action', 'ABORT_AND_ROLLBACK')
        );

        RETURN JSONB_BUILD_OBJECT(
            'success', FALSE,
            'lsn', v_lsn,
            'error_code', '23514',
            'error_name', 'CHECK_VIOLATION',
            'message', 'CHECK (stock >= 0) violated on Bin-09F. Rollback triggered. Zero units deducted.'
        );
END;
$$;

-- RPC 3: TX-03 Defective Batch Quarantine Cascade
CREATE OR REPLACE FUNCTION execute_tx03_quarantine_batch(batch_lot_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lsn VARCHAR(32);
BEGIN
    v_lsn := '0x' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));

    UPDATE bom_components
    SET qc_hold = TRUE,
        status = 'critical',
        updated_at = NOW()
    WHERE id IN ('BOM-01', 'BOM-01-A');

    INSERT INTO wal_audit_logs (lsn, tx_name, query_text, status, acid_property, details)
    VALUES (
        v_lsn,
        'TX-03',
        FORMAT('QUALITY QUARANTINE CASCADE: Contaminated lot %s. Locked BOM-01 & BOM-01-A.', batch_lot_id),
        'COMMITTED',
        'ISOLATION',
        JSONB_BUILD_OBJECT('lot_id', batch_lot_id, 'components_locked', JSONB_BUILD_ARRAY('BOM-01', 'BOM-01-A'))
    );

    RETURN JSONB_BUILD_OBJECT(
        'success', TRUE,
        'lsn', v_lsn,
        'lot_id', batch_lot_id,
        'locked_components', JSONB_BUILD_ARRAY('BOM-01', 'BOM-01-A'),
        'message', 'Defective raw batch quarantined. Battery pack visual beacon set to active QC lockout.'
    );
END;
$$;

-- RPC 4: Concurrency Race Test (Strict 2PL Row Lock with FOR UPDATE NOWAIT)
CREATE OR REPLACE FUNCTION attempt_stock_deduction(line_id TEXT, bin_code TEXT, qty INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bin RECORD;
    v_new_stock INTEGER;
BEGIN
    SELECT * INTO v_bin
    FROM warehouse_bins
    WHERE bin_code = attempt_stock_deduction.bin_code
    FOR UPDATE NOWAIT;

    IF v_bin.stock < qty THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Required %, available % in %', qty, v_bin.stock, bin_code;
    END IF;

    UPDATE warehouse_bins
    SET stock = stock - qty
    WHERE id = v_bin.id
    RETURNING stock INTO v_new_stock;

    RETURN JSONB_BUILD_OBJECT(
        'success', TRUE,
        'line_id', line_id,
        'bin_code', bin_code,
        'deducted_qty', qty,
        'new_stock', v_new_stock
    );
EXCEPTION
    WHEN lock_not_available THEN
        RETURN JSONB_BUILD_OBJECT(
            'success', FALSE,
            'line_id', line_id,
            'error', 'LOCK_TIMEOUT_BLOCKED',
            'message', 'Row is currently locked by a concurrent robotic assembly line.'
        );
    WHEN OTHERS THEN
        RETURN JSONB_BUILD_OBJECT(
            'success', FALSE,
            'line_id', line_id,
            'error', SQLERRM,
            'message', 'Transaction aborted to preserve conflict serializability.'
        );
END;
$$;
