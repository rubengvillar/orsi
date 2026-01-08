-- Sequences for each product category
CREATE SEQUENCE IF NOT EXISTS acc_code_seq;
CREATE SEQUENCE IF NOT EXISTS vid_code_seq;
CREATE SEQUENCE IF NOT EXISTS ins_code_seq;

-- Function to generate the code
CREATE OR REPLACE FUNCTION generate_inventory_code()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    seq_name TEXT;
    next_val BIGINT;
BEGIN
    -- Determine prefix and sequence based on table name
    IF TG_TABLE_NAME = 'aluminum_accessories' THEN
        prefix := 'ACC-';
        seq_name := 'acc_code_seq';
    ELSIF TG_TABLE_NAME = 'glass_types' THEN
        prefix := 'VID-';
        seq_name := 'vid_code_seq';
    ELSIF TG_TABLE_NAME = 'glass_accessories' THEN
        prefix := 'INS-';
        seq_name := 'ins_code_seq';
    ELSE
        RETURN NEW;
    END IF;

    -- Only generate if code is NULL or empty
    IF NEW.code IS NULL OR NEW.code = '' THEN
        next_val := nextval(seq_name);
        NEW.code := prefix || LPAD(next_val::TEXT, 4, '0');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for Aluminum Accessories
DROP TRIGGER IF EXISTS trg_generate_acc_code ON aluminum_accessories;
CREATE TRIGGER trg_generate_acc_code
BEFORE INSERT ON aluminum_accessories
FOR EACH ROW
EXECUTE FUNCTION generate_inventory_code();

-- Triggers for Glass Types
DROP TRIGGER IF EXISTS trg_generate_vid_code ON glass_types;
CREATE TRIGGER trg_generate_vid_code
BEFORE INSERT ON glass_types
FOR EACH ROW
EXECUTE FUNCTION generate_inventory_code();

-- Triggers for Glass Accessories
DROP TRIGGER IF EXISTS trg_generate_ins_code ON glass_accessories;
CREATE TRIGGER trg_generate_ins_code
BEFORE INSERT ON glass_accessories
FOR EACH ROW
EXECUTE FUNCTION generate_inventory_code();
